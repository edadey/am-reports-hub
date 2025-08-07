require('dotenv').config();
const { Sequelize } = require('sequelize');

// Use the Railway DATABASE_URL directly for testing
const DATABASE_URL = 'postgresql://postgres:xzJ00BjImKzaNvULNeY0vQPddkwfFSix@postgres.railway.internal:5432/railway';

async function testConnection() {
  console.log('🔍 Testing Railway Database Connection...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('DATABASE_URL exists:', !!DATABASE_URL);
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not available!');
    process.exit(1);
  }

  // Create a test connection
  const sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    retry: {
      max: 3,
      timeout: 10000,
    },
  });

  try {
    // Test authentication
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await sequelize.query('SELECT version()');
    console.log('✅ Database version:', result[0][0].version);
    
    // Test if we can create a simple table (for testing)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Can create tables successfully');
    
    // Clean up test table
    await sequelize.query('DROP TABLE IF EXISTS connection_test');
    console.log('✅ Can drop tables successfully');
    
    await sequelize.close();
    console.log('✅ Connection test completed successfully!');
    console.log('');
    console.log('🚀 Your Railway PostgreSQL connection is working!');
    console.log('You can now deploy to Railway with confidence.');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    
    // Provide helpful debugging information
    if (error.message.includes('unsupported frontend protocol')) {
      console.log('\n💡 This error suggests a PostgreSQL client/server version mismatch.');
      console.log('Try updating your pg package: npm update pg');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Connection refused. This might be because:');
      console.log('1. The Railway PostgreSQL service is not accessible from your local machine');
      console.log('2. The internal Railway hostname is only accessible from within Railway');
      console.log('3. This is normal - Railway services are internal to Railway');
      console.log('');
      console.log('✅ The connection should work when deployed to Railway!');
    }
    
    if (error.message.includes('authentication failed')) {
      console.log('\n💡 Authentication failed. Check if:');
      console.log('1. The username and password in DATABASE_URL are correct');
      console.log('2. The database name exists');
    }
    
    process.exit(1);
  }
}

testConnection(); 