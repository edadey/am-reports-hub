const { Sequelize } = require('sequelize');

// This script should be run on Railway to migrate the database
async function runMigration() {
  console.log('🚀 Starting Railway database migration...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('This script must be run on Railway with DATABASE_URL configured.');
    process.exit(1);
  }

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Add missing columns to colleges table
    const queryInterface = sequelize.getQueryInterface();
    
    console.log('🔄 Adding missing columns to colleges table...');
    
    const columnsToAdd = [
      { name: 'misContact', type: 'VARCHAR(255)' },
      { name: 'dataTransferMethod', type: 'VARCHAR(255)' },
      { name: 'status', type: 'VARCHAR(255) DEFAULT \'A\'' },
      { name: 'ofstedRating', type: 'VARCHAR(255) DEFAULT \'G\'' },
      { name: 'reportFrequency', type: 'VARCHAR(255) DEFAULT \'weekly\'' },
      { name: 'template', type: 'VARCHAR(255) DEFAULT \'standard\'' },
      { name: 'initialConcerns', type: 'TEXT' },
      { name: 'lastReportDate', type: 'TIMESTAMP' },
      { name: 'misContactName', type: 'VARCHAR(255)' },
      { name: 'misContactEmail', type: 'VARCHAR(255)' },
      { name: 'renewalDate', type: 'VARCHAR(255)' },
      { name: 'modules', type: 'JSONB DEFAULT \'[]\'' },
      { name: 'keyStakeholders', type: 'JSONB DEFAULT \'[]\'' },
      { name: 'engagementLevel', type: 'VARCHAR(255) DEFAULT \'Good\'' },
      { name: 'swotStrengths', type: 'TEXT' },
      { name: 'swotWeaknesses', type: 'TEXT' },
      { name: 'swotOpportunities', type: 'TEXT' },
      { name: 'swotThreats', type: 'TEXT' }
    ];

    for (const column of columnsToAdd) {
      try {
        console.log(`Adding column: ${column.name}`);
        await sequelize.query(`ALTER TABLE colleges ADD COLUMN ${column.name} ${column.type};`);
        console.log(`✅ Added column: ${column.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️ Column ${column.name} already exists, skipping...`);
        } else {
          console.error(`❌ Error adding column ${column.name}:`, error.message);
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('🎉 College table now has all required fields.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔒 Database connection closed.');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = runMigration;
