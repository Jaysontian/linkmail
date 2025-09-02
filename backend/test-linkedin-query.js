// Test script for LinkedIn contact info query
// Paste this entire script into your browser console while on a LinkedIn profile page

// First, let's check if BackendAPI exists
if (typeof window.BackendAPI === 'undefined') {
  console.error('BackendAPI is not loaded. Please ensure backend-api.js is loaded first.');
  console.log('To load it, try running this in console:');
  console.log(`
const script = document.createElement('script');
script.src = 'path/to/your/backend-api.js'; // Update this path
script.onload = () => console.log('BackendAPI loaded!');
document.head.appendChild(script);
  `);
} else {
  console.log('✅ BackendAPI is available');
  console.log('Available methods:', Object.keys(window.BackendAPI));
  
  // Test the new functions
  async function testLinkedInQuery() {
    try {
      console.log('🔍 Testing LinkedIn contact info query...');
      
      // Check authentication
      if (!window.BackendAPI.isAuthenticated) {
        console.warn('⚠️  User not authenticated. Please sign in first.');
        console.log('To authenticate, try: await window.BackendAPI.startAuthFlow()');
        return;
      }
      
      // Test with current page
      const result = await window.BackendAPI.logCurrentLinkedInContactInfo();
      console.log('📊 Query result:', result);
      
    } catch (error) {
      console.error('❌ Error testing LinkedIn query:', error);
    }
  }
  
  // Run the test
  testLinkedInQuery();
}

// Alternative: Manual test function you can call with any LinkedIn URL
window.testLinkedInContactInfo = async function(linkedinUrl) {
  if (typeof window.BackendAPI === 'undefined') {
    console.error('BackendAPI is not loaded');
    return;
  }
  
  try {
    console.log('🔍 Querying contact info for:', linkedinUrl);
    const result = await window.BackendAPI.getContactInfoByLinkedIn(linkedinUrl);
    console.log('📊 Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error:', error);
    return { error: error.message };
  }
};

console.log('📝 Test script loaded. You can also call: testLinkedInContactInfo("https://linkedin.com/in/someone")');
