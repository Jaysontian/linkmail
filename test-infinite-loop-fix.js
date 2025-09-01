// Console commands to test the infinite loop fix
// Copy and paste these into browser console after loading the extension

console.log('=== INFINITE LOOP FIX TEST COMMANDS ===');

// 1. Check current circuit breaker status
function checkCircuitBreakerStatus() {
  const UIManager = window.UIManager;
  if (!UIManager) {
    console.error('UIManager not found');
    return;
  }
  
  console.log('Circuit Breaker Status:');
  console.log('- Blocked:', UIManager._authUIBlocked);
  console.log('- Call history length:', UIManager._authUICallHistory?.length || 0);
  console.log('- Last few calls:', UIManager._authUICallHistory?.slice(-5).map(t => new Date(t).toLocaleTimeString()) || []);
}

// 2. Test rapid calls (should trigger circuit breaker)
function testRapidCalls() {
  console.log('Testing rapid calls...');
  const UIManager = window.UIManager;
  if (!UIManager) {
    console.error('UIManager not found');
    return;
  }
  
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      UIManager.showAuthenticatedUI();
    }, i * 10); // Calls every 10ms
  }
  
  setTimeout(() => {
    checkCircuitBreakerStatus();
  }, 1000);
}

// 3. Reset circuit breaker manually
function resetCircuitBreaker() {
  const UIManager = window.UIManager;
  if (!UIManager) {
    console.error('UIManager not found');
    return;
  }
  
  UIManager.resetAuthUICircuitBreaker();
  console.log('Circuit breaker reset');
}

// 4. Test normal Generate button flow
function testGenerateFlow() {
  console.log('Testing Generate button flow...');
  const UIManager = window.UIManager;
  if (!UIManager) {
    console.error('UIManager not found');
    return;
  }
  
  // Show splash first
  UIManager.showView('#linkmail-splash');
  
  setTimeout(() => {
    console.log('Current view:', UIManager.getCurrentView());
    // Simulate Generate button click
    UIManager.showView('#linkmail-editor');
    
    setTimeout(() => {
      console.log('After Generate, current view:', UIManager.getCurrentView());
    }, 200);
  }, 200);
}

// Make functions available globally
window.checkCircuitBreakerStatus = checkCircuitBreakerStatus;
window.testRapidCalls = testRapidCalls;
window.resetCircuitBreaker = resetCircuitBreaker;
window.testGenerateFlow = testGenerateFlow;

console.log('Available test commands:');
console.log('- checkCircuitBreakerStatus() - Check current circuit breaker status');
console.log('- testRapidCalls() - Test rapid calls (should trigger circuit breaker)');
console.log('- resetCircuitBreaker() - Manually reset circuit breaker');
console.log('- testGenerateFlow() - Test normal Generate button flow');
