// content/ui/messages.js
// Attach message utilities to window.UIManager

(function attachMessages(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.showTemporaryMessage = function showTemporaryMessage(message, type = 'info') {
    let messageEl = this.container.querySelector('#linkmail-temp-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'linkmail-temp-message';
      messageEl.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
        text-align: center;
        transition: opacity 0.3s ease;
      `;
      this.container.style.position = 'relative';
      this.container.appendChild(messageEl);
    }
    messageEl.textContent = message;
    if (type === 'success') {
      messageEl.style.backgroundColor = '#d4edda';
      messageEl.style.color = '#155724';
      messageEl.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
      messageEl.style.backgroundColor = '#f8d7da';
      messageEl.style.color = '#721c24';
      messageEl.style.border = '1px solid #f5c6cb';
    } else {
      messageEl.style.backgroundColor = '#d1ecf1';
      messageEl.style.color = '#0c5460';
      messageEl.style.border = '1px solid #bee5eb';
    }
    messageEl.style.opacity = '1';
    messageEl.style.display = 'block';
    setTimeout(() => {
      if (messageEl) {
        messageEl.style.opacity = '0';
        setTimeout(() => { if (messageEl && messageEl.parentNode) messageEl.parentNode.removeChild(messageEl); }, 300);
      }
    }, 3000);
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


