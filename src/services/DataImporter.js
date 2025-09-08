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
      activities: {
        employerEngagement: {},
        enrichment: {}
      },
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
        console.log(`File data keys for ${file.originalName}:`, Object.keys(fileData));
        
        const extractedData = this.extractData(fileData, file.originalName, fileIndex);
        console.log(`\n📊 EXTRACTED DATA FOR FILE: ${file.originalName}`);
        console.log(`   - Departments: ${extractedData.departments}`);
        console.log(`   - Metrics count: ${Object.keys(extractedData.metrics).length}`);
        console.log(`   - Activity type: ${extractedData.activityType}`);
        console.log(`   - Headers: ${extractedData.headerList}`);
        console.log(`   - Sample metrics:`, Object.keys(extractedData.metrics).slice(0, 3).map(dept => 
          `${dept}: [${Object.keys(extractedData.metrics[dept]).slice(0, 3).join(', ')}]`));
        
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

    console.log(`\n📈 === FINAL PROCESSED DATA SUMMARY ===`);
    console.log(`📂 Total files processed: ${processedData.fileInfo.length}`);
    console.log(`🏢 Departments found: ${processedData.departments.length}`);
    console.log(`📊 Regular metrics departments: ${Object.keys(processedData.metrics).length}`);
    console.log(`👥 Employer activities departments: ${Object.keys(processedData.activities.employerEngagement).length}`);
    console.log(`🎓 Enrichment activities departments: ${Object.keys(processedData.activities.enrichment).length}`);
    
    console.log(`\n📋 FILE BREAKDOWN:`);
    processedData.fileInfo.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.originalName} (${file.contentType})`);
    });
    
    if (Object.keys(processedData.activities.employerEngagement).length > 0) {
      console.log(`\n👥 EMPLOYER ACTIVITIES SAMPLE:`, Object.keys(processedData.activities.employerEngagement)[0], 
        Object.keys(processedData.activities.employerEngagement[Object.keys(processedData.activities.employerEngagement)[0]]));
    }
    
    if (Object.keys(processedData.activities.enrichment).length > 0) {
      console.log(`\n🎓 ENRICHMENT ACTIVITIES SAMPLE:`, Object.keys(processedData.activities.enrichment)[0],
        Object.keys(processedData.activities.enrichment[Object.keys(processedData.activities.enrichment)[0]]));
    }

    return processedData;
  }

  detectContentTypeFromFilename(filename) {
    const filenameLower = filename.toLowerCase();
    console.log(`\n=== DETECTING CONTENT TYPE FROM FILENAME ===`);
    console.log(`Filename: "${filename}" -> "${filenameLower}"`);
    
    // Activities detection - more comprehensive patterns
    if (filenameLower.includes('enrichment') || filenameLower.includes('enrich') || 
        filenameLower.includes('enrichment activity') || filenameLower.includes('enrichment activities')) {
      console.log(`✅ Detected ENRICHMENT from filename`);
      return 'enrichment';
    }
    
    if (filenameLower.includes('employer') || filenameLower.includes('engagement') || 
        filenameLower.includes('employer activity') || filenameLower.includes('employer activities') ||
        filenameLower.includes('employer engagement')) {
      console.log(`✅ Detected EMPLOYER from filename`);
      return 'employer';
    }
    
    // Generic activity detection - files that contain activity data but aren't specifically named
    if (filenameLower.includes('activity') || filenameLower.includes('activities')) {
      console.log(`✅ Detected generic ACTIVITY from filename (will determine type from content)`);
      return 'activities'; // Special content type that will be refined by content detection
    }
    
    // Other content types
    if (filenameLower.includes('placement') || filenameLower.includes('placed')) {
      return 'placements';
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
    
    console.log(`❌ No specific content type detected, using 'default'`);
    return 'default';
  }

  detectActivityTypeFromContent(sheetData) {
    console.log(`\n=== DETECTING ACTIVITY TYPE FROM CONTENT ===`);
    
    // First, scan entire sheet for activity structure and filter text
    const allText = sheetData.flat().join(' ').toLowerCase();
    console.log(`Full content snippet: "${allText.substring(0, 200)}..."`);
    
    // Check if this contains activity table structure
    const hasActivityStructure = allText.includes('students with activities') || 
                                 allText.includes('total activities') || 
                                 allText.includes('total activity hours') ||
                                 (allText.includes('activities') && allText.includes('students'));
    
    if (hasActivityStructure) {
      console.log(`✅ Detected ACTIVITY table structure in content`);
      
      // Look for specific filter patterns that indicate activity type
      console.log(`Checking for activity type patterns...`);
      console.log(`Last 300 chars of content: "${allText.substring(allText.length - 300)}"`);
      
      // Check for specific filter patterns from the actual data format
      if (allText.includes('employernonemployer is enrichment activity') || 
          allText.includes('is enrichment activity')) {
        console.log(`✅ Found ENRICHMENT ACTIVITY filter pattern`);
        return 'enrichment';
      }
      
      // Check for employer activity pattern - updated for actual format
      if (allText.includes('employernonemployer is employer activity') ||
          allText.includes('is employer activity') ||
          allText.includes('employernonemployer is employer')) {
        console.log(`✅ Found EMPLOYER ACTIVITY filter pattern`);
        return 'employer';
      }
      
      // Fallback patterns for other formats
      if (allText.includes('enrichment')) {
        console.log(`✅ Found ENRICHMENT from general pattern`);
        return 'enrichment';
      }
      
      if (allText.includes('employer')) {
        console.log(`✅ Found EMPLOYER from general pattern`);  
        return 'employer';
      }
      
      // If no specific filter found, return null to indicate generic activities
      console.log(`✅ Generic ACTIVITIES detected (no specific type filter found)`);
      return null; // Will be handled as generic activities
    }
    
    // Legacy row-by-row detection for other formats
    for (let i = 0; i < Math.min(10, sheetData.length); i++) {
      const row = sheetData[i];
      if (row && Array.isArray(row)) {
        const rowText = row.join(' ').toLowerCase();
        console.log(`Row ${i}: "${rowText}"`);
        
        
        // Legacy detection patterns
        if (rowText.includes('enrichment activity') || rowText.includes('enrichment activities') ||
            (rowText.includes('enrichment') && (rowText.includes('hours') || rowText.includes('students') || rowText.includes('activity')))) {
          console.log(`✅ Detected enrichment activity from content: "${rowText}"`);
          return 'enrichment';
        }
        
        if (rowText.includes('employer activity') || rowText.includes('employer activities') ||
            rowText.includes('employer engagement') ||
            (rowText.includes('employer') && (rowText.includes('hours') || rowText.includes('students') || rowText.includes('activity')))) {
          console.log(`✅ Detected employer activity from content: "${rowText}"`);
          return 'employer';
        }
      }
    }
    
    console.log(`❌ No activity type detected from content`);
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
        console.log(`❌ Filtering out empty header at index ${index}`);
        return false;
      }
      
      const headerStr = header.toString().toLowerCase().trim();
      
      // Skip empty headers
      if (headerStr === '') {
        console.log(`❌ Filtering out empty header at index ${index}`);
        return false;
      }
      
      // Skip numbered headers (1, 2, 3, etc.)
      if (/^[0-9]+$/.test(headerStr)) {
        console.log(`❌ Filtering out numbered header "${header}" at index ${index}`);
        return false;
      }
      
      // Skip common duplicate indicators
      if (headerStr === 'department' || headerStr === 'dept' || headerStr === 'program') {
        console.log(`❌ Filtering out duplicate header "${header}" at index ${index}`);
        return false;
      }
      
      // Skip template metadata fields that shouldn't be part of data columns
      if (headerStr.includes('report date') || headerStr.includes('date generated') || 
          headerStr.includes('generated on') || headerStr.includes('created on') ||
          headerStr.includes('report generated') || headerStr.includes('generated by') ||
          headerStr.includes('template name') || headerStr.includes('report name') ||
          headerStr.includes('export date') || headerStr.includes('timestamp')) {
        console.log(`❌ Filtering out metadata header "${header}" at index ${index}`);
        return false;
      }
        
      // Skip if this is the department column itself
      if (index === departmentColIndex) {
        console.log(`❌ Filtering out department column "${header}" at index ${index}`);
        return false;
      }

      console.log(`✅ Keeping header "${header}" at index ${index}`);
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
        
        // Skip activity type indicator rows and template metadata rows
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('enrichment activity') || rowText.includes('employer activity')) {
          console.log(`Skipping activity type indicator row: ${rowText}`);
          return;
        }
        
        // Skip template metadata rows
        if (rowText.includes('report date') || rowText.includes('generated on') || 
            rowText.includes('created on') || rowText.includes('template name') ||
            rowText.includes('report generated') || rowText.includes('export date') ||
            rowText.includes('date generated') || rowText.includes('report name')) {
          console.log(`Skipping metadata row: ${rowText}`);
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
    console.log(`\n=== MERGE DATA ===`);
    console.log(`File: contentType="${contentType}", activityType="${source.activityType}"`);
    console.log(`Source departments:`, source.departments);
    console.log(`Source metrics keys:`, Object.keys(source.metrics));
    
    // Merge departments
    source.departments.forEach(dept => {
      if (!target.departments.includes(dept)) {
        target.departments.push(dept);
      }
    });

    // Determine if this is activities data
    const isEmployerActivity = contentType === 'employer' || source.activityType === 'employer';
    const isEnrichmentActivity = contentType === 'enrichment' || source.activityType === 'enrichment' || 
                                 (contentType === 'activities' && source.activityType === 'enrichment');
    const isGenericActivity = (contentType === 'activities' && !source.activityType) || 
                             (contentType === 'activities' && source.activityType === null);
    
    console.log(`Activity classification: isEmployer=${isEmployerActivity}, isEnrichment=${isEnrichmentActivity}, isGeneric=${isGenericActivity}`);

    // Merge metrics - handle activities vs regular metrics
    Object.keys(source.metrics).forEach(dept => {
      // Initialize department in all relevant structures
      if (!target.metrics[dept]) {
        target.metrics[dept] = {};
      }
      if (!target.activities.employerEngagement[dept]) {
        target.activities.employerEngagement[dept] = {};
      }
      if (!target.activities.enrichment[dept]) {
        target.activities.enrichment[dept] = {};
      }
      
      Object.keys(source.metrics[dept]).forEach(metric => {
        const value = source.metrics[dept][metric];
        
        if (isEmployerActivity) {
          // Store in employer engagement activities
          target.activities.employerEngagement[dept][metric] = value;
          console.log(`Added employer activity metric "${metric}" for department: ${dept}`);
        } else if (isEnrichmentActivity) {
          // Store in enrichment activities
          target.activities.enrichment[dept][metric] = value;
          console.log(`Added enrichment activity metric "${metric}" for department: ${dept}`);
        } else if (isGenericActivity) {
          // For generic activities (no specific type detected), add as regular metrics with Activity label
          const activityMetric = `${metric} (Activity)`;
          target.metrics[dept][activityMetric] = value;
          console.log(`Added generic activity metric "${activityMetric}" for department: ${dept}`);
        } else {
          // Store in regular metrics with content type
          const uniqueMetric = `${metric} (${contentType})`;
          target.metrics[dept][uniqueMetric] = value;
          console.log(`Added regular metric "${uniqueMetric}" for department: ${dept}`);
        }
      });
    });
  }
}

module.exports = DataImporter; 