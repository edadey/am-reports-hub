const DatabaseService = require('./DatabaseService');
const { User, AccountManager, College, Report, Session, SecurityLog } = require('../database/models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class DatabaseUserManager {
  constructor() {
    this.db = DatabaseService;
    this.models = { User, AccountManager, College, Report, Session, SecurityLog };
  }

  async initialize() {
    if (!this.db.isConnected) {
      await this.db.initialize();
    }
  }

  // User Management
  async createUser(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await User.create({
        ...userData,
        password: hashedPassword,
      });
      return user.toJSON();
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUsers() {
    try {
      const users = await User.findAll({
        include: [{
          model: AccountManager,
          as: 'accountManager',
        }],
        order: [['createdAt', 'DESC']],
      });
      return users.map(user => user.toJSON());
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  async getUserById(id) {
    try {
      const user = await User.findByPk(id, {
        include: [{
          model: AccountManager,
          as: 'accountManager',
        }],
      });
      return user ? user.toJSON() : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      const user = await User.findOne({
        where: { email },
        include: [{
          model: AccountManager,
          as: 'accountManager',
        }],
      });
      return user ? user.toJSON() : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async updateUser(id, updates) {
    try {
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }
      
      const [updatedRowsCount] = await User.update(updates, {
        where: { id },
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('User not found');
      }
      
      return await this.getUserById(id);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(id) {
    try {
      const deletedRowsCount = await User.destroy({
        where: { id },
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('User not found');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Account Manager Management
  async createAccountManager(managerData) {
    try {
      const manager = await AccountManager.create(managerData);
      return manager.toJSON();
    } catch (error) {
      console.error('Error creating account manager:', error);
      throw error;
    }
  }

  async getAccountManagers() {
    try {
      const managers = await AccountManager.findAll({
        include: [{
          model: User,
          as: 'users',
        }, {
          model: College,
          as: 'colleges',
        }],
        order: [['name', 'ASC']],
      });
      return managers.map(manager => manager.toJSON());
    } catch (error) {
      console.error('Error getting account managers:', error);
      throw error;
    }
  }

  async getAccountManagerById(id) {
    try {
      const manager = await AccountManager.findByPk(id, {
        include: [{
          model: User,
          as: 'users',
        }, {
          model: College,
          as: 'colleges',
        }],
      });
      return manager ? manager.toJSON() : null;
    } catch (error) {
      console.error('Error getting account manager by ID:', error);
      throw error;
    }
  }

  async updateAccountManager(id, updates) {
    try {
      const [updatedRowsCount] = await AccountManager.update(updates, {
        where: { id },
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Account Manager not found');
      }
      
      return await this.getAccountManagerById(id);
    } catch (error) {
      console.error('Error updating account manager:', error);
      throw error;
    }
  }

  async deleteAccountManager(id) {
    try {
      // First, detach any colleges referencing this manager
      await College.update({ accountManagerId: null }, { where: { accountManagerId: id } });

      const deletedRowsCount = await AccountManager.destroy({
        where: { id },
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Account Manager not found');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting account manager:', error);
      throw error;
    }
  }

  // College Management
  async createCollege(collegeData) {
    try {
      // Normalise incoming field names and shapes to match database attributes
      const normalised = { ...collegeData };

      // Transform simple fields into structured ones where necessary
      // superUsers from comma-separated string → array of objects
      if (typeof normalised.superUsers === 'string') {
        normalised.superUsers = normalised.superUsers
          .split(',')
          .map(name => ({ name: (name || '').trim(), position: '', email: '' }))
          .filter(user => user.name);
      } else if (Array.isArray(normalised.superUsers)) {
        normalised.superUsers = normalised.superUsers
          .map(user => {
            if (typeof user === 'string') {
              return { name: user.trim(), position: '', email: '' };
            }
            return {
              name: (user?.name || '').trim(),
              position: (user?.position || '').trim(),
              email: (user?.email || '').trim(),
            };
          })
          .filter(user => user.name);
      }

      // Single keyStakeholder → keyStakeholders array
      if (
        typeof normalised.keyStakeholder === 'string' &&
        (!normalised.keyStakeholders || normalised.keyStakeholders.length === 0)
      ) {
        const ksName = normalised.keyStakeholder.trim();
        if (ksName) {
          normalised.keyStakeholders = [{ name: ksName, position: '', email: '' }];
        }
      }

      // Map frontend camelCase fields to DB attribute names used by the model
      const fieldMap = {
        reportFrequency: 'reportfrequency',
        lastReportDate: 'lastreportdate',
        collegeSystem: 'collegesystem',
        dataTransferMethod: 'datatransfermethod',
        ofstedRating: 'ofstedrating',
        misContactName: 'miscontactname',
        misContactEmail: 'miscontactemail',
        renewalDate: 'renewaldate',
        keyStakeholders: 'keystakeholders',
        engagementLevel: 'engagementlevel',
        swotStrengths: 'swotstrengths',
        swotWeaknesses: 'swotweaknesses',
        swotOpportunities: 'swotopportunities',
        swotThreats: 'swotthreats',
        initialConcerns: 'initialconcerns',
      };

      // Special case: the Add form uses `misContact` for an email field
      if (typeof normalised.misContact === 'string' && !normalised.misContactEmail) {
        normalised.misContactEmail = normalised.misContact;
      }

      Object.entries(fieldMap).forEach(([from, to]) => {
        if (Object.prototype.hasOwnProperty.call(normalised, from)) {
          normalised[to] = normalised[from];
          delete normalised[from];
        }
      });

      // Defaults
      if (!normalised.reportfrequency) normalised.reportfrequency = 'weekly';
      if (!normalised.template) normalised.template = 'standard';
      if (!normalised.status) normalised.status = 'A';
      if (!normalised.ofstedrating) normalised.ofstedrating = 'G';
      if (!normalised.modules) normalised.modules = [];

      const college = await College.create(normalised);
      return college.toJSON();
    } catch (error) {
      console.error('Error creating college:', error);
      throw error;
    }
  }

  async getColleges() {
    try {
      const colleges = await College.findAll({
        include: [{
          model: AccountManager,
          as: 'accountManager',
        }],
        order: [['name', 'ASC']],
      });
      
      // Map colleges and ensure all expected fields exist with defaults
      return colleges.map(college => {
        const collegeData = college.toJSON();
        
        // Ensure all expected fields exist with defaults
        return {
          id: collegeData.id,
          name: collegeData.name || 'Unnamed College',
          numberOfProviders: collegeData.numberOfProviders || '',
          accountManagerId: collegeData.accountManagerId || null,
          keyContact: collegeData.keyContact || '',
          keyStakeholder: collegeData.keyStakeholder || '',
          superUsers: collegeData.superUsers || [],
          courses: collegeData.courses || [],
          placements: collegeData.placements || [],
          // Additional fields with defaults (matching database lowercase columns)
          misContact: collegeData.miscontact || '',
          dataTransferMethod: collegeData.datatransfermethod || '',
          status: collegeData.status || 'A',
          ofstedRating: collegeData.ofstedrating || 'G',
          reportFrequency: collegeData.reportfrequency || 'weekly',
          template: collegeData.template || 'standard',
          initialConcerns: collegeData.initialconcerns || '',
          lastReportDate: collegeData.lastreportdate || null,
          misContactName: collegeData.miscontactname || '',
          misContactEmail: collegeData.miscontactemail || '',
          collegeSystem: collegeData.collegesystem || '',
          renewalDate: collegeData.renewaldate || '',
          modules: collegeData.modules || [],
          keyStakeholders: collegeData.keystakeholders || [],
          engagementLevel: collegeData.engagementlevel || 'Good',
          swotStrengths: collegeData.swotstrengths || '',
          swotWeaknesses: collegeData.swotweaknesses || '',
          swotOpportunities: collegeData.swotopportunities || '',
          swotThreats: collegeData.swotthreats || '',
          createdAt: collegeData.createdAt || new Date(),
          updatedAt: collegeData.updatedAt || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting colleges:', error);
      throw error;
    }
  }

  async getCollegeById(id) {
    try {
      const college = await College.findByPk(id, {
        include: [{
          model: AccountManager,
          as: 'accountManager',
        }, {
          model: Report,
          as: 'reports',
          limit: 10,
          order: [['createdAt', 'DESC']],
        }],
      });
      return college ? college.toJSON() : null;
    } catch (error) {
      console.error('Error getting college by ID:', error);
      throw error;
    }
  }

  async updateCollege(id, updates) {
    try {
      // Normalise incoming field names to match database column attributes
      const normalised = { ...updates };

      // Ensure superUsers are saved in the expected array-of-objects shape
      if (Object.prototype.hasOwnProperty.call(normalised, 'superUsers')) {
        if (typeof normalised.superUsers === 'string') {
          normalised.superUsers = normalised.superUsers
            .split(',')
            .map(name => ({ name: (name || '').trim(), position: '', email: '' }))
            .filter(user => user.name);
        } else if (Array.isArray(normalised.superUsers)) {
          normalised.superUsers = normalised.superUsers
            .map(user => {
              if (typeof user === 'string') {
                return { name: user.trim(), position: '', email: '' };
              }
              return {
                name: (user?.name || '').trim(),
                position: (user?.position || '').trim(),
                email: (user?.email || '').trim(),
              };
            })
            .filter(user => user.name);
        }
      }

      // Mapping of frontend camelCase fields → database attribute names
      const fieldMap = {
        // Dates / frequency and system
        reportFrequency: 'reportfrequency',
        lastReportDate: 'lastreportdate',
        collegeSystem: 'collegesystem',
        // Contacts and misc (DB columns are lower-case without camelCase)
        misContact: 'miscontact',
        dataTransferMethod: 'datatransfermethod',
        ofstedRating: 'ofstedrating',
        initialConcerns: 'initialconcerns',
        // Extra metadata
        misContactName: 'miscontactname',
        misContactEmail: 'miscontactemail',
        renewalDate: 'renewaldate',
        // Arrays / JSON fields
        keyStakeholders: 'keystakeholders',
        engagementLevel: 'engagementlevel',
        swotStrengths: 'swotstrengths',
        swotWeaknesses: 'swotweaknesses',
        swotOpportunities: 'swotopportunities',
        swotThreats: 'swotthreats',
      };

      // Apply mapping
      Object.entries(fieldMap).forEach(([from, to]) => {
        if (Object.prototype.hasOwnProperty.call(normalised, from)) {
          normalised[to] = normalised[from];
          delete normalised[from];
        }
      });

      // Convert Date objects to ISO strings where applicable
      if (Object.prototype.hasOwnProperty.call(normalised, 'lastreportdate') && normalised.lastreportdate instanceof Date) {
        normalised.lastreportdate = normalised.lastreportdate.toISOString();
      }

      const [updatedRowsCount] = await College.update(normalised, {
        where: { id },
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('College not found');
      }
      
      return await this.getCollegeById(id);
    } catch (error) {
      console.error('Error updating college:', error);
      throw error;
    }
  }

  async deleteCollege(id) {
    try {
      const deletedRowsCount = await College.destroy({
        where: { id },
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('College not found');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting college:', error);
      throw error;
    }
  }

  async getCollegesByUser(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role === 'admin') {
        // Admin can see all colleges
        return await this.getColleges();
      } else {
        // Regular user can only see colleges managed by their account manager
        const colleges = await College.findAll({
          where: { accountManagerId: user.accountManagerId },
          include: [{
            model: AccountManager,
            as: 'accountManager',
          }],
          order: [['name', 'ASC']],
        });
        return colleges.map(college => college.toJSON());
      }
    } catch (error) {
      console.error('Error getting colleges by user:', error);
      throw error;
    }
  }

  // Report Management
  async createReport(reportData) {
    try {
      const report = await Report.create(reportData);
      return report.toJSON();
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  }

  async getReports(collegeId = null) {
    try {
      const whereClause = collegeId ? { collegeId } : {};
      const reports = await Report.findAll({
        where: whereClause,
        include: [{
          model: College,
          as: 'college',
        }],
        order: [['createdAt', 'DESC']],
      });
      return reports.map(report => report.toJSON());
    } catch (error) {
      console.error('Error getting reports:', error);
      throw error;
    }
  }

  async getReportById(id) {
    try {
      const report = await Report.findByPk(id, {
        include: [{
          model: College,
          as: 'college',
        }],
      });
      return report ? report.toJSON() : null;
    } catch (error) {
      console.error('Error getting report by ID:', error);
      throw error;
    }
  }

  async updateReport(id, updates) {
    try {
      const [updatedRowsCount] = await Report.update(updates, {
        where: { id },
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Report not found');
      }
      
      return await this.getReportById(id);
    } catch (error) {
      console.error('Error updating report:', error);
      throw error;
    }
  }

  async deleteReport(id) {
    try {
      const deletedRowsCount = await Report.destroy({
        where: { id },
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Report not found');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  // Authentication helpers
  async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(userId) {
    try {
      await User.update(
        { lastLogin: new Date() },
        { where: { id: userId } }
      );
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  // Statistics
  async getStats() {
    try {
      const stats = await this.db.getStats();
      return {
        users: stats.userCount || 0,
        accountManagers: stats.accountmanagerCount || 0,
        colleges: stats.collegeCount || 0,
        reports: stats.reportCount || 0,
        sessions: stats.sessionCount || 0,
        databaseSize: stats.databaseSize || 'Unknown',
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {};
    }
  }

  // Template Management using Report model with reportType: 'template'
  async getTemplates() {
    try {
      const templateReports = await Report.findAll({
        where: { 
          reportType: 'template',
          status: 'completed'
        },
        order: [['createdAt', 'DESC']],
      });
      
      // Transform report data back to template format
      return templateReports.map(report => ({
        id: report.data.id || report.id,
        name: report.name,
        description: report.data.description || '',
        headers: report.data.headers || [],
        tableData: report.data.tableData || [],
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        createdBy: report.createdBy,
        ...report.data // Include any additional template data
      }));
    } catch (error) {
      console.error('Error getting templates from database:', error);
      throw error;
    }
  }

  async saveTemplate(templateData) {
    try {
      const reportData = {
        name: templateData.name,
        reportType: 'template',
        data: templateData,
        createdBy: templateData.createdBy || 'system',
        status: 'completed',
        collegeId: null // Templates don't belong to specific colleges
      };

      // Check if template exists (by template ID in data field)
      const existingTemplate = await Report.findOne({
        where: {
          reportType: 'template',
          'data.id': templateData.id
        }
      });

      if (existingTemplate) {
        // Update existing template
        await existingTemplate.update(reportData);
        console.log(`✅ Template '${templateData.name}' updated in database`);
        return existingTemplate.toJSON();
      } else {
        // Create new template
        const newTemplate = await Report.create(reportData);
        console.log(`✅ Template '${templateData.name}' created in database`);
        return newTemplate.toJSON();
      }
    } catch (error) {
      console.error('Error saving template to database:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId) {
    try {
      const deletedCount = await Report.destroy({
        where: {
          reportType: 'template',
          'data.id': templateId
        }
      });
      
      if (deletedCount === 0) {
        throw new Error('Template not found');
      }
      
      console.log(`✅ Template with ID '${templateId}' deleted from database`);
      return true;
    } catch (error) {
      console.error('Error deleting template from database:', error);
      throw error;
    }
  }

  async saveTemplates(templates) {
    try {
      const results = [];
      for (const template of templates) {
        const result = await this.saveTemplate(template);
        results.push(result);
      }
      console.log(`✅ Batch saved ${results.length} templates to database`);
      return results;
    } catch (error) {
      console.error('Error batch saving templates to database:', error);
      throw error;
    }
  }

}

module.exports = new DatabaseUserManager();