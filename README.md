# AM Reports Centre

A comprehensive web-based system for automating weekly Excel report sheets updated from PowerBI exports for 50+ colleges managed by 5 account managers.

## 🚀 Features

### Core Functionality
- **Data Import & Processing**: Upload PowerBI Excel/CSV files with automatic data processing
- **Report Generation**: Generate professional Excel reports with visual elements and change tracking
- **College Management**: Complete CRUD operations for colleges with account manager assignment
- **Template System**: Save and apply data templates with flexible/strict matching modes
- **Account Manager Management**: Manage account managers and assign colleges
- **College Dashboards**: Individual college dashboards with analytics and report history

### Advanced Features
- **Change Tracking**: Visual +/- indicators showing changes from previous reports
- **Percentage Bars**: Color-coded progress bars for percentage columns
- **Bulk Operations**: Multi-select and bulk delete for rows and columns
- **Undo Functionality**: Restore deleted colleges with 10-second undo window
- **Excel Export**: Professional Excel files with formatting and visual elements
- **AI Analysis**: Automated insights and analysis of report data

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **File Processing**: ExcelJS, Multer
- **Data Storage**: JSON files (with option to migrate to database)
- **Deployment**: Static export with FTP deployment

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AM-Reports
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create data directories**
   ```bash
   mkdir -p data uploads reports templates
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Access the application**
   - Open http://localhost:3000 in your browser
   - The application will be available at the root URL

## 🔒 Security Features

### Data Protection
- **Sensitive Data Exclusion**: All data files are excluded from Git via `.gitignore`
- **Environment Variables**: Configuration stored in `.env` files (not committed)
- **Input Validation**: Server-side validation for all user inputs
- **File Upload Security**: Restricted file types and size limits

### Access Control
- **Account Manager Assignment**: Colleges are assigned to specific account managers
- **Data Isolation**: Reports and data are organized by college and account manager
- **Audit Trail**: All operations are logged with timestamps

### File Security
- **Upload Validation**: Only Excel/CSV files accepted
- **Path Traversal Protection**: Secure file handling
- **Temporary File Cleanup**: Automatic cleanup of temporary files

## 📁 Project Structure

```
AM-Reports/
├── public/                 # Frontend files
│   ├── index.html         # Main application
│   ├── college-dashboard.html
│   └── css/               # Stylesheets
├── src/                   # Backend source code
│   ├── index.js          # Main server file
│   └── services/         # Business logic services
│       ├── UserManager.js
│       ├── DataImporter.js
│       ├── AIAnalyzer.js
│       └── ReportScheduler.js
├── data/                  # Data storage (gitignored)
├── uploads/              # File uploads (gitignored)
├── reports/              # Generated reports (gitignored)
├── templates/            # Saved templates (gitignored)
├── package.json
├── .gitignore
└── README.md
```

## 🚀 Usage

### Getting Started
1. **Upload Data**: Go to "Reports" tab and upload PowerBI Excel/CSV files
2. **Process Files**: Click "Process Files" to import and structure the data
3. **Edit Data**: Use the interactive table to edit data as needed
4. **Save Template**: Save the current structure as a template for future use
5. **Generate Report**: Export the final report as an Excel file

### College Management
1. **Add Colleges**: Use "Add College" button to create new college records
2. **Assign Account Managers**: Assign colleges to specific account managers
3. **Edit Colleges**: Click "Edit" to modify college information
4. **View Dashboards**: Click "Dashboard" to view individual college analytics

### Template System
1. **Create Templates**: Save current table structure as reusable templates
2. **Apply Templates**: Use templates when processing new data
3. **Template Modes**: Choose between strict (exact columns) or flexible (add new columns)

## 🔧 Configuration

### Environment Variables
Create a `.env` file with the following variables:

```env
PORT=3000
NODE_ENV=development
UPLOAD_MAX_SIZE=10485760
ALLOWED_FILE_TYPES=.xlsx,.xls,.csv
```

### Data Files
The following data files are automatically created:
- `data/colleges.json` - College information
- `data/accountManagers.json` - Account manager data
- `data/users.json` - User accounts
- `data/templates.json` - Saved templates
- `data/previous-reports.json` - Previous report data for change tracking

## 🚀 Deployment

### Development
```bash
npm start
```

### Production
```bash
NODE_ENV=production npm start
```

### Static Export (for hosting)
```bash
npm run build
# Deploy the 'public' directory to your web server
```

## 🔍 API Endpoints

### Colleges
- `GET /api/colleges` - List all colleges
- `POST /api/colleges` - Create new college
- `PUT /api/colleges/:id` - Update college
- `DELETE /api/colleges/:id` - Delete college
- `POST /api/colleges/:id/assign-account-manager` - Assign account manager

### Account Managers
- `GET /api/account-managers` - List account managers
- `POST /api/account-managers` - Create account manager
- `PUT /api/account-managers/:id` - Update account manager
- `DELETE /api/account-managers/:id` - Delete account manager

### Reports
- `POST /api/upload` - Upload and process files
- `POST /api/save-template` - Save template
- `GET /api/templates` - List templates
- `DELETE /api/templates/:name` - Delete template

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in .env file or kill existing process
   lsof -ti:3000 | xargs kill -9
   ```

2. **File upload fails**
   - Check file size (max 10MB)
   - Ensure file is Excel/CSV format
   - Verify uploads directory exists

3. **Data not saving**
   - Check data directory permissions
   - Verify JSON file format
   - Check server logs for errors

### Logs
Check the console output for detailed error messages and debugging information.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support and questions:
- Check the troubleshooting section
- Review the API documentation
- Contact the development team

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added college dashboards and analytics
- **v1.2.0** - Enhanced template system and bulk operations
- **v1.3.0** - Added edit/delete functionality with undo capability 