const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');

class DataImporter {
  constructor() {
    this.supportedFormats = ['.xlsx', '.xls', '.csv'];
  }

  async processFiles(files) {
    const processedData = {
      departments: [],
      metrics: {},
      timestamp: new Date().toISOString(),
      headerFileMap: {}, // Map header to file index
      fileInfo: [] // Store filename information
    };

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      try {
        // Store file information
        const contentType = this.detectContentTypeFromFilename(file.originalName);
        processedData.fileInfo[fileIndex] = {
          originalName: file.originalName,
          filename: file.filename,
          contentType: contentType
        };
        
        console.log(`Processing file ${fileIndex}: "${file.originalName}" -> contentType: "${contentType}"`);

        const fileData = await this.readFile(file.path);
        const extractedData = this.extractData(fileData, file.originalName, fileIndex);
        
        // Track which headers came from this file - add content type to ALL headers
        if (extractedData.headerList) {
          extractedData.headerList.forEach(header => {
            // Always add content type to header name for clear identification
            const uniqueHeader = `${header} (${contentType})`;
            console.log(`Renamed header "${header}" to "${uniqueHeader}" for file: ${file.originalName}`);
            processedData.headerFileMap[uniqueHeader] = fileIndex;
          });
        }
        
        // Merge data
        this.mergeData(processedData, extractedData, fileIndex, contentType);
      } catch (error) {
        console.error(`Error processing file ${file.originalName}:`, error);
        throw new Error(`Failed to process ${file.originalName}: ${error.message}`);
      }
    }

    return processedData;
  }

  detectContentTypeFromFilename(filename) {
    const filenameLower = filename.toLowerCase();
    
    if (filenameLower.includes('placement') || filenameLower.includes('placed')) {
      return 'placements';
    }
    
    if (filenameLower.includes('enrichment') || filenameLower.includes('enrich')) {
      return 'enrichment';
    }
    
    if (filenameLower.includes('employer') || filenameLower.includes('engagement')) {
      return 'employer';
    }
    
    if (filenameLower.includes('career') || filenameLower.includes('careers')) {
      return 'careers';
    }
    
    if (filenameLower.includes('assessment') || filenameLower.includes('assess')) {
      return 'assessments';
    }
    
    if (filenameLower.includes('target') || filenameLower.includes('targets')) {
      return 'targets';
    }
    
    if (filenameLower.includes('login') || filenameLower.includes('access')) {
      return 'login';
    }
    
    return 'default';
  }

  detectActivityTypeFromContent(sheetData) {
    // Look through all rows for activity type indicators
    for (let row of sheetData) {
      if (row && Array.isArray(row)) {
        const rowText = row.join(' ').toLowerCase();
        
        if (rowText.includes('enrichment activity') || rowText.includes('enrichment')) {
          return 'enrichment';
        }
        
        if (rowText.includes('employer activity') || rowText.includes('employer engagement')) {
          return 'employer';
        }
      }
    }
    
    return null; // No specific activity type found
  }

  async readFile(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (!this.supportedFormats.includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    try {
      if (fileExtension === '.csv') {
        return await this.readCSV(filePath);
      } else {
        return await this.readExcel(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async readExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheets = {};
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      sheets[sheetName] = jsonData;
    });

    return sheets;
  }

  async readCSV(filePath) {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return { [workbook.SheetNames[0]]: jsonData };
  }

  extractData(fileData, fileName, fileIndex) {
    const extracted = {
      departments: [],
      metrics: {},
      headerList: [],
      activityType: null
    };

    // Process each sheet
    Object.keys(fileData).forEach(sheetName => {
      const sheetData = fileData[sheetName];
      if (sheetData && sheetData.length > 0) {
        // Detect activity type from content
        const contentActivityType = this.detectActivityTypeFromContent(sheetData);
        if (contentActivityType) {
          extracted.activityType = contentActivityType;
          console.log(`Detected activity type from content: ${contentActivityType} in file: ${fileName}`);
        }
        
        this.processSheet(sheetData, extracted, fileName, fileIndex);
      }
    });

    return extracted;
  }

  processSheet(sheetData, extracted, fileName, fileIndex) {
    if (!sheetData || sheetData.length < 2) return;

    const headers = sheetData[0];
    const dataRows = sheetData.slice(1);
    
    // Ensure headers is an array
    if (!Array.isArray(headers)) {
      console.warn('Headers is not an array:', headers);
      return;
    }
        
    // Find key columns based on your report structure
    const departmentColIndex = this.findColumnIndex(headers, ['Department', 'Program', 'Course', 'Category']);
              
    // Filter out problematic headers (numbered columns, duplicates, etc.)
    console.log(`Processing sheet for ${fileName} - Original headers:`, headers);
    
    const filteredHeaders = headers.filter((header, index) => {
      if (!header) {
        console.log(`Filtering out empty header at index ${index}`);
        return false;
      }
      
      const headerStr = header.toString().toLowerCase().trim();
      
      // Skip empty headers
      if (headerStr === '') {
        console.log(`Filtering out empty header at index ${index}`);
        return false;
      }
      
      // Skip numbered headers (1, 2, 3, etc.)
      if (/^[0-9]+$/.test(headerStr)) {
        console.log(`Filtering out numbered header "${header}" at index ${index}`);
        return false;
      }
      
      // Skip common duplicate indicators
      if (headerStr === 'department' || headerStr === 'dept' || headerStr === 'program') {
        console.log(`Filtering out duplicate header "${header}" at index ${index}`);
        return false;
      }
        
      // Skip if this is the department column itself
      if (index === departmentColIndex) {
        console.log(`Filtering out department column "${header}" at index ${index}`);
        return false;
      }

      return true;
    });
    
    console.log(`Filtered headers for ${fileName}:`, filteredHeaders);

    // Add to headerList - now always add, even if duplicates
    filteredHeaders.forEach(header => {
      extracted.headerList.push(header);
      console.log(`Added header "${header}" from file: ${fileName}`);
    });

    dataRows.forEach(row => {
      if (row && row.length > 0 && row[0]) {
        const department = row[departmentColIndex] || 'Unknown Department';
        
        // Skip rows that are just numbered indicators
        if (department.toString().trim() === '1' || department.toString().trim() === '2') {
          return;
        }
        
        // Skip activity type indicator rows (they're not data rows)
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('enrichment activity') || rowText.includes('employer activity')) {
          console.log(`Skipping activity type indicator row: ${rowText}`);
          return;
        }
        
        if (!extracted.departments.includes(department)) {
          extracted.departments.push(department);
        }

        if (!extracted.metrics[department]) {
          extracted.metrics[department] = {};
        }

        // Extract metrics using filtered headers
        filteredHeaders.forEach((header, filteredIndex) => {
          const originalIndex = headers.indexOf(header);
          if (originalIndex !== -1 && row[originalIndex] !== undefined) {
            const value = this.parseValue(row[originalIndex]);
            if (value !== null) {
              // All data goes to metrics - coloring will be handled by filename
              extracted.metrics[department][header] = value;
            }
          }
        });
      }
    });
  }

  findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header && header.toString().toLowerCase().includes(name.toLowerCase())
      );
      if (index !== -1) return index;
    }
    return 0; // Default to first column
  }

  parseValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Try to parse as number
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return numValue;
    }

    // Return as string if not a number
    return value.toString();
  }

  mergeData(target, source, fileIndex, contentType) {
    // Merge departments
    source.departments.forEach(dept => {
      if (!target.departments.includes(dept)) {
        target.departments.push(dept);
      }
    });

    // Merge metrics - handle duplicate headers by renaming them
    Object.keys(source.metrics).forEach(dept => {
      if (!target.metrics[dept]) {
        target.metrics[dept] = {};
      }
      
      Object.keys(source.metrics[dept]).forEach(metric => {
        // Always add content type to metric name for clear identification
        const uniqueMetric = `${metric} (${contentType})`;
        console.log(`Renamed metric "${metric}" to "${uniqueMetric}" for department: ${dept}`);
        
        target.metrics[dept][uniqueMetric] = source.metrics[dept][metric];
      });
    });
  }
}

module.exports = DataImporter; 