const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
  const filename = `roofmiles-${today}.json.gz`;
  const tmpPath = path.join(require('os').tmpdir(), filename);

  // Step 1: Pure JS export — connect to DB, dump all tables to compressed JSON
  console.log(`[backup] Starting JS database export → ${tmpPath}`);
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const backup = {
      exportedAt: new Date().toISOString(),
      tables: {},
    };

    // Discover all tables dynamically — no hardcoded names
    const tablesResult = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const tableNames = tablesResult.rows.map((r) => r.table_name);
    console.log(`[backup] Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    for (const tableName of tableNames) {
      try {
        const result = await pool.query(`SELECT * FROM "${tableName}"`);
        backup.tables[tableName] = { rowCount: result.rowCount, rows: result.rows };
        console.log(`[backup] Exported ${tableName}: ${result.rowCount} rows`);
      } catch (tableErr) {
        console.error(`[backup] Failed to export table "${tableName}": ${tableErr.message}`);
        // Continue with remaining tables — do not abort the whole backup
      }
    }

    const json = JSON.stringify(backup);
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
    fs.writeFileSync(tmpPath, compressed);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw new Error(`Database export failed: ${err.message}`);
  } finally {
    await pool.end();
  }
  console.log(`[backup] Database export complete`);

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
      const match = obj.Key.match(/^roofmiles-(\d{4}-\d{2}-\d{2})\.json\.gz$/);
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
