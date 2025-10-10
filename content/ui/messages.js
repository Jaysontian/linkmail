// content/ui/messages.js
// Attach message utilities to window.UIManager

(function attachMessages(){
  if (!window) return;
  window.UIManager = window.UIManager || {};

  window.UIManager.showTemporaryMessage = function showTemporaryMessage(message, type = 'info') {
    // let messageEl = this.container.querySelector('#linkmail-temp-message');
    // if (!messageEl) {
    //   messageEl = document.createElement('div');
    //   messageEl.id = 'linkmail-temp-message';
    //   messageEl.className = 'linkmail-temp-message';
    //   messageEl.style.cssText = `
    //     position: absolute;
    //     top: 16px;
    //     left: 50%;
    //     transform: translateX(-50%);
    //     padding: 12px 16px;
    //     border-radius: 10px;
    //     font-size: 11pt;
    //     z-index: 1000;
    //     max-width: 320px;
    //     text-align: center;
    //     box-shadow: var(--shadow);
    //     border: 1px solid var(--border-color);
    //     background-color: white;
    //     animation: lm-fadeIn 0.3s ease;
    //     transition: all 0.2s ease;
    //     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    //   `;
    //   this.container.style.position = 'relative';
    //   this.container.appendChild(messageEl);
    // }
    
    // messageEl.textContent = message;
    
    // // Keep it clean and white - no colors
    // messageEl.style.color = 'var(--text-color)';
    // messageEl.style.borderColor = 'var(--border-color)';
    // messageEl.style.backgroundColor = 'white';
    
    // messageEl.style.opacity = '1';
    // messageEl.style.display = 'block';
    
    // setTimeout(() => {
    //   if (messageEl) {
    //     messageEl.style.opacity = '0';
    //     messageEl.style.transform = 'translateX(-50%) translateY(-8px)';
    //     setTimeout(() => { 
    //       if (messageEl && messageEl.parentNode) {
    //         messageEl.parentNode.removeChild(messageEl);
    //       }
    //     }, 200);
    //   }
    // }, 3000);
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}


