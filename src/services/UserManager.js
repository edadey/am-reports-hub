const fs = require('fs-extra');
const path = require('path');

class UserManager {
  constructor() {
    this.usersFile = 'data/users.json';
    this.collegesFile = 'data/colleges.json';
    this.accountManagersFile = 'data/accountManagers.json';
    this.kpisFile = 'data/kpis.json';
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    fs.ensureDirSync('data');
  }

  async getUsers() {
    try {
      return await fs.readJson(this.usersFile);
    } catch (error) {
      return [];
    }
  }

  async getAccountManagers() {
    try {
      return await fs.readJson(this.accountManagersFile);
    } catch (error) {
      // Return default account managers if file doesn't exist
      return [
        { id: 1, name: "Account Manager 1", email: "am1@example.com" },
        { id: 2, name: "Account Manager 2", email: "am2@example.com" },
        { id: 3, name: "Account Manager 3", email: "am3@example.com" },
        { id: 4, name: "Account Manager 4", email: "am4@example.com" },
        { id: 5, name: "Account Manager 5", email: "am5@example.com" }
      ];
    }
  }

  async addAccountManager(accountManagerData) {
    try {
      if (!accountManagerData.name || !accountManagerData.email) {
        return { success: false, message: 'Name and email are required' };
      }
      
      const accountManagers = await this.getAccountManagers();
      const newAccountManager = {
        id: Date.now(),
        name: accountManagerData.name,
        email: accountManagerData.email,
        createdAt: new Date().toISOString()
      };
      
      accountManagers.push(newAccountManager);
      await fs.writeJson(this.accountManagersFile, accountManagers, { spaces: 2 });
      return { success: true, manager: newAccountManager };
    } catch (error) {
      console.error('Add account manager error:', error);
      return { success: false, message: 'Failed to add account manager' };
    }
  }

  async updateAccountManager(accountManagerId, updates) {
    try {
      const accountManagers = await this.getAccountManagers();
      const index = accountManagers.findIndex(am => am.id === parseInt(accountManagerId));
      if (index !== -1) {
        accountManagers[index] = { ...accountManagers[index], ...updates };
        await fs.writeJson(this.accountManagersFile, accountManagers, { spaces: 2 });
        return { success: true, manager: accountManagers[index] };
      }
      return { success: false, message: 'Account manager not found' };
    } catch (error) {
      console.error('Update account manager error:', error);
      return { success: false, message: 'Failed to update account manager' };
    }
  }

  async deleteAccountManager(accountManagerId) {
    try {
      const accountManagers = await this.getAccountManagers();
      const index = accountManagers.findIndex(am => am.id === parseInt(accountManagerId));
      if (index !== -1) {
        const filteredManagers = accountManagers.filter(am => am.id !== parseInt(accountManagerId));
        await fs.writeJson(this.accountManagersFile, filteredManagers, { spaces: 2 });
        return { success: true, message: 'Account manager deleted successfully' };
      }
      return { success: false, message: 'Account manager not found' };
    } catch (error) {
      console.error('Delete account manager error:', error);
      return { success: false, message: 'Failed to delete account manager' };
    }
  }

  async getColleges() {
    try {
      return await fs.readJson(this.collegesFile);
    } catch (error) {
      return [];
    }
  }

  async getCollege(collegeId) {
    const colleges = await this.getColleges();
    // Handle both string and number IDs
    return colleges.find(college => 
      college.id === parseInt(collegeId) || 
      college.id === collegeId || 
      college.id.toString() === collegeId
    );
  }

  async getCollegesByAccountManager(accountManagerId) {
    const colleges = await this.getColleges();
    return colleges.filter(college => college.accountManagerId === accountManagerId);
  }

  async addCollege(collegeData) {
    const colleges = await this.getColleges();
    const newCollege = {
      id: Date.now(),
      name: collegeData.name,
      numberOfProviders: collegeData.numberOfProviders,
      accountManagerId: collegeData.accountManagerId || null,
      keyStakeholder: collegeData.keyStakeholder,
      superUsers: collegeData.superUsers,
      misContact: collegeData.misContact,
      dataTransferMethod: collegeData.dataTransferMethod,
      status: collegeData.status,
      ofstedRating: collegeData.ofstedRating,
      reportFrequency: collegeData.reportFrequency,
      template: collegeData.template,
      initialConcerns: collegeData.initialConcerns,
      lastReportDate: null,
      createdAt: new Date().toISOString()
    };
    
    colleges.push(newCollege);
    await fs.writeJson(this.collegesFile, colleges, { spaces: 2 });
    return newCollege;
  }

  async updateCollege(collegeId, updates) {
    const colleges = await this.getColleges();
    const index = colleges.findIndex(c => c.id === collegeId);
    if (index !== -1) {
      colleges[index] = { ...colleges[index], ...updates };
      await fs.writeJson(this.collegesFile, colleges, { spaces: 2 });
      return colleges[index];
    }
    throw new Error('College not found');
  }

  async getCollegesByUser(userId) {
    const colleges = await this.getColleges();
    return colleges.filter(college => college.createdBy === userId);
  }

  async deleteCollege(collegeId) {
    const colleges = await this.getColleges();
    const filteredColleges = colleges.filter(c => c.id !== collegeId);
    await fs.writeJson(this.collegesFile, filteredColleges, { spaces: 2 });
  }

  async assignCollegeToAccountManager(collegeId, accountManagerId) {
    return await this.updateCollege(collegeId, { accountManagerId });
  }

  async getAccountManagerStats(accountManagerId) {
    const colleges = await this.getCollegesByAccountManager(accountManagerId);
    const accountManagers = await this.getAccountManagers();
    const accountManager = accountManagers.find(am => am.id === accountManagerId);
    
    return {
      accountManager,
      totalColleges: colleges.length,
      activeColleges: colleges.filter(c => c.lastReportDate).length,
      dueReports: colleges.filter(c => {
        if (!c.lastReportDate) return true;
        const lastReport = new Date(c.lastReportDate);
        const today = new Date();
        const daysSinceLastReport = (today - lastReport) / (1000 * 60 * 60 * 24);
        
        switch (c.reportFrequency) {
          case 'weekly': return daysSinceLastReport >= 7;
          case 'bi-weekly': return daysSinceLastReport >= 14;
          case 'monthly': return daysSinceLastReport >= 30;
          default: return false;
        }
      }).length
    };
  }

  // KPI Management Methods
  async getKPIs(collegeId) {
    try {
      const kpis = await fs.readJson(this.kpisFile);
      return kpis.filter(kpi => kpi.collegeId === parseInt(collegeId)) || [];
    } catch (error) {
      return [];
    }
  }

  async saveKPIs(collegeId, kpisData) {
    try {
      let allKPIs = [];
      try {
        allKPIs = await fs.readJson(this.kpisFile);
      } catch (error) {
        // File doesn't exist, start with empty array
      }

      // Remove existing KPIs for this college
      allKPIs = allKPIs.filter(kpi => kpi.collegeId !== parseInt(collegeId));

      // Add new KPIs with collegeId and timestamps
      const newKPIs = kpisData.map((kpi, index) => ({
        id: kpi.id || Date.now() + index,
        collegeId: parseInt(collegeId),
        name: kpi.name,
        status: kpi.status,
        notes: kpi.notes,
        order: index + 1,
        createdAt: kpi.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      allKPIs.push(...newKPIs);
      await fs.writeJson(this.kpisFile, allKPIs, { spaces: 2 });
      
      return { success: true, kpis: newKPIs };
    } catch (error) {
      console.error('Save KPIs error:', error);
      return { success: false, message: 'Failed to save KPIs' };
    }
  }

  async updateKPI(kpiId, updates) {
    try {
      const kpis = await fs.readJson(this.kpisFile);
      const index = kpis.findIndex(kpi => kpi.id === parseInt(kpiId));
      
      if (index !== -1) {
        kpis[index] = { 
          ...kpis[index], 
          ...updates, 
          updatedAt: new Date().toISOString() 
        };
        await fs.writeJson(this.kpisFile, kpis, { spaces: 2 });
        return { success: true, kpi: kpis[index] };
      }
      
      return { success: false, message: 'KPI not found' };
    } catch (error) {
      console.error('Update KPI error:', error);
      return { success: false, message: 'Failed to update KPI' };
    }
  }

  async deleteKPI(kpiId) {
    try {
      const kpis = await fs.readJson(this.kpisFile);
      const filteredKPIs = kpis.filter(kpi => kpi.id !== parseInt(kpiId));
      await fs.writeJson(this.kpisFile, filteredKPIs, { spaces: 2 });
      return { success: true, message: 'KPI deleted successfully' };
    } catch (error) {
      console.error('Delete KPI error:', error);
      return { success: false, message: 'Failed to delete KPI' };
    }
  }
}

module.exports = UserManager; 