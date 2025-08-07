#!/bin/bash

echo "🚀 Starting AM Reports Hub..."

# Set environment variables if not already set
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}

echo "📋 Environment: $NODE_ENV"
echo "🔌 Port: $PORT"

# Check if we're in Railway environment
if [ -n "$RAILWAY_ENVIRONMENT" ]; then
    echo "🚂 Railway environment detected: $RAILWAY_ENVIRONMENT"
fi

# Start the application
echo "🎯 Starting Node.js application..."
exec node --max-old-space-size=4096 app.js
