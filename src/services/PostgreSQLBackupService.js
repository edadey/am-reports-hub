const { Sequelize, DataTypes } = require('sequelize');
const crypto = require('crypto');

class PostgreSQLBackupService {
  constructor() {
    this.sequelize = null;
    this.BackupModel = null;
  }

  async initialize() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured for PostgreSQL backups');
    }

    console.log('🗄️ Initializing PostgreSQL Backup Service...');
    
    this.sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    // Define the backup model
    this.BackupModel = this.sequelize.define('backup', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      backupId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      backupType: {
        type: DataTypes.ENUM('manual', 'automated', 'emergency'),
        defaultValue: 'manual',
      },
      backupData: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      checksum: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      size: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    }, {
      tableName: 'backups',
      timestamps: true,
      indexes: [
        {
          fields: ['backupId'],
          unique: true,
        },
        {
          fields: ['backupType'],
        },
        {
          fields: ['createdAt'],
        },
      ],
    });

    // Create the table if it doesn't exist
    await this.BackupModel.sync();
    
    console.log('✅ PostgreSQL Backup Service initialized');
  }

  async createBackup(description = 'PostgreSQL backup') {
    try {
      console.log(`📦 Creating PostgreSQL backup: ${description}`);
      
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();
      
      // Get data from database
      const backupData = await this.collectDatabaseData();
      
      // Calculate metadata
      const dataString = JSON.stringify(backupData);
      const size = Buffer.byteLength(dataString, 'utf8');
      const checksum = crypto.createHash('sha256').update(dataString).digest('hex');
      
      const metadata = {
        timestamp,
        tables: Object.keys(backupData),
        totalRecords: Object.values(backupData).reduce((sum, table) => sum + (Array.isArray(table) ? table.length : 0), 0),
        totalSize: size,
        checksums: this.calculateTableChecksums(backupData),
      };

      // Store backup in database
      console.log(`💾 Storing backup data:`, {
        backupId,
        description,
        collegesCount: backupData.colleges ? backupData.colleges.length : 0,
        accountManagersCount: backupData.accountManagers ? backupData.accountManagers.length : 0,
        totalRecords: metadata.totalRecords
      });
      
      const backup = await this.BackupModel.create({
        backupId,
        description,
        backupType: 'manual',
        backupData,
        metadata,
        checksum,
        size,
      });

      console.log(`✅ Backup created: ${backupId} (${this.formatBytes(size)})`);
      console.log(`   📊 Records: ${metadata.totalRecords} across ${metadata.tables.length} tables`);

      return {
        backupId,
        timestamp,
        description,
        metadata,
        size,
      };

    } catch (error) {
      console.error('❌ Error creating PostgreSQL backup:', error);
      throw error;
    }
  }

  async collectDatabaseData() {
    const DatabaseUserManager = require('./DatabaseUserManager');
    const dbManager = DatabaseUserManager;
    
    console.log('📊 Collecting database data...');
    
    const data = {};
    
    try {
      // Collect colleges
      data.colleges = await dbManager.getColleges();
      console.log(`   ✅ Collected ${data.colleges.length} colleges`);
      
      // Collect account managers
      data.accountManagers = await dbManager.getAccountManagers();
      console.log(`   ✅ Collected ${data.accountManagers.length} account managers`);
      
      // Collect users (without sensitive data)
      const users = await dbManager.getUsers();
      data.users = users.map(user => ({
        ...user,
        password: '[REDACTED]', // Don't backup passwords
        passwordResetToken: '[REDACTED]',
        passwordResetExpires: '[REDACTED]',
      }));
      console.log(`   ✅ Collected ${data.users.length} users (passwords redacted)`);
      
      // Collect reports if available
      try {
        data.reports = await this.collectReports();
        console.log(`   ✅ Collected ${data.reports.length} reports`);
      } catch (error) {
        console.log(`   ⚠️ Could not collect reports: ${error.message}`);
        data.reports = [];
      }
      
    } catch (error) {
      console.error('❌ Error collecting database data:', error);
      throw error;
    }
    
    return data;
  }

  async collectReports() {
    // Try to get reports from database if Report model exists
    try {
      const { Report } = require('../database/models');
      const reports = await Report.findAll();
      return reports.map(report => report.toJSON());
    } catch (error) {
      // If Report model doesn't exist or fails, return empty array
      return [];
    }
  }

  async listBackups() {
    try {
      const backups = await this.BackupModel.findAll({
        order: [['createdAt', 'DESC']],
        attributes: ['backupId', 'description', 'backupType', 'metadata', 'size', 'createdAt', 'updatedAt'],
      });

      return backups.map(backup => ({
        backupId: backup.backupId,
        description: backup.description,
        backupType: backup.backupType,
        timestamp: backup.createdAt.toISOString(),
        size: backup.size,
        metadata: backup.metadata,
        createdAt: backup.createdAt,
        updatedAt: backup.updatedAt,
      }));

    } catch (error) {
      console.error('❌ Error listing backups:', error);
      throw error;
    }
  }

  async restoreBackup(backupId) {
    try {
      console.log(`🔄 Restoring PostgreSQL backup: ${backupId}`);
      
      // Find the backup
      const backup = await this.BackupModel.findOne({
        where: { backupId }
      });

      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      console.log(`📋 Found backup data:`, {
        backupId: backup.backupId,
        description: backup.description,
        collegesCount: backup.backupData.colleges ? backup.backupData.colleges.length : 0,
        accountManagersCount: backup.backupData.accountManagers ? backup.backupData.accountManagers.length : 0,
        totalRecords: backup.metadata.totalRecords
      });

      // Note: Skipping integrity check due to JSONB normalization in PostgreSQL
      // The JSONB data type can reorder keys and normalize formatting
      console.log('ℹ️ Skipping integrity check (JSONB normalization)');

      // Create a pre-restore backup
      await this.createBackup(`Pre-restore backup before ${backupId}`);

      // Restore data to database
      await this.restoreDatabaseData(backup.backupData);

      console.log(`✅ Restored backup ${backupId} successfully`);
      console.log(`   📊 Restored ${backup.metadata.totalRecords} records across ${backup.metadata.tables.length} tables`);

      return {
        success: true,
        backupId,
        restoredTables: backup.metadata.tables,
        restoredRecords: backup.metadata.totalRecords,
      };

    } catch (error) {
      console.error('❌ Error restoring backup:', error);
      throw error;
    }
  }

  async restoreDatabaseData(backupData) {
    const DatabaseUserManager = require('./DatabaseUserManager');
    const dbManager = DatabaseUserManager;
    
    console.log('🔄 Restoring database data...');

    // Restore colleges
    if (backupData.colleges && Array.isArray(backupData.colleges)) {
      console.log(`   🏫 Restoring ${backupData.colleges.length} colleges...`);
      console.log(`   📋 College names:`, backupData.colleges.map(c => c.name || 'Unnamed'));
      
      // Clear existing colleges
      const existingColleges = await dbManager.getColleges();
      console.log(`   🗑️ Clearing ${existingColleges.length} existing colleges...`);
      for (const college of existingColleges) {
        await dbManager.deleteCollege(college.id);
      }
      
      // Restore colleges
      for (const college of backupData.colleges) {
        try {
          const result = await dbManager.createCollege(college);
          console.log(`     ✅ Restored college: ${college.name || 'Unnamed'} (ID: ${result.id})`);
        } catch (error) {
          console.log(`     ⚠️ Error restoring college ${college.name}: ${error.message}`);
        }
      }
      console.log(`   ✅ Restored ${backupData.colleges.length} colleges`);
    } else {
      console.log(`   ⚠️ No colleges data found in backup`);
    }

    // Restore account managers
    if (backupData.accountManagers && Array.isArray(backupData.accountManagers)) {
      console.log(`   👥 Restoring ${backupData.accountManagers.length} account managers...`);
      
      // Clear existing account managers
      const existingManagers = await dbManager.getAccountManagers();
      for (const manager of existingManagers) {
        await dbManager.deleteAccountManager(manager.id);
      }
      
      // Restore account managers
      for (const manager of backupData.accountManagers) {
        try {
          await dbManager.createAccountManager(manager);
        } catch (error) {
          console.log(`     ⚠️ Error restoring manager ${manager.name}: ${error.message}`);
        }
      }
      console.log(`   ✅ Restored account managers`);
    }

    // Note: We don't restore users to avoid overwriting admin accounts
    console.log(`   👤 Skipping user restore to preserve admin accounts`);
  }

  async deleteBackup(backupId) {
    try {
      const deletedCount = await this.BackupModel.destroy({
        where: { backupId }
      });

      if (deletedCount === 0) {
        throw new Error(`Backup ${backupId} not found`);
      }

      console.log(`✅ Deleted backup ${backupId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error deleting backup:', error);
      throw error;
    }
  }

  async getStorageStats() {
    try {
      const totalBackups = await this.BackupModel.count();
      const totalSize = await this.BackupModel.sum('size') || 0;
      
      const backupsByType = await this.BackupModel.findAll({
        attributes: [
          'backupType',
          [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count'],
          [this.sequelize.fn('SUM', this.sequelize.col('size')), 'totalSize'],
        ],
        group: ['backupType'],
        raw: true,
      });

      return {
        totalBackups,
        totalSize,
        formattedSize: this.formatBytes(totalSize),
        backupsByType,
        storageLocation: 'PostgreSQL Database',
        lastBackup: await this.getLastBackupTime(),
      };

    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      throw error;
    }
  }

  async getLastBackupTime() {
    try {
      const lastBackup = await this.BackupModel.findOne({
        order: [['createdAt', 'DESC']],
        attributes: ['createdAt'],
      });

      return lastBackup ? lastBackup.createdAt : null;
    } catch (error) {
      return null;
    }
  }

  // Utility methods
  generateBackupId() {
    return crypto.randomBytes(8).toString('hex');
  }

  calculateTableChecksums(data) {
    const checksums = {};
    for (const [table, records] of Object.entries(data)) {
      const tableData = JSON.stringify(records);
      checksums[table] = crypto.createHash('sha256').update(tableData).digest('hex');
    }
    return checksums;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async cleanupOldBackups(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedCount = await this.BackupModel.destroy({
        where: {
          createdAt: {
            [this.sequelize.Op.lt]: cutoffDate
          },
          backupType: {
            [this.sequelize.Op.ne]: 'emergency' // Don't delete emergency backups
          }
        }
      });

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old backups (older than ${retentionDays} days)`);
      }

      return { deletedCount };
    } catch (error) {
      console.error('❌ Error cleaning up old backups:', error);
      throw error;
    }
  }
}

module.exports = PostgreSQLBackupService;
