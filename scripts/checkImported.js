const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Job = require('../models/Job');
const JobSource = require('../models/JobSource');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mission_hub', { serverSelectionTimeoutMS: 15000 });

  const stats = await Job.aggregate([
    { $group: { _id: '$source.key', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }
  ]);
  console.log('By source:', JSON.stringify(stats));

  const total = await Job.countDocuments();
  const imported = await Job.countDocuments({ 'source.key': { $ne: null } });
  console.log('Total jobs:', total, '| Imported:', imported);

  const sources = await JobSource.find().lean();
  console.log('Sources:', sources.map(s => ({ key: s.key, enabled: s.enabled, lastStatus: s.lastStatus, lastJobCount: s.lastJobCount, totalImported: s.totalImported })));

  const samples = await Job.find({ 'source.key': { $ne: null } }).sort({ createdAt: -1 }).limit(3).lean();
  for (const j of samples) {
    console.log(`\nSAMPLE [${j.source.key}]`, JSON.stringify({
      title: j.title, company: j.company, type: j.type, category: j.category,
      location: j.location, experience: j.experience, deadline: j.deadline,
      posted: j.createdAt, image: j.image ? 'yes' : 'no', source: j.source
    }, null, 1));
  }
  setTimeout(() => process.exit(0), 300);
}
main().catch(e => { console.error('ERR', e.message); setTimeout(() => process.exit(1), 300); });
