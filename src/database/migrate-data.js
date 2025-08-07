const fs = require('fs-extra');
const path = require('path');
const DatabaseService = require('../services/DatabaseService');
const models = require('./models');

class DataMigration {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data');
    this.reportsPath = path.join(this.dataPath, 'reports');
    this.dbService = DatabaseService;
  }

  async run() {
    try {
      console.log('🔄 Starting data migration from JSON to PostgreSQL...');
      
      // Initialize database connection
      await this.dbService.initialize();
      
      // Run migrations in order (due to foreign key constraints)
      await this.migrateAccountManagers();
      await this.migrateUsers();
      await this.migrateColleges();
      await this.migrateReports();
      
      console.log('✅ Data migration completed successfully!');
      
      // Show migration summary
      await this.showMigrationSummary();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateAccountManagers() {
    console.log('📁 Migrating Account Managers...');
    
    const filePath = path.join(this.dataPath, 'accountManagers.json');
    if (!await fs.pathExists(filePath)) {
      console.log('⚠️ No accountManagers.json found, skipping...');
      return;
    }
    
    const accountManagers = await fs.readJson(filePath);
    let migrated = 0;
    
    for (const am of accountManagers) {
      try {
        await models.AccountManager.create({
          id: am.id,
          name: am.name,
          email: am.email,
          phone: am.phone || null,
          region: am.region || null,
          createdAt: am.createdAt ? new Date(am.createdAt) : new Date(),
          updatedAt: new Date(),
        });
        migrated++;
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          console.log(`   ⚠️ Account Manager ${am.name} already exists, skipping...`);
        } else {
          console.error(`   ❌ Error migrating Account Manager ${am.name}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Migrated ${migrated} Account Managers`);
  }

  async migrateUsers() {
    console.log('👥 Migrating Users...');
    
    const filePath = path.join(this.dataPath, 'users.json');
    if (!await fs.pathExists(filePath)) {
      console.log('⚠️ No users.json found, skipping...');
      return;
    }
    
    const users = await fs.readJson(filePath);
    let migrated = 0;
    
    for (const user of users) {
      try {
        await models.User.create({
          id: user.id,
          username: user.username,
          email: user.email,
          password: user.password,
          role: user.role,
          name: user.name,
          accountManagerId: user.accountManagerId,
          isActive: user.isActive !== undefined ? user.isActive : true,
          lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          updatedAt: new Date(),
        });
        migrated++;
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          console.log(`   ⚠️ User ${user.username} already exists, skipping...`);
        } else {
          console.error(`   ❌ Error migrating User ${user.username}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Migrated ${migrated} Users`);
  }

  async migrateColleges() {
    console.log('🏫 Migrating Colleges...');
    
    const filePath = path.join(this.dataPath, 'colleges.json');
    if (!await fs.pathExists(filePath)) {
      console.log('⚠️ No colleges.json found, skipping...');
      return;
    }
    
    const colleges = await fs.readJson(filePath);
    let migrated = 0;
    
    for (const college of colleges) {
      try {
        await models.College.create({
          id: college.id,
          name: college.name,
          numberOfProviders: college.numberOfProviders,
          accountManagerId: college.accountManagerId,
          keyContact: college.keyContact,
          keyStakeholder: college.keyStakeholder,
          superUsers: college.superUsers || [],
          courses: college.courses || [],
          placements: college.placements || [],
          // Additional fields
          misContact: college.misContact || '',
          dataTransferMethod: college.dataTransferMethod || '',
          status: college.status || 'A',
          ofstedRating: college.ofstedRating || 'G',
          reportFrequency: college.reportFrequency || 'weekly',
          template: college.template || 'standard',
          initialConcerns: college.initialConcerns || '',
          lastReportDate: college.lastReportDate ? new Date(college.lastReportDate) : null,
          misContactName: college.misContactName || '',
          misContactEmail: college.misContactEmail || '',
          renewalDate: college.renewalDate || '',
          modules: college.modules || [],
          keyStakeholders: college.keyStakeholders || [],
          engagementLevel: college.engagementLevel || 'Good',
          swotStrengths: college.swotStrengths || '',
          swotWeaknesses: college.swotWeaknesses || '',
          swotOpportunities: college.swotOpportunities || '',
          swotThreats: college.swotThreats || '',
          createdAt: college.createdAt ? new Date(college.createdAt) : new Date(),
          updatedAt: new Date(),
        });
        migrated++;
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          console.log(`   ⚠️ College ${college.name} already exists, skipping...`);
        } else {
          console.error(`   ❌ Error migrating College ${college.name}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Migrated ${migrated} Colleges`);
  }

  async migrateReports() {
    console.log('📊 Migrating Reports...');
    
    if (!await fs.pathExists(this.reportsPath)) {
      console.log('⚠️ No reports directory found, skipping...');
      return;
    }
    
    const reportFiles = await fs.readdir(this.reportsPath);
    let migrated = 0;
    
    for (const filename of reportFiles) {
      if (!filename.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(this.reportsPath, filename);
        const reports = await fs.readJson(filePath);
        
        // Handle both single report and array of reports
        const reportsArray = Array.isArray(reports) ? reports : [reports];
        
        for (const report of reportsArray) {
          try {
            // Try to find the college by name or ID
            let collegeId = null;
            if (report.collegeName) {
              const college = await models.College.findOne({
                where: { name: report.collegeName }
              });
              collegeId = college ? college.id : null;
            }
            
            await models.Report.create({
              id: report.id,
              name: report.name,
              collegeId: collegeId,
              data: report.data || {},
              summary: report.summary,
              createdBy: report.createdBy || 'system',
              validationChecksum: report.validationChecksum,
              validationTime: report.validationTime ? new Date(report.validationTime) : null,
              reportType: report.reportType || 'general',
              status: report.status || 'completed',
              createdAt: report.createdAt ? new Date(report.createdAt) : new Date(),
              updatedAt: new Date(),
            });
            migrated++;
          } catch (error) {
            console.error(`   ❌ Error migrating report ${report.id || 'unknown'}:`, error.message);
          }
        }
      } catch (error) {
        console.error(`   ❌ Error reading report file ${filename}:`, error.message);
      }
    }
    
    console.log(`   ✅ Migrated ${migrated} Reports`);
  }

  async showMigrationSummary() {
    console.log('\n📊 Migration Summary:');
    
    const stats = await this.dbService.getStats();
    
    console.log(`   Account Managers: ${stats.accountmanagerCount || 0}`);
    console.log(`   Users: ${stats.userCount || 0}`);
    console.log(`   Colleges: ${stats.collegeCount || 0}`);
    console.log(`   Reports: ${stats.reportCount || 0}`);
    console.log(`   Database Size: ${stats.databaseSize || 'Unknown'}`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    await this.dbService.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new DataMigration();
  migration.run()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = DataMigration;