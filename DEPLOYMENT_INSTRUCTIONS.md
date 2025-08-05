# cPanel Deployment Instructions

## 🚀 Quick Deployment

### Step 1: Upload Files
1. Upload the extracted package to your cPanel hosting
2. Extract in: `/home/1001706/public_html/reports.navigate.uk.com/`

### Step 2: Set Permissions
```bash
chmod 755 data/
chmod 644 data/*.json
chmod 755 backups/
chmod 755 uploads/
chmod 755 templates/
chmod 644 .htaccess
```

### Step 3: Install Dependencies
```bash
npm install --production
```

### Step 4: Set Environment Variables
1. Go to cPanel > Software > Setup Node.js App
2. Set environment variables:
   - OPENAI_API_KEY=your_api_key
   - NODE_ENV=production
   - PORT=3000 (or your preferred port)

### Step 5: Start Application
1. In cPanel Node.js App settings, set:
   - Node.js version: 10.24.1 (or available version)
   - Application root: /home/1001706/public_html/reports.navigate.uk.com
   - Application URL: https://reports.navigate.uk.com
   - Application startup file: app.js
   - Passenger port: 3000

### Step 6: Verify Deployment
- Visit: https://reports.navigate.uk.com
- Check API endpoints: https://reports.navigate.uk.com/api/health
- Verify data loading: https://reports.navigate.uk.com/api/colleges

## 🔧 Troubleshooting

### Common Issues:
1. **Port conflicts**: Change PORT in environment variables
2. **Permission errors**: Run chmod commands above
3. **Module not found**: Run `npm install` again
4. **Environment variables**: Check cPanel Node.js settings

### Logs:
- Check cPanel error logs
- Application logs in: /home/1001706/public_html/reports.navigate.uk.com/logs/

## 📞 Support
If issues persist, check the CPANEL_DEPLOYMENT_GUIDE.md for detailed troubleshooting.
