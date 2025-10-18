const { MongoClient } = require('mongodb');

async function testConnection() {
  console.log('🧪 Testing MongoDB Connection...\n');
  
  const uri = 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    console.log('1. Connecting to MongoDB...');
    await client.connect();
    console.log('✅ SUCCESS: Connected to MongoDB server');

    console.log('2. Listing databases...');
    const databases = await client.db().admin().listDatabases();
    console.log('✅ SUCCESS: Found databases:', databases.databases.map(db => db.name));

    console.log('3. Testing link-shortener database...');
    const db = client.db('link-shortener');
    const collections = await db.listCollections().toArray();
    console.log('✅ SUCCESS: Database accessible');
    console.log('   Collections:', collections.map(col => col.name));

    console.log('\n🎉 MongoDB is working perfectly!');
    
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    
    if (error.name === 'MongoServerSelectionError') {
      console.log('\n💡 Solution:');
      console.log('   MongoDB service might not be running properly.');
      console.log('   Try: net stop MongoDB && net start MongoDB');
    }
  } finally {
    await client.close();
  }
}

testConnection();