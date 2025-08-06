const { Sequelize } = require('sequelize');
const models = require('../database/models');

class DatabaseService {
  constructor() {
    this.sequelize = models.sequelize;
    this.models = models;
    this.isConnected = false;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing Database Service...');
      
      // Test the connection
      await this.sequelize.authenticate();
      console.log('✅ Database connection established successfully');
      
      // Sync models (in development only)
      if (process.env.NODE_ENV === 'development') {
        await this.sequelize.sync({ alter: true });
        console.log('✅ Database models synchronized');
      }
      
      this.isConnected = true;
      console.log('✅ Database Service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Unable to connect to the database:', error);
      throw error;
    }
  }

  async runMigrations() {
    try {
      console.log('🔄 Running database migrations...');
      
      // In production, migrations should be run separately
      // For development, we'll use sync for now
      if (process.env.NODE_ENV === 'development') {
        await this.sequelize.sync({ force: false, alter: true });
        console.log('✅ Database schema updated');
      } else {
        console.log('ℹ️ Migrations should be run separately in production');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async close() {
    try {
      await this.sequelize.close();
      this.isConnected = false;
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
      throw error;
    }
  }

  // Utility methods for common operations
  async transaction(callback) {
    return await this.sequelize.transaction(callback);
  }

  async query(sql, options = {}) {
    return await this.sequelize.query(sql, {
      type: Sequelize.QueryTypes.SELECT,
      ...options,
    });
  }

  // Health check
  async healthCheck() {
    try {
      await this.sequelize.authenticate();
      return {
        status: 'healthy',
        connected: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = {};
      
      // Get table counts
      for (const modelName of Object.keys(this.models)) {
        if (this.models[modelName].count) {
          stats[modelName.toLowerCase() + 'Count'] = await this.models[modelName].count();
        }
      }
      
      // Database size (PostgreSQL specific)
      const sizeResult = await this.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      
      stats.databaseSize = sizeResult[0]?.size || 'Unknown';
      stats.timestamp = new Date().toISOString();
      
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = new DatabaseService();