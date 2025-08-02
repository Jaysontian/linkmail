# LinkMail Testing Checklist ✅

## Prerequisites Setup

### ✅ Backend Running
- [x] Backend server started: `node backend-service/index.js`
- [x] Health check working: http://localhost:3000/health
- [x] OAuth endpoint responding: http://localhost:3000/api/auth/google

### 🔧 Google Cloud Console Setup

**Required before testing:**

1. **Enable Gmail API**
   - Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - Click "Enable"

2. **Configure OAuth Consent Screen**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Choose "External" user type
   - Fill required fields:
     - App name: `LinkMail`
     - User support email: Your email
     - Developer contact email: Your email
   - **Add Scopes:**
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`

3. **Add Test Users**
   - In OAuth consent screen, go to "Test users"
   - Add your Gmail address

### 🔌 Chrome Extension Setup

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select folder: `/Users/ishaangupta/Desktop/linkmail`

## Testing Flow

### Step 1: Load Extension
- [ ] Extension appears in Chrome extensions list
- [ ] No errors in console
- [ ] Extension icon visible in toolbar

### Step 2: Visit LinkedIn
- [ ] Go to any LinkedIn profile (e.g., https://www.linkedin.com/in/someone)
- [ ] Page loads completely
- [ ] LinkMail extension icon appears on profile

### Step 3: Test Authentication
- [ ] Click LinkMail extension
- [ ] Extension popup/overlay appears
- [ ] Click "Sign in with Google"
- [ ] New tab opens with Google OAuth
- [ ] Google shows permission screen for LinkMail
- [ ] Click "Allow" to grant permissions
- [ ] Tab redirects to success page
- [ ] Tab can be closed
- [ ] Return to LinkedIn - extension should show as authenticated

### Step 4: Test Email Finding
- [ ] Extension shows "Find Email" option
- [ ] Click to find email address
- [ ] Email address appears (if available via Apollo)

### Step 5: Test Email Sending
- [ ] Fill out email form:
  - [ ] Recipient email populated
  - [ ] Subject line filled
  - [ ] Email body generated/written
- [ ] Click "Send Email"
- [ ] Success message appears
- [ ] Email appears in your Gmail Sent folder

### Step 6: Test Email History
- [ ] Extension shows email history
- [ ] Recently sent email appears in list

## Troubleshooting

### Backend Issues
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check backend logs
tail -f backend-service/logs/app.log  # if exists

# Restart backend
cd backend-service
node index.js
```

### Extension Issues
- **Check Chrome DevTools Console** (F12) for errors
- **Reload extension**: Go to chrome://extensions/ → click reload
- **Check extension console**: Right-click extension icon → "Inspect popup"

### OAuth Issues
- **Verify redirect URI** matches Google Cloud Console exactly
- **Check Gmail API** is enabled
- **Verify test user** is added to OAuth consent screen
- **Clear browser cache** and try again

### Common Error Messages

**"Backend API not available"**
- Backend server not running
- Check http://localhost:3000/health

**"User not authenticated"**
- OAuth flow not completed
- Try signing in again

**"Gmail permission denied"**
- Gmail API not enabled
- Insufficient OAuth scopes
- Test user not added

**"Extension context invalidated"**
- Reload the extension
- Refresh the LinkedIn page

## Success Criteria

✅ **Extension loads without errors**  
✅ **Authentication flow completes**  
✅ **Email addresses can be found**  
✅ **Emails can be sent successfully**  
✅ **Email history is tracked**  
✅ **No console errors during use**

## Test Data

**Test LinkedIn Profiles:**
- https://www.linkedin.com/in/satyanadella
- https://www.linkedin.com/in/jeffweiner08
- https://www.linkedin.com/in/reidhoffman

**Test Gmail Account:**
- Use the Gmail account you added as a test user

## Performance Checks

- [ ] Extension loads quickly (< 2 seconds)
- [ ] Email sending completes in reasonable time (< 10 seconds)
- [ ] No memory leaks in Chrome task manager
- [ ] Backend responds quickly to API calls

## Final Validation

After completing all tests:

1. **Send a real email** to yourself using the extension
2. **Check Gmail Sent folder** to confirm email was sent
3. **Reply to the email** to confirm it came from your account
4. **Check email history** in the extension

If all tests pass: **🎉 Ready for production deployment!**