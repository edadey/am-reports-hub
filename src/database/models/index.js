const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Build database URL from individual components if DATABASE_URL is not working
function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Fallback to individual PostgreSQL environment variables
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  const database = process.env.PGDATABASE || 'am_reports_hub';
  const username = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || '';
  
  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

// Database connection with Railway-specific configuration
const sequelize = new Sequelize(buildDatabaseUrl(), {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
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

// Import models
const models = {};
const basename = path.basename(__filename);

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    models[model.name] = model;
  });

// Associate models
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;