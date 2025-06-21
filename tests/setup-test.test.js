// Simple test to verify the testing setup works
describe('Testing Environment Setup', () => {
  test('should have Chrome APIs mocked', () => {
    expect(typeof chrome).toBe('object');
    expect(typeof chrome.runtime).toBe('object');
    expect(typeof chrome.storage).toBe('object');
    expect(typeof chrome.identity).toBe('object');
  });

  test('should have DOM environment available', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();

    // Test DOM manipulation
    const div = document.createElement('div');
    div.textContent = 'Test';
    document.body.appendChild(div);

    expect(document.body.children.length).toBe(1);
    expect(div.textContent).toBe('Test');

    // Cleanup is handled by setup.js
  });

  test('should have fetch mocked', () => {
    expect(typeof fetch).toBe('function');
    expect(fetch.mockClear).toBeDefined();
  });

  test('should have console mocked', () => {
    console.log('test message');
    expect(console.log).toHaveBeenCalledWith('test message');
  });
});
