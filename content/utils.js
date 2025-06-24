//utils.js
window.Utils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  extractEmail(text) {
    if (!text) return null;
    // Simplified email regex without control characters
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : null;
  },

  // Comprehensive HTML sanitization to prevent XSS
  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\//g, '&#x2F;');
  },

  // Sanitize text content while preserving line breaks
  sanitizeText(text) {
    if (!text) return '';
    return this.escapeHtml(text).replace(/\n/g, '<br>');
  },

  // Validate and sanitize URLs
  sanitizeUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      // Only allow https and http protocols
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return '';
      }
      return parsed.toString();
    } catch (e) {
      return '';
    }
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
