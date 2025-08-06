const fs = require('fs-extra');
const path = require('path');

class UserManager {
  constructor(volumeService = null) {
    this.volumeService = volumeService;
    this.usersFile = 'users.json';
    this.collegesFile = 'colleges.json';
    this.accountManagersFile = 'accountManagers.json';
    this.kpisFile = 'kpis.json';
  }

  async getUsers() {
    try {
      if (this.volumeService) {
        return await this.volumeService.readFile(this.usersFile);
      } else {
        return await fs.readJson(`data/${this.usersFile}`);
      }
    } catch (error) {
      return [];
    }
  }

  async getAccountManagers() {
    try {
      if (this.volumeService) {
        return await this.volumeService.readFile(this.accountManagersFile);
      } else {
        return await fs.readJson(`data/${this.accountManagersFile}`);
      }
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
      if (this.volumeService) {
        await this.volumeService.writeFile(this.accountManagersFile, accountManagers);
      } else {
        await fs.writeJson(`data/${this.accountManagersFile}`, accountManagers, { spaces: 2 });
      }
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
        if (this.volumeService) {
          await this.volumeService.writeFile(this.accountManagersFile, accountManagers);
        } else {
          await fs.writeJson(`data/${this.accountManagersFile}`, accountManagers, { spaces: 2 });
        }
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
        if (this.volumeService) {
          await this.volumeService.writeFile(this.accountManagersFile, filteredManagers);
        } else {
          await fs.writeJson(`data/${this.accountManagersFile}`, filteredManagers, { spaces: 2 });
        }
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
      if (this.volumeService) {
        return await this.volumeService.readFile(this.collegesFile);
      } else {
        return await fs.readJson(`data/${this.collegesFile}`);
      }
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
    
    // Ensure consistent data structure
    const processedData = { ...collegeData };
    
    // Handle keyStakeholders vs keyStakeholder field name mismatch
    if (processedData.keyStakeholders !== undefined) {
      // Use keyStakeholders array
      processedData.keyStakeholders = Array.isArray(processedData.keyStakeholders) ? processedData.keyStakeholders : [];
    } else if (processedData.keyStakeholder !== undefined) {
      // Convert keyStakeholder string to keyStakeholders array
      processedData.keyStakeholders = processedData.keyStakeholder ? [{
        name: processedData.keyStakeholder,
        position: '',
        email: ''
      }] : [];
      delete processedData.keyStakeholder;
    } else {
      processedData.keyStakeholders = [];
    }
    
    // Handle superUsers data structure consistency
    if (processedData.superUsers !== undefined) {
      if (Array.isArray(processedData.superUsers)) {
        processedData.superUsers = processedData.superUsers;
      } else if (typeof processedData.superUsers === 'string' && processedData.superUsers.trim()) {
        // Convert string to array if it's a comma-separated list
        processedData.superUsers = processedData.superUsers.split(',').map(s => s.trim()).filter(s => s).map(name => ({
          name,
          position: '',
          email: ''
        }));
      } else {
        processedData.superUsers = [];
      }
    } else {
      processedData.superUsers = [];
    }
    
    const newCollege = {
      id: Date.now(),
      name: processedData.name,
      numberOfProviders: processedData.numberOfProviders,
      accountManagerId: processedData.accountManagerId || null,
      keyStakeholders: processedData.keyStakeholders,
      superUsers: processedData.superUsers,
      misContact: processedData.misContact,
      dataTransferMethod: processedData.dataTransferMethod,
      status: processedData.status,
      ofstedRating: processedData.ofstedRating,
      reportFrequency: processedData.reportFrequency,
      template: processedData.template,
      initialConcerns: processedData.initialConcerns,
      lastReportDate: null,
      createdAt: new Date().toISOString()
    };
    
    colleges.push(newCollege);
    if (this.volumeService) {
      await this.volumeService.writeFile(this.collegesFile, colleges);
    } else {
      await fs.writeJson(`data/${this.collegesFile}`, colleges, { spaces: 2 });
    }
    return newCollege;
  }

  async updateCollege(collegeId, updates) {
    console.log('🔄 UserManager.updateCollege called with:', { collegeId, updates });
    console.log('📁 Using VolumeService:', !!this.volumeService);
    
    const colleges = await this.getColleges();
    console.log('📋 Found colleges:', colleges.length);
    
    const index = colleges.findIndex(c => c.id === collegeId);
    console.log('🔍 College index found:', index);
    
    if (index !== -1) {
      console.log('📝 Original college data:', colleges[index]);
      
      // Handle field name mismatches and ensure consistent data structure
      const processedUpdates = { ...updates };
      
      // Handle keyStakeholders vs keyStakeholder field name mismatch
      if (processedUpdates.keyStakeholders !== undefined) {
        processedUpdates.keyStakeholders = processedUpdates.keyStakeholders;
        // Remove the old field if it exists
        delete processedUpdates.keyStakeholder;
      }
      
      // Handle superUsers data structure consistency
      if (processedUpdates.superUsers !== undefined) {
        // Ensure superUsers is always an array
        if (Array.isArray(processedUpdates.superUsers)) {
          processedUpdates.superUsers = processedUpdates.superUsers;
        } else if (typeof processedUpdates.superUsers === 'string') {
          // Convert string to array if it's a comma-separated list
          processedUpdates.superUsers = processedUpdates.superUsers.split(',').map(s => s.trim()).filter(s => s);
        } else {
          processedUpdates.superUsers = [];
        }
      }
      
      // Ensure existing data has consistent structure
      const existingCollege = colleges[index];
      if (!existingCollege.keyStakeholders && existingCollege.keyStakeholder) {
        // Migrate old keyStakeholder field to keyStakeholders array
        existingCollege.keyStakeholders = existingCollege.keyStakeholder ? [{
          name: existingCollege.keyStakeholder,
          position: '',
          email: ''
        }] : [];
        delete existingCollege.keyStakeholder;
      }
      
      if (!Array.isArray(existingCollege.superUsers)) {
        // Ensure superUsers is always an array
        if (typeof existingCollege.superUsers === 'string' && existingCollege.superUsers.trim()) {
          existingCollege.superUsers = [{
            name: existingCollege.superUsers,
            position: '',
            email: ''
          }];
        } else {
          existingCollege.superUsers = [];
        }
      }
      
      colleges[index] = { ...existingCollege, ...processedUpdates };
      console.log('📝 Updated college data:', colleges[index]);
      
      try {
        if (this.volumeService) {
          console.log('💾 Writing to VolumeService...');
          await this.volumeService.writeFile(this.collegesFile, colleges);
          console.log('✅ College data written to volume service');
        } else {
          console.log('💾 Writing to local file system...');
          await fs.writeJson(`data/${this.collegesFile}`, colleges, { spaces: 2 });
          console.log('✅ College data written to file system');
        }
        return colleges[index];
      } catch (error) {
        console.error('❌ Error writing college data:', error);
        throw error;
      }
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
    if (this.volumeService) {
      await this.volumeService.writeFile(this.collegesFile, filteredColleges);
    } else {
      await fs.writeJson(`data/${this.collegesFile}`, filteredColleges, { spaces: 2 });
    }
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
      if (this.volumeService) {
        const kpis = await this.volumeService.readFile(this.kpisFile);
        return kpis.filter(kpi => kpi.collegeId === parseInt(collegeId)) || [];
      } else {
        const kpis = await fs.readJson(`data/${this.kpisFile}`);
        return kpis.filter(kpi => kpi.collegeId === parseInt(collegeId)) || [];
      }
    } catch (error) {
      return [];
    }
  }

  async saveKPIs(collegeId, kpisData) {
    try {
      let allKPIs = [];
      try {
        if (this.volumeService) {
          allKPIs = await this.volumeService.readFile(this.kpisFile);
        } else {
          allKPIs = await fs.readJson(`data/${this.kpisFile}`);
        }
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
      if (this.volumeService) {
        await this.volumeService.writeFile(this.kpisFile, allKPIs);
      } else {
        await fs.writeJson(`data/${this.kpisFile}`, allKPIs, { spaces: 2 });
      }
      
      return { success: true, kpis: newKPIs };
    } catch (error) {
      console.error('Save KPIs error:', error);
      return { success: false, message: 'Failed to save KPIs' };
    }
  }

  async updateKPI(kpiId, updates) {
    try {
      let kpis;
      if (this.volumeService) {
        kpis = await this.volumeService.readFile(this.kpisFile);
      } else {
        kpis = await fs.readJson(`data/${this.kpisFile}`);
      }
      const index = kpis.findIndex(kpi => kpi.id === parseInt(kpiId));
      
      if (index !== -1) {
        kpis[index] = { 
          ...kpis[index], 
          ...updates, 
          updatedAt: new Date().toISOString() 
        };
        if (this.volumeService) {
          await this.volumeService.writeFile(this.kpisFile, kpis);
        } else {
          await fs.writeJson(`data/${this.kpisFile}`, kpis, { spaces: 2 });
        }
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
      let kpis;
      if (this.volumeService) {
        kpis = await this.volumeService.readFile(this.kpisFile);
      } else {
        kpis = await fs.readJson(`data/${this.kpisFile}`);
      }
      const filteredKPIs = kpis.filter(kpi => kpi.id !== parseInt(kpiId));
      if (this.volumeService) {
        await this.volumeService.writeFile(this.kpisFile, filteredKPIs);
      } else {
        await fs.writeJson(`data/${this.kpisFile}`, filteredKPIs, { spaces: 2 });
      }
      return { success: true, message: 'KPI deleted successfully' };
    } catch (error) {
      console.error('Delete KPI error:', error);
      return { success: false, message: 'Failed to delete KPI' };
    }
  }
}

module.exports = UserManager; 