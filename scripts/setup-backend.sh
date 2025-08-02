#!/bin/bash

# LinkMail Backend Setup Script
# This script helps set up the backend service for deployment

echo "🚀 LinkMail Backend Setup"
echo "========================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script should be run from the linkmail project root directory"
    exit 1
fi

# Check if backend-service directory exists
if [ ! -d "backend-service" ]; then
    echo "❌ Error: backend-service directory not found"
    exit 1
fi

echo "📁 Moving to backend-service directory..."
cd backend-service

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file - please configure with your values"
    else
        echo "⚠️  .env.example not found, creating basic .env file..."
        cat > .env << EOL
# LinkMail Backend Environment Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=change-this-to-a-long-random-string
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
EOL
        echo "✅ Created basic .env file - please configure with your values"
    fi
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo ""
echo "1. Configure your .env file with Google OAuth credentials:"
echo "   - Get credentials from: https://console.cloud.google.com/"
echo "   - Enable Gmail API"
echo "   - Set up OAuth consent screen"
echo ""
echo "2. Test locally:"
echo "   cd backend-service"
echo "   npm run dev"
echo ""
echo "3. Deploy to Vercel:"
echo "   npm install -g vercel"
echo "   vercel"
echo ""
echo "4. Update extension configuration:"
echo "   - Edit backend/backend-api.js"
echo "   - Update baseURL to your deployed backend URL"
echo ""
echo "📖 See BACKEND_MIGRATION_GUIDE.md for detailed instructions"
echo ""
echo "✨ Happy deploying!"