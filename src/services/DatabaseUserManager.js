const DatabaseService = require('./DatabaseService');
const { User, AccountManager, College, Report, Session, SecurityLog } = require('../database/models');
const bcrypt = require('bcrypt');
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
      const college = await College.create(collegeData);
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
      return colleges.map(college => college.toJSON());
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
      const [updatedRowsCount] = await College.update(updates, {
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
}

module.exports = new DatabaseUserManager();