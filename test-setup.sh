#!/bin/bash

# LinkMail Test Setup Script
echo "🧪 LinkMail Testing Guide"
echo "========================="

# Check if backend is running
echo "📡 Checking backend server..."
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is running on port 3000"
    curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
else
    echo "❌ Backend is not running!"
    echo ""
    echo "To start the backend:"
    echo "  cd backend-service"
    echo "  node index.js"
    echo ""
    exit 1
fi

echo ""
echo "🔧 Backend Endpoints:"
echo "  Health Check: http://localhost:3000/health"
echo "  OAuth Start:  http://localhost:3000/api/auth/google?source=extension"
echo ""

echo "🌐 Google Cloud Console Setup Required:"
echo "  1. Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com"
echo "  2. OAuth Consent: https://console.cloud.google.com/apis/credentials/consent"
echo "  3. Add test users (your Gmail address)"
echo ""

echo "🔌 Chrome Extension Setup:"
echo "  1. Go to: chrome://extensions/"
echo "  2. Enable Developer mode"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $(pwd)"
echo ""

echo "✅ Ready to test! Visit a LinkedIn profile and use the extension."

# Optional: Open test URLs
read -p "Open test OAuth URL in browser? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "http://localhost:3000/api/auth/google?source=extension"
fi