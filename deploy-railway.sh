#!/bin/bash

echo "🚀 Railway PostgreSQL Deployment Script"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔍 Testing database connection..."
npm run db:test

if [ $? -eq 0 ]; then
    echo "✅ Database connection test passed!"
    
    echo "🗄️ Setting up database..."
    npm run db:setup
    
    if [ $? -eq 0 ]; then
        echo "✅ Database setup completed!"
        
        echo "📊 Running data migration (if needed)..."
        npm run db:migrate
        
        echo "🚀 Ready to deploy to Railway!"
        echo ""
        echo "Next steps:"
        echo "1. Commit your changes: git add . && git commit -m 'Fix Railway PostgreSQL connection'"
        echo "2. Push to GitHub: git push origin main"
        echo "3. Railway will automatically deploy"
        echo "4. Check Railway dashboard for deployment status"
        echo "5. Test health endpoint: curl https://your-app-url.railway.app/health"
        
    else
        echo "❌ Database setup failed!"
        exit 1
    fi
else
    echo "❌ Database connection test failed!"
    echo ""
    echo "Please check:"
    echo "1. DATABASE_URL is set in Railway environment variables"
    echo "2. PostgreSQL service is active in Railway"
    echo "3. Network connectivity"
    echo ""
    echo "Run 'npm run db:test' for detailed error information."
    exit 1
fi 