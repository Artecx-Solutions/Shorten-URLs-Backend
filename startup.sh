#!/bin/bash

# Azure startup script
echo "🚀 Starting Link Shortener Backend..."

# Set environment variables if not set
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8080}

# Log environment
echo "Environment: $NODE_ENV"
echo "Port: $PORT"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Start the application
echo "🎉 Starting application..."
npm start
