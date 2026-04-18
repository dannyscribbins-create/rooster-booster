const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');

const execAsync = promisify(exec);
const pipelineAsync = promisify(pipeline);

function getS3Client() {
  const endpoint = process.env.B2_ENDPOINT;
  if (!endpoint) throw new Error('B2_ENDPOINT environment variable is required');

  return new S3Client({
    endpoint: endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`,
    region: 'us-east-1', // B2 requires a region value; the actual region is set via endpoint
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
    forcePathStyle: true, // required for B2 S3-compatible API
  });
}

async function runBackup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');

  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) throw new Error('B2_BUCKET_NAME environment variable is required');

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const filename = `roofmiles-${today}.sql.gz`;
  const tmpPath = path.join(require('os').tmpdir(), filename);

  // Step 1: pg_dump to compressed file
  console.log(`[backup] Starting pg_dump → ${tmpPath}`);
  try {
    await new Promise((resolve, reject) => {
      const dumpProc = require('child_process').spawn('pg_dump', ['--no-password', dbUrl], {
        env: { ...process.env },
      });
      const gzip = zlib.createGzip();
      const outStream = fs.createWriteStream(tmpPath);

      dumpProc.stdout.pipe(gzip).pipe(outStream);

      dumpProc.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.warn(`[backup] pg_dump stderr: ${msg}`);
      });

      dumpProc.on('error', (err) => reject(new Error(`pg_dump spawn failed: ${err.message}`)));
      dumpProc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`pg_dump exited with code ${code}`));
        outStream.on('finish', resolve);
        outStream.on('error', reject);
      });
    });
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw new Error(`pg_dump failed: ${err.message}`);
  }
  console.log(`[backup] pg_dump complete`);

  // Step 2: Upload to B2
  console.log(`[backup] Uploading ${filename} to B2 bucket "${bucketName}"`);
  const s3 = getS3Client();
  try {
    const fileStream = fs.createReadStream(tmpPath);
    const stat = fs.statSync(tmpPath);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: fileStream,
      ContentType: 'application/gzip',
      ContentLength: stat.size,
    }));
  } catch (err) {
    console.error(`[backup] Upload failed: ${err.message}`);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw err;
  }
  console.log(`[backup] Upload complete`);

  // Step 3: Delete local temp file
  fs.unlinkSync(tmpPath);
  console.log(`[backup] Local temp file deleted`);

  // Step 4: Delete backups older than 30 days
  console.log(`[backup] Checking for old backups in bucket`);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);

  let oldCount = 0;
  try {
    const listResult = await s3.send(new ListObjectsV2Command({ Bucket: bucketName }));
    const objects = listResult.Contents || [];

    for (const obj of objects) {
      const match = obj.Key.match(/^roofmiles-(\d{4}-\d{2}-\d{2})\.sql\.gz$/);
      if (!match) continue;
      const fileDate = new Date(match[1]);
      if (fileDate < cutoff) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key }));
          console.log(`[backup] Deleted old backup: ${obj.Key}`);
          oldCount++;
        } catch (delErr) {
          console.error(`[backup] Failed to delete ${obj.Key}: ${delErr.message}`);
        }
      }
    }
  } catch (listErr) {
    console.error(`[backup] Failed to list bucket objects: ${listErr.message}`);
  }

  console.log(`[backup] Deleted ${oldCount} old backup(s). Backup complete.`);
}

// Support direct invocation: node server/utils/backup.js
if (require.main === module) {
  runBackup().catch((err) => {
    console.error(`[backup] Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runBackup };
