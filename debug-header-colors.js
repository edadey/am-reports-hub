const { chromium } = require('playwright');

async function debugHeaderColors() {
  console.log('🚀 Starting Playwright debug session...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console logs from the page
  page.on('console', msg => {
    const text = msg.text();
    // Filter for our debug logs
    if (text.includes('🔍') || text.includes('📁') || text.includes('🏢') || text.includes('🎯') || text.includes('⚠️')) {
      console.log(`[BROWSER] ${text}`);
    }
  });

  try {
    console.log('🌐 Navigating to login with redirect to new generator page...');
    await page.goto('http://localhost:3000/login.html?redirect=/generate-report.html');
    
    console.log('⏳ Waiting for login page to load...');
    await page.waitForLoadState('networkidle');

    // If login form is hidden behind the button, reveal it
    const hasRevealBtn = await page.locator('#showEmailLoginBtn').count();
    if (hasRevealBtn) {
      await page.click('#showEmailLoginBtn');
    }

    // Perform login
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    await page.fill('#username', 'admin');
    await page.fill('#password', adminPassword);
    await page.click('#loginBtn');

    console.log('🔑 Submitted credentials, waiting for redirect to new generator...');
    await page.waitForURL('**/generate-report.html**', { timeout: 20000 });

    console.log('📄 On generate-report page. Preparing to upload sample files...');

    // Upload sample files (use both to ensure fileInfo has variety)
    const workspace = '/Users/emmanueldadey/AM Reports New copy';
    const filesToUpload = [
      `${workspace}/colored-template-test.xlsx`,
      `${workspace}/test-template.csv`
    ];

    // Some files may not exist; filter to existing ones
    const existing = [];
    for (const f of filesToUpload) {
      try {
        await page.evaluate(async (p) => {
          const res = await fetch('file://' + p).catch(() => null);
          return !!res;
        }, f);
        // Playwright cannot fetch file://; fall back to trusting paths
        existing.push(f);
      } catch (_) {
        existing.push(f);
      }
    }

    if (existing.length === 0) {
      console.warn('⚠️ No sample files found. Please place test files in the project root.');
    } else {
      await page.setInputFiles('#fileInput', existing);
      await page.click('#processBtn');

      console.log('⏳ Waiting for table headers to render...');
      await page.waitForSelector('#tableHeader th', { timeout: 60000 });
      // Give a little extra time for colouring logic
      await page.waitForTimeout(2000);
    }

    // Inspect availability of data objects used for colouring
    console.log('\n🔎 Checking presence of headerFileMap and fileInfo...');
    const mapInfo = await page.evaluate(() => {
      return {
        hasWindowHeaderFileMap: typeof window.headerFileMap !== 'undefined' && window.headerFileMap !== null,
        windowHeaderFileMapSize: typeof window.headerFileMap === 'object' && window.headerFileMap ? Object.keys(window.headerFileMap).length : 0,
        hasWindowFileInfo: Array.isArray(window.fileInfo),
        windowFileInfoLength: Array.isArray(window.fileInfo) ? window.fileInfo.length : 0,
        windowFileInfoTypes: Array.isArray(window.fileInfo) ? window.fileInfo.map(fi => fi && fi.contentType) : []
      };
    });
    console.log('📋 Map/Info availability:', mapInfo);

    console.log('🔍 Looking for ALL table headers...');
    
    // Find all table headers
    const allHeaders = await page.locator('th').all();
    console.log(`Found ${allHeaders.length} total headers`);
    
    // Group headers by background color
    const headersByColor = {};
    const headerDetails = [];
    
    for (let i = 0; i < allHeaders.length; i++) {
      const header = allHeaders[i];
      const headerText = await header.textContent();
      const classes = await header.getAttribute('class');
      const styles = await header.getAttribute('style');
      
      // Get computed background color
      const bgColor = await header.evaluate(el => getComputedStyle(el).backgroundColor);
      
      const headerInfo = {
        index: i + 1,
        text: headerText?.trim(),
        classes: classes,
        styles: styles,
        bgColor: bgColor
      };
      
      headerDetails.push(headerInfo);
      
      // Group by color
      if (!headersByColor[bgColor]) {
        headersByColor[bgColor] = [];
      }
      headersByColor[bgColor].push(headerText?.trim());
    }
    
    console.log('\n📊 ALL HEADERS ANALYSIS:');
    console.log('='.repeat(50));
    
    // Show headers grouped by color
    Object.keys(headersByColor).forEach(color => {
      console.log(`\n🎨 Background Color: ${color}`);
      console.log(`   Headers (${headersByColor[color].length}):`, headersByColor[color]);
    });
    
    console.log('\n📋 DETAILED HEADER INFO:');
    console.log('='.repeat(50));
    
    // Show detailed info for specific headers we care about
    const targetHeaders = [
      'TOTAL STUDENTS (EMPLOYER ACTIVITY)',
      'STUDENTS WITH ACTIVITIES (EMPLOYER ACTIVITY)', 
      'TOTAL STUDENTS (DEFAULT)',
      'STUDENTS WITHOUT ASSESSMENTS (DEFAULT)',
      'STUDENTS WITH 1 ASSESSMENT (DEFAULT)'
    ];
    
    targetHeaders.forEach(targetHeader => {
      const matching = headerDetails.filter(h => h.text && h.text.includes(targetHeader.replace(' (DEFAULT)', '').replace(' (EMPLOYER ACTIVITY)', '')));
      if (matching.length > 0) {
        console.log(`\n🎯 "${targetHeader}" matches:`);
        matching.forEach(match => {
          console.log(`   "${match.text}" -> ${match.bgColor}`);
        });
      }
    });
    
    // Test the getColumnSection function directly
    console.log('\n🧪 Testing getColumnSection function directly...');
    const testResults = await page.evaluate(() => {
      if (typeof getColumnSection === 'function') {
        const ths = Array.from(document.querySelectorAll('#tableHeader th')).map(th => th.textContent.trim());
        const sample = ths.slice(0, Math.min(10, ths.length));
        const results = {};
        sample.forEach(h => {
          try {
            const r = getColumnSection(h);
            results[h] = { section: r.section, color: r.color, contentType: r.contentType };
          } catch (e) {
            results[h] = { error: e.message };
          }
        });
        return {
          results,
          thCount: ths.length,
          sampleCount: sample.length,
          hasWindowHeaderFileMap: !!window.headerFileMap,
          hasWindowFileInfo: Array.isArray(window.fileInfo)
        };
      }
      return { error: 'getColumnSection function not found' };
    });
    
    console.log('📋 Function test results:');
    if (testResults.results) {
      Object.keys(testResults.results).forEach(header => {
        const result = testResults.results[header];
        console.log(`   "${header}" ->`, result);
      });
      console.log(`\n📊 Function test meta:`, { thCount: testResults.thCount, sampleCount: testResults.sampleCount, hasWindowHeaderFileMap: testResults.hasWindowHeaderFileMap, hasWindowFileInfo: testResults.hasWindowFileInfo });
    } else {
      console.log(testResults);
    }
    
    // Keep browser open for manual inspection
    console.log('\n✅ Debug complete! Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely (until user closes)
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await browser.close();
  }
}

// Run the debug function
debugHeaderColors().catch(console.error);