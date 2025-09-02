// Email sending diagnostic script
// Run these commands in browser console to debug email sending issues


// 1. Test backend connectivity
async function testBackendConnectivity() {
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return;
  }
  
  try {
    const result = await window.BackendAPI.testConnectivity();
    if (result.success) {
    } else {
      console.error('❌ Backend connectivity test failed');
      console.error('📊 Error:', result);
    }
    return result;
  } catch (error) {
    console.error('❌ Connectivity test error:', error);
    return { success: false, error: error.message };
  }
}

// 2. Check authentication status
async function checkAuthStatus() {
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return;
  }
  
  try {
    const authState = await window.BackendAPI.debugAuthState();
    
    if (authState.currentState.isAuthenticated) {
    } else {
      console.error('❌ User is not authenticated');
    }
    
    return authState;
  } catch (error) {
    console.error('❌ Auth status check error:', error);
    return null;
  }
}

// 3. Validate authentication
async function validateAuth() {
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return false;
  }
  
  try {
    const isValid = await window.BackendAPI.validateAuth();
    if (isValid) {
    } else {
      console.error('❌ Authentication is invalid');
    }
    return isValid;
  } catch (error) {
    console.error('❌ Auth validation error:', error);
    return false;
  }
}

// 4. Test email sending (dry run)
async function testEmailSending() {
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return;
  }
  
  const testEmailData = {
    to: 'test@example.com',
    subject: 'Test Email from LinkMail Extension',
    body: 'This is a test email to verify the email sending functionality.',
    attachments: []
  };
  
  
  try {
    const result = await window.BackendAPI.sendEmail(
      testEmailData.to,
      testEmailData.subject,
      testEmailData.body,
      testEmailData.attachments
    );
    return result;
  } catch (error) {
    console.error('❌ Email sending test failed');
    console.error('📊 Error:', error.message);
    console.error('📊 Full error:', error);
    return { success: false, error: error.message };
  }
}

// 5. Run full diagnostic
async function runFullDiagnostic() {
  
  const results = {
    connectivity: await testBackendConnectivity(),
    authStatus: await checkAuthStatus(),
    authValidation: await validateAuth(),
    emailTest: null
  };
  
  // Only test email sending if auth is valid
  if (results.authValidation) {
    
    // For now, skip actual email test in diagnostic
  }
  
  
  return results;
}

// 6. Get current email form data
function getCurrentEmailData() {
  
  const recipientInput = document.getElementById('recipientEmailInput');
  const subjectInput = document.getElementById('emailSubject');
  const bodyTextarea = document.getElementById('emailResult');
  
  const data = {
    to: recipientInput?.value || '',
    subject: subjectInput?.value || '',
    body: bodyTextarea?.value || ''
  };
  
  
  // Validate the data
  const isValid = data.to && data.subject && data.body;
  
  if (!isValid) {
    const missing = [];
    if (!data.to) missing.push('recipient email');
    if (!data.subject) missing.push('subject');
    if (!data.body) missing.push('body');
    console.error('❌ Missing required fields:', missing.join(', '));
  }
  
  return data;
}

// Make functions available globally
window.emailDiagnostic = {
  testBackendConnectivity,
  checkAuthStatus,
  validateAuth,
  testEmailSending,
  runFullDiagnostic,
  getCurrentEmailData
};


