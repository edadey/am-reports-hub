const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EnhancedDataValidationService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.validationRules = this.initializeValidationRules();
  }

  /**
   * Initialize validation rules for different data types
   */
  initializeValidationRules() {
    return {
      report: {
        required: ['id', 'name', 'data', 'createdAt'],
        dataStructure: {
          headers: { type: 'array', minLength: 1 },
          rows: { type: 'array', minLength: 0 }
        },
        businessRules: [
          'validateReportDataStructure',
          'validateReportHeaders',
          'validateReportRows',
          'validateReportMetrics'
        ]
      },
      template: {
        required: ['id', 'name', 'headers', 'createdAt'],
        dataStructure: {
          headers: { type: 'array', minLength: 1 },
          columnCount: { type: 'number', min: 1 },
          rowCount: { type: 'number', min: 0 }
        },
        businessRules: [
          'validateTemplateStructure',
          'validateTemplateHeaders',
          'validateTemplateData'
        ]
      },
      college: {
        required: ['id', 'name', 'createdAt'],
        dataStructure: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          numberOfProviders: { type: 'string', pattern: /^\d+$/ },
          reportFrequency: { type: 'string', enum: ['weekly', 'bi-weekly', 'monthly'] },
          status: { type: 'string', enum: ['A', 'B', 'C'] },
          ofstedRating: { type: 'string', enum: ['O', 'G', 'R', 'I'] }
        },
        businessRules: [
          'validateCollegeData',
          'validateCollegeModules',
          'validateCollegeStakeholders'
        ]
      },
      kpi: {
        required: ['id', 'collegeId', 'kpi', 'priority', 'status'],
        dataStructure: {
          kpi: { type: 'string', minLength: 1, maxLength: 500 },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          status: { type: 'string', enum: ['incomplete', 'in-progress', 'complete'] },
          progress: { type: 'number', min: 0, max: 100 }
        },
        businessRules: [
          'validateKPIData',
          'validateKPIProgress'
        ]
      }
    };
  }

  /**
   * Validate report data before saving
   */
  async validateReportData(reportData, collegeId) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksum: null,
      validationTime: new Date().toISOString()
    };

    try {
      // Basic structure validation
      const structureValidation = this.validateDataStructure(reportData, 'report');
      if (!structureValidation.isValid) {
        validationResult.errors.push(...structureValidation.errors);
        validationResult.isValid = false;
      }

      // Business rule validation
      const businessValidation = await this.validateBusinessRules(reportData, 'report', { collegeId });
      if (!businessValidation.isValid) {
        validationResult.errors.push(...businessValidation.errors);
        validationResult.isValid = false;
      }

      // Data integrity checks
      const integrityValidation = await this.validateDataIntegrity(reportData, 'report');
      if (!integrityValidation.isValid) {
        validationResult.errors.push(...integrityValidation.errors);
        validationResult.isValid = false;
      }

      // Generate checksum for data integrity
      validationResult.checksum = this.generateChecksum(reportData);

      // Performance validation
      const performanceValidation = this.validatePerformance(reportData, 'report');
      if (!performanceValidation.isValid) {
        validationResult.warnings.push(...performanceValidation.warnings);
      }

      return validationResult;

    } catch (error) {
      validationResult.isValid = false;
      validationResult.errors.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  /**
   * Validate template data before saving
   */
  async validateTemplateData(templateData) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksum: null,
      validationTime: new Date().toISOString()
    };

    try {
      // Basic structure validation
      const structureValidation = this.validateDataStructure(templateData, 'template');
      if (!structureValidation.isValid) {
        validationResult.errors.push(...structureValidation.errors);
        validationResult.isValid = false;
      }

      // Business rule validation
      const businessValidation = await this.validateBusinessRules(templateData, 'template');
      if (!businessValidation.isValid) {
        validationResult.errors.push(...businessValidation.errors);
        validationResult.isValid = false;
      }

      // Duplicate detection
      const duplicateValidation = await this.checkForDuplicates(templateData, 'template');
      if (!duplicateValidation.isValid) {
        validationResult.warnings.push(...duplicateValidation.warnings);
      }

      // Generate checksum
      validationResult.checksum = this.generateChecksum(templateData);

      return validationResult;

    } catch (error) {
      validationResult.isValid = false;
      validationResult.errors.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  /**
   * Validate college data before saving
   */
  async validateCollegeData(collegeData) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksum: null,
      validationTime: new Date().toISOString()
    };

    try {
      // Basic structure validation
      const structureValidation = this.validateDataStructure(collegeData, 'college');
      if (!structureValidation.isValid) {
        validationResult.errors.push(...structureValidation.errors);
        validationResult.isValid = false;
      }

      // Business rule validation
      const businessValidation = await this.validateBusinessRules(collegeData, 'college');
      if (!businessValidation.isValid) {
        validationResult.errors.push(...businessValidation.errors);
        validationResult.isValid = false;
      }

      // Uniqueness validation
      const uniquenessValidation = await this.validateUniqueness(collegeData, 'college');
      if (!uniquenessValidation.isValid) {
        validationResult.errors.push(...uniquenessValidation.errors);
        validationResult.isValid = false;
      }

      // Generate checksum
      validationResult.checksum = this.generateChecksum(collegeData);

      return validationResult;

    } catch (error) {
      validationResult.isValid = false;
      validationResult.errors.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  /**
   * Validate KPI data before saving
   */
  async validateKPIData(kpiData, collegeId) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksum: null,
      validationTime: new Date().toISOString()
    };

    try {
      // Basic structure validation
      const structureValidation = this.validateDataStructure(kpiData, 'kpi');
      if (!structureValidation.isValid) {
        validationResult.errors.push(...structureValidation.errors);
        validationResult.isValid = false;
      }

      // Business rule validation
      const businessValidation = await this.validateBusinessRules(kpiData, 'kpi', { collegeId });
      if (!businessValidation.isValid) {
        validationResult.errors.push(...businessValidation.errors);
        validationResult.isValid = false;
      }

      // Generate checksum
      validationResult.checksum = this.generateChecksum(kpiData);

      return validationResult;

    } catch (error) {
      validationResult.isValid = false;
      validationResult.errors.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  /**
   * Validate data structure against defined rules
   */
  validateDataStructure(data, dataType) {
    const result = { isValid: true, errors: [] };
    const rules = this.validationRules[dataType];

    if (!rules) {
      result.isValid = false;
      result.errors.push(`Unknown data type: ${dataType}`);
      return result;
    }

    // Check required fields
    for (const field of rules.required) {
      if (!data.hasOwnProperty(field) || data[field] === null || data[field] === undefined) {
        result.errors.push(`Missing required field: ${field}`);
        result.isValid = false;
      }
    }

    // Check data structure rules
    if (rules.dataStructure) {
      for (const [field, rule] of Object.entries(rules.dataStructure)) {
        if (data[field] !== undefined) {
          const fieldValidation = this.validateField(data[field], rule);
          if (!fieldValidation.isValid) {
            result.errors.push(`Field ${field}: ${fieldValidation.error}`);
            result.isValid = false;
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate individual field against rule
   */
  validateField(value, rule) {
    const result = { isValid: true, error: null };

    // Type validation
    if (rule.type === 'array') {
      if (!Array.isArray(value)) {
        result.isValid = false;
        result.error = 'Must be an array';
        return result;
      }
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        result.isValid = false;
        result.error = `Array must have at least ${rule.minLength} items`;
        return result;
      }
    } else if (rule.type === 'string') {
      if (typeof value !== 'string') {
        result.isValid = false;
        result.error = 'Must be a string';
        return result;
      }
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        result.isValid = false;
        result.error = `String must be at least ${rule.minLength} characters`;
        return result;
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        result.isValid = false;
        result.error = `String must be no more than ${rule.maxLength} characters`;
        return result;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        result.isValid = false;
        result.error = 'String does not match required pattern';
        return result;
      }
      if (rule.enum && !rule.enum.includes(value)) {
        result.isValid = false;
        result.error = `Value must be one of: ${rule.enum.join(', ')}`;
        return result;
      }
    } else if (rule.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        result.isValid = false;
        result.error = 'Must be a number';
        return result;
      }
      if (rule.min !== undefined && value < rule.min) {
        result.isValid = false;
        result.error = `Number must be at least ${rule.min}`;
        return result;
      }
      if (rule.max !== undefined && value > rule.max) {
        result.isValid = false;
        result.error = `Number must be no more than ${rule.max}`;
        return result;
      }
    }

    return result;
  }

  /**
   * Validate business rules for data
   */
  async validateBusinessRules(data, dataType, context = {}) {
    const result = { isValid: true, errors: [] };
    const rules = this.validationRules[dataType];

    if (!rules || !rules.businessRules) {
      return result;
    }

    for (const ruleName of rules.businessRules) {
      const ruleMethod = this[ruleName];
      if (typeof ruleMethod === 'function') {
        try {
          const ruleResult = await ruleMethod.call(this, data, context);
          if (!ruleResult.isValid) {
            result.errors.push(...ruleResult.errors);
            result.isValid = false;
          }
        } catch (error) {
          result.errors.push(`Business rule ${ruleName} failed: ${error.message}`);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validate report data structure
   */
  async validateReportDataStructure(data) {
    const result = { isValid: true, errors: [] };

    if (!data.data || typeof data.data !== 'object') {
      result.errors.push('Report must have valid data object');
      result.isValid = false;
      return result;
    }

    if (!Array.isArray(data.data.headers)) {
      result.errors.push('Report data must have headers array');
      result.isValid = false;
    }

    if (!Array.isArray(data.data.rows)) {
      result.errors.push('Report data must have rows array');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate report headers
   */
  async validateReportHeaders(data) {
    const result = { isValid: true, errors: [] };

    if (!data.data || !Array.isArray(data.data.headers)) {
      return result;
    }

    const headers = data.data.headers;

    // Check for empty headers
    const emptyHeaders = headers.filter(h => !h || h.trim() === '');
    if (emptyHeaders.length > 0) {
      result.errors.push('Report contains empty headers');
      result.isValid = false;
    }

    // Check for duplicate headers
    const uniqueHeaders = new Set(headers.map(h => h.toLowerCase()));
    if (uniqueHeaders.size !== headers.length) {
      result.errors.push('Report contains duplicate headers');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate report rows
   */
  async validateReportRows(data) {
    const result = { isValid: true, errors: [] };

    if (!data.data || !Array.isArray(data.data.rows) || !Array.isArray(data.data.headers)) {
      return result;
    }

    const headers = data.data.headers;
    const rows = data.data.rows;

    // Check row structure
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) {
        result.errors.push(`Row ${i + 1} is not an array`);
        result.isValid = false;
        continue;
      }

      if (row.length !== headers.length) {
        result.errors.push(`Row ${i + 1} has ${row.length} columns but should have ${headers.length}`);
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate report metrics
   */
  async validateReportMetrics(data) {
    const result = { isValid: true, errors: [] };

    if (!data.data || !Array.isArray(data.data.rows)) {
      return result;
    }

    const rows = data.data.rows;

    // Check for reasonable data ranges
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        
        // Check for extremely large numbers (potential data corruption)
        if (typeof cell === 'number' && (cell > 1000000 || cell < -1000000)) {
          result.errors.push(`Suspicious value in row ${i + 1}, column ${j + 1}: ${cell}`);
          result.isValid = false;
        }

        // Check for negative percentages
        if (typeof cell === 'number' && cell < 0 && cell > -1) {
          result.errors.push(`Negative percentage in row ${i + 1}, column ${j + 1}: ${cell}`);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validate template structure
   */
  async validateTemplateStructure(data) {
    const result = { isValid: true, errors: [] };

    if (!Array.isArray(data.headers)) {
      result.errors.push('Template must have headers array');
      result.isValid = false;
    }

    if (typeof data.columnCount !== 'number' || data.columnCount < 1) {
      result.errors.push('Template must have valid column count');
      result.isValid = false;
    }

    if (typeof data.rowCount !== 'number' || data.rowCount < 0) {
      result.errors.push('Template must have valid row count');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate template headers
   */
  async validateTemplateHeaders(data) {
    const result = { isValid: true, errors: [] };

    if (!data || !Array.isArray(data.headers)) {
      return result;
    }

    const headers = data.headers;

    // Check for empty headers
    const emptyHeaders = headers.filter(h => !h || (typeof h === 'string' && h.trim() === ''));
    if (emptyHeaders.length > 0) {
      result.errors.push('Template contains empty headers');
      result.isValid = false;
    }

    // Check for duplicate headers
    const uniqueHeaders = new Set(headers.map(h => (typeof h === 'string' ? h.toLowerCase() : String(h))));
    if (uniqueHeaders.size !== headers.length) {
      result.errors.push('Template contains duplicate headers');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate template data
   */
  async validateTemplateData(data) {
    const result = { isValid: true, errors: [] };

    if (data.tableData && Array.isArray(data.tableData)) {
      const headers = data.headers || [];
      
      for (let i = 0; i < data.tableData.length; i++) {
        const row = data.tableData[i];
        if (!Array.isArray(row)) {
          result.errors.push(`Template data row ${i + 1} is not an array`);
          result.isValid = false;
          continue;
        }

        if (row.length !== headers.length) {
          result.errors.push(`Template data row ${i + 1} has ${row.length} columns but should have ${headers.length}`);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validate college data
   */
  async validateCollegeData(data) {
    const result = { isValid: true, errors: [] };

    // Validate email format if provided
    if (data.misContactEmail && !this.isValidEmail(data.misContactEmail)) {
      result.errors.push('Invalid MIS contact email format');
      result.isValid = false;
    }

    // Validate modules if provided
    if (data.modules && Array.isArray(data.modules)) {
      for (let i = 0; i < data.modules.length; i++) {
        const module = data.modules[i];
        if (!module.name || !module.cost) {
          result.errors.push(`Module ${i + 1} is missing required fields`);
          result.isValid = false;
        }
        if (typeof module.cost !== 'number' || module.cost < 0) {
          result.errors.push(`Module ${i + 1} has invalid cost`);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validate college modules
   */
  async validateCollegeModules(data) {
    const result = { isValid: true, errors: [] };

    if (data.modules && Array.isArray(data.modules)) {
      const moduleNames = data.modules.map(m => m.name.toLowerCase());
      const uniqueNames = new Set(moduleNames);
      
      if (uniqueNames.size !== moduleNames.length) {
        result.errors.push('College has duplicate module names');
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate college stakeholders
   */
  async validateCollegeStakeholders(data) {
    const result = { isValid: true, errors: [] };

    if (data.keyStakeholders && Array.isArray(data.keyStakeholders)) {
      for (let i = 0; i < data.keyStakeholders.length; i++) {
        const stakeholder = data.keyStakeholders[i];
        if (!stakeholder.name || !stakeholder.position) {
          result.errors.push(`Stakeholder ${i + 1} is missing required fields`);
          result.isValid = false;
        }
        if (stakeholder.email && !this.isValidEmail(stakeholder.email)) {
          result.errors.push(`Stakeholder ${i + 1} has invalid email format`);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validate KPI data
   */
  async validateKPIData(data) {
    const result = { isValid: true, errors: [] };

    // Validate progress percentage
    if (data.progress !== undefined) {
      if (typeof data.progress !== 'number' || data.progress < 0 || data.progress > 100) {
        result.errors.push('KPI progress must be between 0 and 100');
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate KPI progress
   */
  async validateKPIProgress(data) {
    const result = { isValid: true, errors: [] };

    // Check if status matches progress
    if (data.status === 'complete' && data.progress !== 100) {
      result.errors.push('KPI marked as complete but progress is not 100%');
      result.isValid = false;
    }

    if (data.status === 'incomplete' && data.progress === 100) {
      result.errors.push('KPI has 100% progress but status is incomplete');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate data integrity
   */
  async validateDataIntegrity(data, dataType) {
    const result = { isValid: true, errors: [] };

    // Check for circular references
    try {
      JSON.stringify(data);
    } catch (error) {
      result.errors.push('Data contains circular references');
      result.isValid = false;
    }

    // Check for extremely large objects
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 10 * 1024 * 1024) { // 10MB limit
      result.errors.push('Data size exceeds maximum allowed size (10MB)');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate performance characteristics
   */
  validatePerformance(data, dataType) {
    const result = { isValid: true, warnings: [] };

    if (dataType === 'report' && data.data && data.data.rows) {
      if (data.data.rows.length > 10000) {
        result.warnings.push('Large report detected (>10,000 rows) - may impact performance');
      }
    }

    if (dataType === 'template' && data.tableData && data.tableData.length > 1000) {
      result.warnings.push('Large template detected (>1,000 rows) - may impact performance');
    }

    return result;
  }

  /**
   * Check for duplicates
   */
  async checkForDuplicates(data, dataType) {
    const result = { isValid: true, warnings: [] };

    if (dataType === 'template' && data.name) {
      try {
        const templatesPath = path.join(this.dataDir, 'templates.json');
        const templatesData = await fs.readFile(templatesPath, 'utf8');
        const templates = JSON.parse(templatesData);
        
        const existingTemplate = templates.find(t => 
          t.name.toLowerCase() === data.name.toLowerCase() && t.id !== data.id
        );
        
        if (existingTemplate) {
          result.warnings.push(`Template with name "${data.name}" already exists`);
        }
      } catch (error) {
        // File doesn't exist or can't be read - this is OK for new templates
      }
    }

    return result;
  }

  /**
   * Validate uniqueness
   */
  async validateUniqueness(data, dataType) {
    const result = { isValid: true, errors: [] };

    if (dataType === 'college' && data.name) {
      try {
        const collegesPath = path.join(this.dataDir, 'colleges.json');
        const collegesData = await fs.readFile(collegesPath, 'utf8');
        const colleges = JSON.parse(collegesData);
        
        const existingCollege = colleges.find(c => 
          c.name.toLowerCase() === data.name.toLowerCase() && c.id !== data.id
        );
        
        if (existingCollege) {
          result.errors.push(`College with name "${data.name}" already exists`);
          result.isValid = false;
        }
      } catch (error) {
        // File doesn't exist or can't be read - this is OK for new colleges
      }
    }

    return result;
  }

  /**
   * Generate checksum for data
   */
  generateChecksum(data) {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get validation statistics
   */
  async getValidationStats() {
    try {
      const stats = {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        commonErrors: {},
        lastValidation: null
      };

      // This could be enhanced to read from a validation log file
      return stats;
    } catch (error) {
      console.error('Failed to get validation stats:', error);
      return null;
    }
  }
}

module.exports = EnhancedDataValidationService; 