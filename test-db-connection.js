require('dotenv').config();
const { Sequelize } = require('sequelize');

async function testConnection() {
  console.log('🔍 Testing Database Connection...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('Please set DATABASE_URL in your Railway environment variables.');
    process.exit(1);
  }

  // Create a test connection
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
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
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    
    // Provide helpful debugging information
    if (error.message.includes('unsupported frontend protocol')) {
      console.log('\n💡 This error suggests a PostgreSQL client/server version mismatch.');
      console.log('Try updating your pg package: npm update pg');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Connection refused. Check if:');
      console.log('1. The DATABASE_URL is correct');
      console.log('2. The PostgreSQL service is running');
      console.log('3. The host and port are accessible');
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