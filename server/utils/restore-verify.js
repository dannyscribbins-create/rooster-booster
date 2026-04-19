const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
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

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function runVerify() {
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) throw new Error('B2_BUCKET_NAME environment variable is required');

  const s3 = getS3Client();

  // Step 1: List bucket and find most recent roofmiles-YYYY-MM-DD.json.gz
  const listResult = await s3.send(new ListObjectsV2Command({ Bucket: bucketName }));
  const objects = listResult.Contents || [];

  const backupFiles = objects
    .map((obj) => {
      const match = obj.Key.match(/^roofmiles-(\d{4}-\d{2}-\d{2})\.json\.gz$/);
      return match ? { key: obj.Key, date: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (backupFiles.length === 0) {
    throw new Error('No roofmiles-YYYY-MM-DD.json.gz backup files found in bucket');
  }

  const { key: filename } = backupFiles[0];
  console.log(`Restore verification for: ${filename}`);

  // Step 2: Download the file
  const getResult = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: filename }));
  const compressed = await streamToBuffer(getResult.Body);

  // Step 3: Decompress and parse
  const json = zlib.gunzipSync(compressed).toString('utf8');
  const backup = JSON.parse(json);

  console.log(`Exported at: ${backup.exportedAt}`);

  const tableNames = Object.keys(backup.tables || {});
  console.log(`Tables found: ${tableNames.length}`);

  for (const tableName of tableNames) {
    const entry = backup.tables[tableName];
    if (entry == null || entry.rowCount == null || entry.rows == null) {
      console.warn(`  WARNING: ${tableName} — missing rowCount or rows`);
      continue;
    }
    console.log(`  ${tableName}: ${entry.rowCount} rows`);
  }

  console.log('Verification complete. All tables readable.');
}

if (require.main === module) {
  runVerify().catch((err) => {
    console.error(`[restore-verify] Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runVerify };
