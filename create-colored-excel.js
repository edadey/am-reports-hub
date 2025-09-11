// Create a test Excel file with colored headers
const XLSX = require('xlsx');
const path = require('path');

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Create sample data
const data = [
  ['Department', 'Careers', 'Placements', 'Total Students', 'Employment Rate'],
  ['A LEVEL & APPLIED SCIENCES', 50, 25, 100, '85%'],
  ['ACCESS', 30, 15, 75, '80%'],
  ['ART & DESIGN FE', 20, 10, 60, '90%']
];

// Create worksheet
const worksheet = XLSX.utils.aoa_to_sheet(data);

// Add colors to headers
const headerColors = ['#FFE6CC', '#E6F3FF', '#E6FFE6', '#FFE6F3', '#FFFFE6']; // Light colors

// Apply colors to header row (row 0)
for (let col = 0; col < headerColors.length; col++) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
  if (!worksheet[cellAddress]) continue;
  
  // Create cell style with background color
  worksheet[cellAddress].s = {
    fill: {
      patternType: 'solid',
      bgColor: { rgb: headerColors[col].replace('#', '') }
    }
  };
}

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

// Write the file
const filePath = path.join(__dirname, 'colored-template-test.xlsx');
XLSX.writeFile(workbook, filePath);

console.log(`✅ Created colored Excel file: ${filePath}`);
console.log('📎 Header colors:', headerColors);