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
      originalHeaders: [], // Store original headers from all files for template creation
      timestamp: new Date().toISOString(),
      headerFileMap: {}, // Map header to file index
      fileInfo: [] // Store filename information
    };

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      try {
        // Store file information - use user-selected type if available, otherwise detect from filename
        let contentType = file.userSelectedType || this.detectContentTypeFromFilename(file.originalName);
        
        // Normalize content type names to match frontend expectations
        if (contentType === 'employer') {
          contentType = 'employment';
        }
        
        // Derive a short, stable label from the original filename for per-file column separation
        const parsed = path.parse(file.originalName || file.originalname || 'file');
        let label = (parsed.name || 'file').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
        // Limit label length to keep headers readable
        if (label.length > 24) label = label.substring(0, 24).trim();

        const CONTENT_TYPE_COLORS = {
          'placements': '#dbeafe',
          'employment': '#f3e8ff',
          'employer': '#f3e8ff',
          'enrichment': '#ccfbf1',
          'careers': '#fef3c7',
          'assessments': '#bbf7d0',
          'targets': '#fce7f3',
          'login': '#e0e7ff',
          'activities': '#f3f4f6',
          'default': '#f3f4f6'
        };
        const inferredColor = CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.default;

        processedData.fileInfo[fileIndex] = {
          originalName: file.originalName,
          filename: file.filename,
          contentType: contentType,
          customColor: file.userSelectedColor || inferredColor,
          label
        };
        
        console.log(`Processing file ${fileIndex}: "${file.originalName}" -> contentType: "${contentType}" (${file.userSelectedType ? 'user-selected' : 'filename-detected'})`);

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
        
        // Track which headers came from this file - map ALL header variations
        if (extractedData.headerList) {
          extractedData.headerList.forEach(header => {
            // Map the original header name (for frontend lookup)
            processedData.headerFileMap[header] = fileIndex;
            console.log(`Mapped original header "${header}" to file ${fileIndex} (${file.originalName})`);
            
            // Map the suffixed header name (for internal processing)
            const uniqueHeader = `${header} (${contentType})`;
            processedData.headerFileMap[uniqueHeader] = fileIndex;
            console.log(`Mapped suffixed header "${uniqueHeader}" to file ${fileIndex} (${file.originalName})`);

            // Map file-specific unique headers to prevent cross-file collisions
            const fileLabel = processedData.fileInfo[fileIndex]?.label || `File${fileIndex + 1}`;
            const fileSpecificHeader = `${header} [${fileLabel}]`;
            processedData.headerFileMap[fileSpecificHeader] = fileIndex;
            console.log(`Mapped file-specific header "${fileSpecificHeader}" to file ${fileIndex} (${file.originalName})`);

            const fileSpecificTypedHeader = `${header} (${contentType}) [${fileLabel}]`;
            processedData.headerFileMap[fileSpecificTypedHeader] = fileIndex;
            console.log(`Mapped file-specific typed header "${fileSpecificTypedHeader}" to file ${fileIndex} (${file.originalName})`);
            
            // Only map variations that match the actual content type of this file
            // This prevents cross-file header contamination
            const validVariations = [];
            
            // Add only content type specific variations for this file
            if (contentType === 'employer' || contentType === 'employment') {
              validVariations.push(
                `${header} (employer engagement)`,
                `${header} (Employer Engagement)`,
                `${header} (employer activity)`,
                `${header} (Employer Activity)`,
                `${header} (employment)`
              );
            } else if (contentType === 'enrichment') {
              validVariations.push(
                `${header} (enrichment)`,
                `${header} (Enrichment)`,
                `${header} (enrichment activity)`,
                `${header} (Enrichment Activity)`
              );
            } else if (contentType === 'placements') {
              validVariations.push(`${header} (placements)`);
            } else if (contentType === 'assessments') {
              validVariations.push(`${header} (assessments)`);
            } else if (contentType === 'careers') {
              validVariations.push(`${header} (careers)`);
            } else if (contentType === 'targets') {
              validVariations.push(`${header} (targets)`);
            } else if (contentType === 'login') {
              validVariations.push(`${header} (login)`);
            }
            
            // Map only the valid variations for this file's content type
            validVariations.forEach(variation => {
              processedData.headerFileMap[variation] = fileIndex;
              console.log(`Mapped content-specific variation "${variation}" to file ${fileIndex} (${file.originalName})`);
            });
          });
        }
        // Additionally, map original headers for this file to ensure columns render even when values are absent
        if (Array.isArray(extractedData.originalHeaders)) {
          const fileLabel = processedData.fileInfo[fileIndex]?.label || `File${fileIndex + 1}`;
          extractedData.originalHeaders.forEach(origHeader => {
            if (!origHeader) return;
            const h = String(origHeader).trim();
            if (!h) return;
            // Skip department and numeric-only headers
            const hl = h.toLowerCase();
            if (hl === 'department' || /^[0-9]+$/.test(h)) return;

            // Base mappings
            processedData.headerFileMap[h] = fileIndex;
            const typed = `${h} (${contentType})`;
            processedData.headerFileMap[typed] = fileIndex;
            // File-specific unique headers
            processedData.headerFileMap[`${h} [${fileLabel}]`] = fileIndex;
            processedData.headerFileMap[`${h} (${contentType}) [${fileLabel}]`] = fileIndex;

            // Activity synonyms based on content type
            if (contentType === 'employment' || contentType === 'employer') {
              processedData.headerFileMap[`${h} (employer)`] = fileIndex;
              processedData.headerFileMap[`${h} (employer engagement)`] = fileIndex;
              processedData.headerFileMap[`${h} (Employer Engagement)`] = fileIndex;
              processedData.headerFileMap[`${h} (employer activity)`] = fileIndex;
              processedData.headerFileMap[`${h} (Employer Activity)`] = fileIndex;
            }
            if (contentType === 'enrichment') {
              processedData.headerFileMap[`${h} (enrichment)`] = fileIndex;
              processedData.headerFileMap[`${h} (Enrichment)`] = fileIndex;
              processedData.headerFileMap[`${h} (enrichment activity)`] = fileIndex;
              processedData.headerFileMap[`${h} (Enrichment Activity)`] = fileIndex;
            }
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
    
    // Check for specific employer patterns - be more precise to avoid conflicts
    if (filenameLower.includes('employer engagement') || 
        filenameLower.includes('employer activity') || filenameLower.includes('employer activities')) {
      console.log(`✅ Detected EMPLOYER from filename`);
      return 'employer';
    }
    
    // Only check for standalone 'employer' if not in a placement context
    if (filenameLower.includes('employer') && !filenameLower.includes('placement') && !filenameLower.includes('placed')) {
      console.log(`✅ Detected EMPLOYER from filename`);
      return 'employer';
    }

    // Careers platform synonyms (e.g., My Futures)
    if (filenameLower.includes('my futures') || filenameLower.includes('myfutures') || filenameLower.includes('my-futures')) {
      console.log(`✅ Detected CAREERS (My Futures) from filename`);
      return 'careers';
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
      // Be more specific to avoid false positives with placement files
      if ((allText.includes('employernonemployer is employer activity') ||
          allText.includes('is employer activity') ||
          allText.includes('employernonemployer is employer')) &&
          !allText.includes('placement') && !allText.includes('placed')) {
        console.log(`✅ Found EMPLOYER ACTIVITY filter pattern`);
        return 'employer';
      }
      
      // Fallback patterns for other formats - be more specific
      if (allText.includes('enrichment') && !allText.includes('placement') && !allText.includes('placed')) {
        console.log(`✅ Found ENRICHMENT from general pattern`);
        return 'enrichment';
      }
      
      // Only classify as employer if it's specifically about employer activities, not placement-related employer data
      if (allText.includes('employer') && 
          (allText.includes('activity') || allText.includes('engagement')) && 
          !allText.includes('placement') && !allText.includes('placed')) {
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
        
        // More specific employer activity detection to avoid placement file conflicts
        if ((rowText.includes('employer activity') || rowText.includes('employer activities') ||
            rowText.includes('employer engagement') ||
            (rowText.includes('employer') && (rowText.includes('hours') || rowText.includes('students') || rowText.includes('activity')))) &&
            !rowText.includes('placement') && !rowText.includes('placed')) {
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
      originalHeaders: [], // Store original headers before processing
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
        
    // Capture original headers FIRST - completely unfiltered for template creation
    extracted.originalHeaders = [...headers]; // Store ALL headers including empty ones
    console.log(`Captured ALL original headers for ${fileName}:`, extracted.originalHeaders);
    
    // Find key columns based on your report structure
    const departmentColIndex = this.findColumnIndex(headers, ['Department', 'Program', 'Course', 'Category']);
    console.log(`Department column index for ${fileName}:`, departmentColIndex);
    
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
      const index = headers.findIndex(header => {
        if (!header) return false;
        const headerStr = header.toString().toLowerCase().trim();
        const nameStr = name.toLowerCase().trim();
        
        // More specific matching - exact match or starts with the name
        return headerStr === nameStr || headerStr.startsWith(nameStr);
      });
      if (index !== -1) {
        console.log(`Found department column "${headers[index]}" at index ${index} matching "${name}"`);
        return index;
      }
    }
    console.log(`No department column found, defaulting to index 0`);
    return 0; // Default to first column
  }

  parseValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // If already a number, return as-is
    if (typeof value === 'number') {
      return value;
    }

    // Normalize string
    const s = String(value).trim();
    if (!s) return null;

    // Handle percentage strings like "10.2%" or " 4% "
    const percentMatch = s.match(/^\s*(-?\d+(?:[\.,]\d+)?)\s*%\s*$/);
    if (percentMatch) {
      // Replace comma decimal separators if present and parse
      const num = parseFloat(percentMatch[1].replace(/,/g, ''));
      return isNaN(num) ? null : num; // Keep as 0-100; UI handles 0-1 and 0-100
    }

    // Remove thousands separators before parsing (e.g., "1,500" -> 1500)
    const normalized = s.replace(/,/g, '');
    const numValue = Number(normalized);
    if (!Number.isNaN(numValue)) {
      return numValue;
    }

    // Return as string if not a number
    return s;
  }

  async processFilesWithManualAssignment(files, headerAssignments) {
    console.log('\n=== PROCESSING FILES WITH MANUAL ASSIGNMENT ===');
    console.log('Header assignments:', headerAssignments);
    
    const processedData = {
      departments: [],
      metrics: {},
      activities: {
        employerEngagement: {},
        enrichment: {}
      },
      originalHeaders: [],
      timestamp: new Date().toISOString(),
      headerFileMap: {},
      fileInfo: [],
      manualAssignments: headerAssignments
    };

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      try {
        // Build a short label from the filename (sanitised) for per-file suffixing
        const parsedName = (file.originalName || '').split('.')[0] || 'file';
        let label = parsedName.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
        if (label.length > 24) label = label.substring(0, 24).trim();

        processedData.fileInfo[fileIndex] = {
          originalName: file.originalName,
          filename: file.filename,
          contentType: (file.userSelectedType && typeof file.userSelectedType === 'string') ? file.userSelectedType.toLowerCase() : 'default',
          customColor: file.userSelectedColor || '#dbeafe',
          label
        };
        
        console.log(`Processing file ${fileIndex}: "${file.originalName}" with manual assignments`);

        const fileData = await this.readFile(file.path);
        const extractedData = this.extractDataWithManualAssignment(fileData, file.originalName, fileIndex, headerAssignments);
        
        // Map original headers for this file into headerFileMap so columns render even when values are absent
        try {
          const fileLabel = processedData.fileInfo[fileIndex]?.label || `File${fileIndex + 1}`;
          const contentType = processedData.fileInfo[fileIndex]?.contentType || 'default';
          if (Array.isArray(extractedData.originalHeaders)) {
            extractedData.originalHeaders.forEach(h0 => {
              if (!h0) return;
              const h = String(h0).trim();
              if (!h || h.toLowerCase() === 'department' || /^[0-9]+$/.test(h)) return;
              processedData.headerFileMap[h] = fileIndex;
              processedData.headerFileMap[`${h} (${contentType})`] = fileIndex;
              processedData.headerFileMap[`${h} [${fileLabel}]`] = fileIndex;
              processedData.headerFileMap[`${h} (${contentType}) [${fileLabel}]`] = fileIndex;
              if (contentType === 'employer' || contentType === 'employment') {
                processedData.headerFileMap[`${h} (employer)`] = fileIndex;
                processedData.headerFileMap[`${h} (employer engagement)`] = fileIndex;
                processedData.headerFileMap[`${h} (employer activity)`] = fileIndex;
              }
              if (contentType === 'enrichment') {
                processedData.headerFileMap[`${h} (enrichment)`] = fileIndex;
                processedData.headerFileMap[`${h} (enrichment activity)`] = fileIndex;
              }
            });
          }
        } catch (_) {}

        // Merge data using manual assignment logic
        this.mergeDataWithManualAssignment(processedData, extractedData, fileIndex, headerAssignments);
      } catch (error) {
        console.error(`Error processing file ${file.originalName}:`, error);
        throw new Error(`Failed to process ${file.originalName}: ${error.message}`);
      }
    }

    console.log('\n=== MANUAL ASSIGNMENT PROCESSING COMPLETE ===');
    console.log(`Total files processed: ${processedData.fileInfo.length}`);
    console.log(`Departments found: ${processedData.departments.length}`);
    
    return processedData;
  }
  
  extractDataWithManualAssignment(fileData, fileName, fileIndex, headerAssignments) {
    const extracted = {
      departments: [],
      metrics: {},
      headerList: [],
      originalHeaders: [],
      activityType: null
    };

    // Process each sheet
    Object.keys(fileData).forEach(sheetName => {
      const sheetData = fileData[sheetName];
      if (sheetData && sheetData.length > 0) {
        this.processSheetWithManualAssignment(sheetData, extracted, fileName, fileIndex, headerAssignments);
      }
    });

    return extracted;
  }
  
  processSheetWithManualAssignment(sheetData, extracted, fileName, fileIndex, headerAssignments) {
    if (!sheetData || sheetData.length < 2) return;

    const headers = sheetData[0];
    const dataRows = sheetData.slice(1);
    
    if (!Array.isArray(headers)) {
      console.warn('Headers is not an array:', headers);
      return;
    }
        
    // Capture all headers
    extracted.originalHeaders = [...headers];
    
    // Find department column
    const departmentColIndex = this.findColumnIndex(headers, ['Department', 'Program', 'Course', 'Category']);
    
    // Process headers with manual assignments
    const assignedHeaders = headers.filter((header, index) => {
      if (!header || index === departmentColIndex) return false;
      
      const headerStr = header.toString().trim();
      if (headerStr === '' || /^[0-9]+$/.test(headerStr)) return false;
      
      // Add to header list if it has an assignment or if unassigned
      extracted.headerList.push(header);
      return true;
    });
    
    console.log(`Headers with potential assignments for ${fileName}:`, assignedHeaders);

    // Process data rows
    dataRows.forEach(row => {
      if (row && row.length > 0 && row[0]) {
        const department = row[departmentColIndex] || 'Unknown Department';
        
        // Skip metadata rows
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('enrichment activity') || rowText.includes('employer activity') ||
            rowText.includes('report date') || rowText.includes('generated on')) {
          return;
        }
        
        if (!extracted.departments.includes(department)) {
          extracted.departments.push(department);
        }

        if (!extracted.metrics[department]) {
          extracted.metrics[department] = {};
        }

        // Process each header with its assignment
        assignedHeaders.forEach((header, headerIndex) => {
          const originalIndex = headers.indexOf(header);
          if (originalIndex !== -1 && row[originalIndex] !== undefined) {
            const value = this.parseValue(row[originalIndex]);
            if (value !== null) {
              // Store with assignment info
              const assignment = headerAssignments[header];
              if (assignment) {
                const assignedMetric = `${header} (${assignment})`;
                extracted.metrics[department][assignedMetric] = value;
                console.log(`Assigned metric "${assignedMetric}" for department: ${department}`);
              } else {
                // Unassigned header - use default
                extracted.metrics[department][header] = value;
              }
            }
          }
        });
      }
    });
  }
  
  mergeDataWithManualAssignment(target, source, fileIndex, headerAssignments) {
    console.log('\n=== MERGE DATA WITH MANUAL ASSIGNMENT ===');
    
    // Merge departments
    source.departments.forEach(dept => {
      if (!target.departments.includes(dept)) {
        target.departments.push(dept);
      }
    });

    // Merge original headers
    if (source.originalHeaders && Array.isArray(source.originalHeaders)) {
      if (!target.originalHeaders) target.originalHeaders = [];
      source.originalHeaders.forEach(header => {
        if (!target.originalHeaders.includes(header)) {
          target.originalHeaders.push(header);
        }
      });
    }

    // Merge metrics with assignment-based categorization, suffixing per-file label to prevent collisions
    Object.keys(source.metrics).forEach(dept => {
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
        // Extract assignment from metric name if it was assigned
        const assignmentMatch = metric.match(/^(.+) \(([^)]+)\)$/);
        const fileLabel = (target.fileInfo && target.fileInfo[fileIndex] && target.fileInfo[fileIndex].label)
          ? target.fileInfo[fileIndex].label
          : `File${fileIndex + 1}`;
        const fileType = (target.fileInfo && target.fileInfo[fileIndex] && target.fileInfo[fileIndex].contentType)
          ? String(target.fileInfo[fileIndex].contentType).toLowerCase()
          : '';
        if (assignmentMatch) {
          const originalHeader = assignmentMatch[1];
          const assignment = assignmentMatch[2];
          
          // Route to appropriate section based on assignment
          if (assignment === 'employer' || assignment === 'employment') {
            const activityMetric = `${originalHeader} [${fileLabel}]`;
            target.activities.employerEngagement[dept][activityMetric] = value;
            target.headerFileMap[activityMetric] = fileIndex;
            // Map unlabeled and typed variants for front-end lookup
            target.headerFileMap[originalHeader] = fileIndex;
            target.headerFileMap[`${originalHeader} (employer)`] = fileIndex;
            target.headerFileMap[`${originalHeader} (employer engagement)`] = fileIndex;
            target.headerFileMap[`${originalHeader} (employer activity)`] = fileIndex;
          } else if (assignment === 'enrichment') {
            const activityMetric = `${originalHeader} [${fileLabel}]`;
            target.activities.enrichment[dept][activityMetric] = value;
            target.headerFileMap[activityMetric] = fileIndex;
            target.headerFileMap[originalHeader] = fileIndex;
            target.headerFileMap[`${originalHeader} (enrichment)`] = fileIndex;
            target.headerFileMap[`${originalHeader} (enrichment activity)`] = fileIndex;
          } else {
            // Other assignments go to regular metrics; keep assignment for color grouping and add file label
            const assignedLabeled = `${originalHeader} (${assignment}) [${fileLabel}]`;
            target.metrics[dept][assignedLabeled] = value;
            target.headerFileMap[assignedLabeled] = fileIndex;
            // Map unlabeled and typed variants for front-end lookup
            target.headerFileMap[originalHeader] = fileIndex;
            target.headerFileMap[`${originalHeader} (${assignment})`] = fileIndex;
          }
        } else {
          // No explicit per-header assignment. Respect file-level type for activities.
          const baseHeader = metric; // here 'metric' is the original header text
          if (fileType === 'employer' || fileType === 'employment') {
            const activityMetric = `${baseHeader} [${fileLabel}]`;
            target.activities.employerEngagement[dept][activityMetric] = value;
            target.headerFileMap[activityMetric] = fileIndex;
            // Map base and synonyms so the UI can resolve
            target.headerFileMap[baseHeader] = fileIndex;
            target.headerFileMap[`${baseHeader} (employer)`] = fileIndex;
            target.headerFileMap[`${baseHeader} (employer engagement)`] = fileIndex;
            target.headerFileMap[`${baseHeader} (employer activity)`] = fileIndex;
          } else if (fileType === 'enrichment') {
            const activityMetric = `${baseHeader} [${fileLabel}]`;
            target.activities.enrichment[dept][activityMetric] = value;
            target.headerFileMap[activityMetric] = fileIndex;
            target.headerFileMap[baseHeader] = fileIndex;
            target.headerFileMap[`${baseHeader} (enrichment)`] = fileIndex;
            target.headerFileMap[`${baseHeader} (enrichment activity)`] = fileIndex;
          } else {
            // Unassigned headers for non-activity files go to regular metrics, suffix with file label
            const unlabeled = `${metric} [${fileLabel}]`;
            target.metrics[dept][unlabeled] = value;
            target.headerFileMap[unlabeled] = fileIndex;
            // Map base header without label
            target.headerFileMap[metric] = fileIndex;
          }
        }
      });
    });
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

    // Merge original headers for template creation
    if (source.originalHeaders && Array.isArray(source.originalHeaders)) {
      if (!target.originalHeaders) target.originalHeaders = [];
      source.originalHeaders.forEach(header => {
        if (!target.originalHeaders.includes(header)) {
          target.originalHeaders.push(header);
        }
      });
      console.log(`Added original headers from this file:`, source.originalHeaders);
      console.log(`Total original headers now:`, target.originalHeaders);
    }

    // Determine if this is activities data
    const isEmployerActivity = contentType === 'employer' || contentType === 'employment' || source.activityType === 'employer';
    const isEnrichmentActivity = contentType === 'enrichment' || source.activityType === 'enrichment' || 
                                 (contentType === 'activities' && source.activityType === 'enrichment');
    const isGenericActivity = (contentType === 'activities' && !source.activityType) || 
                             (contentType === 'activities' && source.activityType === null);
    
    console.log(`Activity classification: isEmployer=${isEmployerActivity}, isEnrichment=${isEnrichmentActivity}, isGeneric=${isGenericActivity}`);

    // Determine a stable file label for suffixing metric names (prevents collisions across files)
    const fileLabel = (target.fileInfo && target.fileInfo[fileIndex] && target.fileInfo[fileIndex].label)
      ? target.fileInfo[fileIndex].label
      : `File${fileIndex + 1}`;

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
      // Ensure headerFileMap exists for label lookups on the front-end
      if (!target.headerFileMap) {
        target.headerFileMap = {};
      }
      
      Object.keys(source.metrics[dept]).forEach(metric => {
        const value = source.metrics[dept][metric];
        
        if (isEmployerActivity) {
          // Store in employer engagement activities - store BOTH with and without [FileLabel]
          // Store with label for multi-file scenarios
          const activityMetricWithLabel = `${metric} [${fileLabel}]`;
          target.activities.employerEngagement[dept][activityMetricWithLabel] = value;
          // ALSO store without label for direct lookup
          target.activities.employerEngagement[dept][metric] = value;
          console.log(`Added employer activity metric "${metric}" (and "${activityMetricWithLabel}") for department: ${dept}`);
          // Map headers so the UI can resolve file labels for (Employer Engagement) columns
          try {
            target.headerFileMap[activityMetricWithLabel] = fileIndex;     // Most specific (with label)
            target.headerFileMap[metric] = fileIndex;                      // Base header
            target.headerFileMap[`${metric} (employer)`] = fileIndex;      // Typed variant used internally
            target.headerFileMap[`${metric} (employer engagement)`] = fileIndex; // UI variant
            target.headerFileMap[`${metric} (Employer Engagement)`] = fileIndex; // Capitalised UI variant
            target.headerFileMap[`${metric} (employer activity)`] = fileIndex;   // Alternative UI variant
            target.headerFileMap[`${metric} (Employer Activity)`] = fileIndex;   // Capitalised alternative
          } catch (_) {}
        } else if (isEnrichmentActivity) {
          // Store in enrichment activities - store BOTH with and without [FileLabel]
          // Store with label for multi-file scenarios
          const activityMetricWithLabel = `${metric} [${fileLabel}]`;
          target.activities.enrichment[dept][activityMetricWithLabel] = value;
          // ALSO store without label for direct lookup
          target.activities.enrichment[dept][metric] = value;
          console.log(`Added enrichment activity metric "${metric}" (and "${activityMetricWithLabel}") for department: ${dept}`);
          // Map headers so the UI can resolve file labels for (Enrichment) columns
          try {
            target.headerFileMap[activityMetricWithLabel] = fileIndex;      // Most specific (with label)
            target.headerFileMap[metric] = fileIndex;                       // Base header
            target.headerFileMap[`${metric} (enrichment)`] = fileIndex;     // Typed variant used internally
            target.headerFileMap[`${metric} (Enrichment)`] = fileIndex;     // Capitalised variant used in tables
            target.headerFileMap[`${metric} (enrichment activity)`] = fileIndex; // Alternative UI variant
            target.headerFileMap[`${metric} (Enrichment Activity)`] = fileIndex; // Capitalised alternative
          } catch (_) {}
        } else if (isGenericActivity) {
          // For generic activities (no specific type detected), add as regular metrics with Activity label
          const activityMetric = `${metric} (Activity) [${fileLabel}]`;
          target.metrics[dept][activityMetric] = value;
          console.log(`Added generic activity metric "${activityMetric}" for department: ${dept}`);
        } else {
          // Store in regular metrics with content type
          const uniqueMetric = `${metric} (${contentType}) [${fileLabel}]`;
          target.metrics[dept][uniqueMetric] = value;
          console.log(`Added regular metric "${uniqueMetric}" for department: ${dept}`);
        }
      });
    });
  }
}

module.exports = DataImporter; 