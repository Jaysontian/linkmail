// Console commands to test the infinite loop fix
// Copy and paste these into browser console after loading the extension


// 1. Check current circuit breaker status
function checkCircuitBreakerStatus() {
  const UIManager = window.UIManager;
  if (!UIManager) {
    console.error('UIManager not found');
    return;
  }
  
}

// 2. Test rapid calls (should trigger circuit breaker)
function testRapidCalls() {
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
}

// 4. Test normal Generate button flow
function testGenerateFlow() {
  const UIManager = window.UIManager;
  if (!UIManager) {
    console.error('UIManager not found');
    return;
  }
  
  // Show splash first
  UIManager.showView('#linkmail-splash');
  
  setTimeout(() => {
    // Simulate Generate button click
    UIManager.showView('#linkmail-editor');
    
    setTimeout(() => {
    }, 200);
  }, 200);
}

// Make functions available globally
window.checkCircuitBreakerStatus = checkCircuitBreakerStatus;
window.testRapidCalls = testRapidCalls;
window.resetCircuitBreaker = resetCircuitBreaker;
window.testGenerateFlow = testGenerateFlow;

