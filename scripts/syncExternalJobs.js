const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const aggregator = require('../services/jobAggregatorService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mission_hub';

async function main() {
  const onlyArg = process.argv.find(a => a.startsWith('--source='));
  const sources = onlyArg ? onlyArg.split('=')[1].split(',').map(s => s.trim()) : undefined;

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const startedAt = Date.now();
  const results = await aggregator.syncAll({ sources });

  console.log('\n=== SYNC RESULTS ===');
  for (const r of results) {
    if (r.success) {
      console.log(`[OK] ${r.sourceKey}: found=${r.found} created=${r.created} updated=${r.updated} closed=${r.closed} (${r.duration}ms)`);
    } else {
      console.log(`[FAIL] ${r.sourceKey}: ${r.error}`);
    }
  }
  console.log(`\nTotal time: ${Date.now() - startedAt}ms`);

  try { await mongoose.connection.close(); } catch (e) {}
  setTimeout(() => process.exit(0), 500);
}

main().catch(async (e) => {
  console.error('Sync failed:', e.message);
  try { await mongoose.connection.close(); } catch (e2) {}
  setTimeout(() => process.exit(1), 500);
});
