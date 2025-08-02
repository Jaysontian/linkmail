# LinkMail Backend Migration Guide

## Overview

This guide documents the migration from direct Gmail API access to a backend-mediated architecture to avoid Chrome Web Store Tier 2 CASA assessment requirements.

## What Changed

### Before (Triggering CASA)
```
Extension → Chrome Identity API → Gmail API (sensitive scopes)
```

### After (Avoiding CASA)  
```
Extension → LinkMail Backend → Gmail API (backend handles OAuth)
```

## Key Benefits

✅ **Avoids Tier 2 CASA assessment** - Extension no longer requests sensitive scopes  
✅ **Maintains all functionality** - Users can still send emails seamlessly  
✅ **Improved security** - Centralized OAuth token management  
✅ **Better user experience** - Single sign-on across devices  
✅ **Scalability** - Backend can handle additional features  

## Architecture Changes

### Extension Changes
- ❌ Removed `identity` and `identity.email` permissions
- ❌ Removed `oauth2` configuration from manifest
- ❌ Removed Gmail API host permissions
- ✅ Added `backend/backend-api.js` for API communication
- ✅ Updated `send/email-sender.js` to use backend API
- ✅ Updated `background.js` for backend authentication
- ✅ Updated `content/ui-manager.js` for new auth flow

### New Backend Service
- ✅ Express.js server with security middleware
- ✅ Google OAuth 2.0 flow handling
- ✅ JWT-based session management
- ✅ Gmail API integration
- ✅ Email history storage
- ✅ User profile management

## Deployment Steps

### 1. Deploy Backend Service

#### Option A: Vercel (Recommended)
```bash
cd backend-service
npm install
vercel
```

#### Option B: Heroku
```bash
cd backend-service
npm install
heroku create linkmail-backend-[your-name]
git add .
git commit -m "Deploy backend"
git push heroku main
```

#### Option C: Railway
1. Connect GitHub repository to Railway
2. Select `backend-service` folder
3. Set environment variables
4. Deploy automatically

### 2. Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials:
   - Application type: **Web application**
   - Authorized redirect URIs: 
     - `https://your-backend-url.vercel.app/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback` (for development)

5. Configure OAuth consent screen:
   - Add scopes: `gmail.modify`, `userinfo.email`, `userinfo.profile`
   - Add test users for development

### 3. Set Environment Variables

Set these in your deployment platform:

```env
# Required
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-backend-url.vercel.app/api/auth/google/callback
JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random

# Optional
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com
```

### 4. Update Extension Configuration

Update `backend/backend-api.js` in your extension:

```javascript
// Change this line:
baseURL: 'https://your-backend-url.vercel.app'
```

### 5. Test the Integration

1. Load the updated extension in Chrome
2. Visit any LinkedIn profile page
3. Click "Sign in with Google" in the LinkMail extension
4. Complete OAuth flow in the new tab
5. Return to LinkedIn and verify authentication worked
6. Test sending an email

## Development Setup

### Backend Development

```bash
cd backend-service
npm install
cp .env.example .env
# Configure .env with your Google OAuth credentials
npm run dev
```

The backend will run on `http://localhost:3000`

### Extension Development

1. Update `backend/backend-api.js` baseURL for local development:
   ```javascript
   baseURL: 'http://localhost:3000'
   ```

2. Load extension in Chrome (Developer mode)
3. Test on LinkedIn profiles

## Authentication Flow

### 1. User clicks "Sign in with Google"
- Extension calls `BackendAPI.startAuthFlow()`
- Opens backend OAuth URL in new tab

### 2. User completes OAuth in new tab
- Backend handles Google OAuth flow
- User grants Gmail permissions to backend
- Backend generates JWT token
- Success page displays with auto-close

### 3. Extension detects authentication
- Polls for authentication completion
- Retrieves user data from backend
- Updates UI to authenticated state

### 4. Sending emails
- Extension calls `BackendAPI.sendEmail()`
- Backend uses stored Google tokens
- Email sent via Gmail API
- History saved to backend

## Security Considerations

### Extension Security
- No sensitive tokens stored in extension
- Only user session data in local storage
- Communication over HTTPS only

### Backend Security
- Helmet for security headers
- Rate limiting to prevent abuse
- JWT tokens with expiration
- Input validation on all endpoints
- CORS restricted to extension and frontend

## Monitoring & Debugging

### Backend Logs
Check your deployment platform logs:
- Vercel: Dashboard → Functions → View Logs
- Heroku: `heroku logs --tail`
- Railway: Dashboard → Deployments → View Logs

### Extension Debugging
1. Open Chrome DevTools on LinkedIn page
2. Check Console tab for errors
3. Verify BackendAPI is loaded: `window.BackendAPI`
4. Check authentication status: `window.BackendAPI.isAuthenticated`

### Common Issues

**Authentication fails**
- Check Google OAuth credentials
- Verify redirect URI matches exactly
- Check if Gmail API is enabled

**Extension can't reach backend**
- Verify backend URL in `backend-api.js`
- Check CORS configuration
- Ensure backend is deployed and running

**Email sending fails**
- Check user has granted Gmail permissions
- Verify Google tokens are valid
- Check Gmail API quotas

## Production Checklist

- [ ] Backend deployed and accessible
- [ ] Google OAuth configured correctly
- [ ] Environment variables set
- [ ] Extension updated with backend URL
- [ ] Extension tested end-to-end
- [ ] Error handling verified
- [ ] Rate limiting configured
- [ ] Monitoring set up

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all environment variables are set
3. Test the backend endpoints directly
4. Check browser console for errors
5. Review backend logs for issues

## Next Steps

With this migration complete, you can:

1. **Submit to Chrome Web Store** without CASA requirements
2. **Add more features** like email templates sync
3. **Scale the backend** for multiple users
4. **Add analytics** for usage tracking
5. **Implement premium features** with user accounts

The backend architecture provides a solid foundation for future enhancements while ensuring Chrome Web Store compliance.