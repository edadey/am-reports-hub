require('dotenv').config();
const { Sequelize } = require('sequelize');

async function checkRailwayDatabase() {
  console.log('🔍 Checking Railway Database...');
  
  const sequelize = new Sequelize(process.env.DATABASE_URL || "postgresql://postgres:xzJOOBjImKzaNvULNeYOvQPddkwfFSix@switchback.proxy.rlwy.net:26380/railway", {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
    },
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to Railway database');
    
    // List all tables
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Database Tables:');
    if (tables[0].length === 0) {
      console.log('❌ No tables found in the database');
    } else {
      tables[0].forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
    
    // Check for backup-related tables
    const backupTables = tables[0].filter(table => 
      table.table_name.toLowerCase().includes('backup') ||
      table.table_name.toLowerCase().includes('cloud') ||
      table.table_name.toLowerCase().includes('storage')
    );
    
    if (backupTables.length > 0) {
      console.log('\n☁️ Backup-related tables found:');
      backupTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
      // Check data in backup tables
      for (const table of backupTables) {
        const count = await sequelize.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        console.log(`  📊 ${table.table_name}: ${count[0][0].count} records`);
        
        if (count[0][0].count > 0) {
          const sample = await sequelize.query(`SELECT * FROM "${table.table_name}" LIMIT 3`);
          console.log(`  📝 Sample data from ${table.table_name}:`);
          sample[0].forEach((row, index) => {
            console.log(`    ${index + 1}. ${JSON.stringify(row, null, 2)}`);
          });
        }
      }
    }
    
    // Check for college data
    const collegeTables = tables[0].filter(table => 
      table.table_name.toLowerCase().includes('college') ||
      table.table_name.toLowerCase().includes('account') ||
      table.table_name.toLowerCase().includes('user')
    );
    
    if (collegeTables.length > 0) {
      console.log('\n🏫 College/User-related tables found:');
      collegeTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
      // Check data in college tables
      for (const table of collegeTables) {
        const count = await sequelize.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        console.log(`  📊 ${table.table_name}: ${count[0][0].count} records`);
      }
    }
    
    await sequelize.close();
    console.log('\n✅ Railway database check completed');
    
  } catch (error) {
    console.error('❌ Error checking Railway database:', error.message);
    process.exit(1);
  }
}

checkRailwayDatabase(); 