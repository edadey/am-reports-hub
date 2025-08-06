require('dotenv').config();

module.exports = {
  development: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/am_reports_hub_dev',
    dialect: 'postgres',
    logging: console.log,
  },
  test: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/am_reports_hub_test',
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};