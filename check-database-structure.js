const { Sequelize } = require('sequelize');

async function checkDatabaseStructure() {
  console.log('🔍 Checking database structure...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
  }

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
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

    // Check the colleges table structure
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'colleges' 
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Colleges table structure:');
    console.log('----------------------------------------');
    results.forEach(row => {
      console.log(`${row.column_name} | ${row.data_type} | ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} | ${row.column_default || 'no default'}`);
    });

    // Check if there are any colleges in the table
    const [collegeCount] = await sequelize.query('SELECT COUNT(*) as count FROM colleges;');
    console.log(`\n📈 Total colleges in database: ${collegeCount[0].count}`);

    // If there are colleges, show a sample
    if (collegeCount[0].count > 0) {
      const [sampleColleges] = await sequelize.query('SELECT id, name, "reportFrequency", status FROM colleges LIMIT 3;');
      console.log('\n📋 Sample colleges:');
      sampleColleges.forEach(college => {
        console.log(`- ID: ${college.id}, Name: ${college.name}, Frequency: ${college.reportFrequency}, Status: ${college.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('🔒 Database connection closed.');
  }
}

checkDatabaseStructure().catch(console.error);
