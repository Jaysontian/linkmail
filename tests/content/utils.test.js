// Tests for content/utils.js
require('../../content/utils.js');

describe('Utils', () => {
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = window.Utils.debounce(mockFn, 1000);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(999);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should reset delay on subsequent calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = window.Utils.debounce(mockFn, 1000);

      debouncedFn();
      jest.advanceTimersByTime(500);
      debouncedFn(); // This should reset the timer

      jest.advanceTimersByTime(999);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should pass arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = window.Utils.debounce(mockFn, 1000);

      debouncedFn('arg1', 'arg2', 'arg3');
      jest.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('extractEmail', () => {
    test('should extract valid email from text', () => {
      const text = 'Contact me at john.doe@example.com for more info.';
      const result = window.Utils.extractEmail(text);
      expect(result).toBe('john.doe@example.com');
    });

    test('should extract first email when multiple exist', () => {
      const text = 'Email john@example.com or jane@test.org';
      const result = window.Utils.extractEmail(text);
      expect(result).toBe('john@example.com');
    });

    test('should return null for text without emails', () => {
      const text = 'No email here, just regular text.';
      const result = window.Utils.extractEmail(text);
      expect(result).toBeNull();
    });

    test('should return null for empty or null input', () => {
      expect(window.Utils.extractEmail('')).toBeNull();
      expect(window.Utils.extractEmail(null)).toBeNull();
      expect(window.Utils.extractEmail(undefined)).toBeNull();
    });

    test('should handle complex email formats', () => {
      const text = 'Complex email: test.email+tag@subdomain.example-domain.com';
      const result = window.Utils.extractEmail(text);
      expect(result).toBe('test.email+tag@subdomain.example-domain.com');
    });

    test('should extract email with quotes', () => {
      const text = 'Email: "test.email"@example.com';
      const result = window.Utils.extractEmail(text);
      expect(result).toBe('"test.email"@example.com');
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = window.Utils.escapeHtml(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    test('should escape ampersands', () => {
      const input = 'Ben & Jerry\'s';
      const result = window.Utils.escapeHtml(input);
      expect(result).toBe('Ben &amp; Jerry&#039;s');
    });

    test('should return empty string for null/undefined', () => {
      expect(window.Utils.escapeHtml(null)).toBe('');
      expect(window.Utils.escapeHtml(undefined)).toBe('');
      expect(window.Utils.escapeHtml('')).toBe('');
    });

    test('should handle mixed special characters', () => {
      const input = 'Test <>&"\'/';
      const result = window.Utils.escapeHtml(input);
      expect(result).toBe('Test &lt;&gt;&amp;&quot;&#039;&#x2F;');
    });
  });

  describe('sanitizeText', () => {
    test('should escape HTML and preserve line breaks', () => {
      const input = 'Line 1\n<script>alert("XSS")</script>\nLine 3';
      const result = window.Utils.sanitizeText(input);
      expect(result).toBe('Line 1<br>&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;<br>Line 3');
    });

    test('should handle empty input', () => {
      expect(window.Utils.sanitizeText('')).toBe('');
      expect(window.Utils.sanitizeText(null)).toBe('');
    });

    test('should handle text with only line breaks', () => {
      const input = '\n\n\n';
      const result = window.Utils.sanitizeText(input);
      expect(result).toBe('<br><br><br>');
    });
  });

  describe('sanitizeUrl', () => {
    test('should allow valid HTTPS URLs', () => {
      const input = 'https://example.com/path?param=value';
      const result = window.Utils.sanitizeUrl(input);
      expect(result).toBe('https://example.com/path?param=value');
    });

    test('should allow valid HTTP URLs', () => {
      const input = 'http://example.com/path';
      const result = window.Utils.sanitizeUrl(input);
      expect(result).toBe('http://example.com/path');
    });

    test('should reject javascript: URLs', () => {
      const input = 'javascript:alert("XSS")';
      const result = window.Utils.sanitizeUrl(input);
      expect(result).toBe('');
    });

    test('should reject data: URLs', () => {
      const input = 'data:text/html,<script>alert("XSS")</script>';
      const result = window.Utils.sanitizeUrl(input);
      expect(result).toBe('');
    });

    test('should handle invalid URLs', () => {
      const input = 'not-a-url';
      const result = window.Utils.sanitizeUrl(input);
      expect(result).toBe('');
    });

    test('should handle empty/null input', () => {
      expect(window.Utils.sanitizeUrl('')).toBe('');
      expect(window.Utils.sanitizeUrl(null)).toBe('');
      expect(window.Utils.sanitizeUrl(undefined)).toBe('');
    });

    test('should normalize URLs', () => {
      const input = 'https://example.com:443/path/../normalized';
      const result = window.Utils.sanitizeUrl(input);
      expect(result).toBe('https://example.com/normalized');
    });
  });
});
