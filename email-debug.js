// Email sending diagnostic script
// Run these commands in browser console to debug email sending issues

console.log('=== EMAIL SENDING DIAGNOSTIC TOOLS ===');

// 1. Test backend connectivity
async function testBackendConnectivity() {
  console.log('\n--- Testing Backend Connectivity ---');
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return;
  }
  
  try {
    const result = await window.BackendAPI.testConnectivity();
    if (result.success) {
      console.log('✅ Backend connectivity test passed');
      console.log('📊 Response:', result);
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
  console.log('\n--- Checking Authentication Status ---');
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return;
  }
  
  try {
    const authState = await window.BackendAPI.debugAuthState();
    console.log('📊 Authentication State:', authState);
    
    if (authState.currentState.isAuthenticated) {
      console.log('✅ User is authenticated');
      console.log('👤 User email:', authState.currentState.userEmail);
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
  console.log('\n--- Validating Authentication ---');
  
  if (!window.BackendAPI) {
    console.error('❌ BackendAPI not available');
    return false;
  }
  
  try {
    const isValid = await window.BackendAPI.validateAuth();
    if (isValid) {
      console.log('✅ Authentication is valid');
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
  console.log('\n--- Testing Email Sending (with test data) ---');
  
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
  
  console.log('📧 Test email data:', testEmailData);
  
  try {
    const result = await window.BackendAPI.sendEmail(
      testEmailData.to,
      testEmailData.subject,
      testEmailData.body,
      testEmailData.attachments
    );
    console.log('✅ Email sending test passed');
    console.log('📊 Result:', result);
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
  console.log('\n🔍 RUNNING FULL EMAIL DIAGNOSTIC...\n');
  
  const results = {
    connectivity: await testBackendConnectivity(),
    authStatus: await checkAuthStatus(),
    authValidation: await validateAuth(),
    emailTest: null
  };
  
  // Only test email sending if auth is valid
  if (results.authValidation) {
    console.log('\n⚠️  About to test email sending. This will send a real test email!');
    console.log('⚠️  Type "y" to continue or anything else to skip:');
    
    // For now, skip actual email test in diagnostic
    console.log('⏭️  Skipping email test in diagnostic. Use testEmailSending() manually if needed.');
  }
  
  console.log('\n📋 DIAGNOSTIC SUMMARY:');
  console.log('- Backend connectivity:', results.connectivity?.success ? '✅' : '❌');
  console.log('- Authentication status:', results.authStatus?.currentState?.isAuthenticated ? '✅' : '❌');
  console.log('- Authentication validation:', results.authValidation ? '✅' : '❌');
  
  return results;
}

// 6. Get current email form data
function getCurrentEmailData() {
  console.log('\n--- Current Email Form Data ---');
  
  const recipientInput = document.getElementById('recipientEmailInput');
  const subjectInput = document.getElementById('emailSubject');
  const bodyTextarea = document.getElementById('emailResult');
  
  const data = {
    to: recipientInput?.value || '',
    subject: subjectInput?.value || '',
    body: bodyTextarea?.value || ''
  };
  
  console.log('📧 Current form data:', data);
  
  // Validate the data
  const isValid = data.to && data.subject && data.body;
  console.log('✅ Form data is valid:', isValid);
  
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

console.log('\n📚 Available diagnostic commands:');
console.log('- emailDiagnostic.runFullDiagnostic() - Run complete diagnostic');
console.log('- emailDiagnostic.testBackendConnectivity() - Test backend connection');
console.log('- emailDiagnostic.checkAuthStatus() - Check authentication');
console.log('- emailDiagnostic.validateAuth() - Validate current auth');
console.log('- emailDiagnostic.getCurrentEmailData() - Get current form data');
console.log('- emailDiagnostic.testEmailSending() - Test sending (sends real email!)');

console.log('\n🚀 Quick start: Run emailDiagnostic.runFullDiagnostic()');
