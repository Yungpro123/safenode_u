// checkDbSpace.js
require('dotenv').config();
const mongoose = require('mongoose');

const DB_QUOTA_MB = 500; // your total DB allocation

async function checkDbSpace() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const stats = await db.stats();

    const usedMB = stats.storageSize / (1024 * 1024); // convert bytes to MB
    const remainingMB = DB_QUOTA_MB - usedMB;

    console.log('📊 Database Stats:');
    console.log(`- Database Name: ${stats.db}`);
    console.log(`- Collections: ${stats.collections}`);
    console.log(`- Objects (Documents): ${stats.objects}`);
    console.log(`- Data Size: ${(stats.dataSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Storage Size: ${(stats.storageSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Index Size: ${(stats.indexSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Avg Object Size: ${stats.avgObjSize ? stats.avgObjSize.toFixed(2) : 0} bytes`);
    console.log(`- Remaining Space (out of ${DB_QUOTA_MB} MB): ${remainingMB.toFixed(3)} MB`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkDbSpace();