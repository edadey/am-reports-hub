#!/bin/bash
# cPanel Startup Script for AM Reports

echo "🚀 Starting AM Reports on cPanel..."

# Set environment
export NODE_ENV=production
export PORT=3000

# Check if app is already running
if pgrep -f "node app.js" > /dev/null; then
    echo "⚠️ App is already running. Stopping..."
    pkill -f "node app.js"
    sleep 2
fi

# Start the application
echo "✅ Starting application..."
node app.js > app.log 2>&1 &

echo "✅ Application started. Check app.log for details."
echo "🌐 Access at: https://reports.navigate.uk.com"
