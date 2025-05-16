// Toast container
let toastContainer = null;

// Create toast container if it doesn't exist
function createToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// Show a toast notification
function showToast(message) {
  const container = createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const content = document.createElement('div');
  content.className = 'toast-content';
  content.textContent = message;
  
  const closeButton = document.createElement('button');
  closeButton.className = 'toast-close';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => removeToast(toast);
  
  toast.appendChild(content);
  toast.appendChild(closeButton);
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove after 3 seconds
  setTimeout(() => removeToast(toast), 3000);
}

// Remove a toast
function removeToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => toast.remove(), 300);
}

// Notification types - all use the same styling now
const notifications = {
  success: (message) => showToast(message),
  error: (message) => showToast(message),
  info: (message) => showToast(message),
  warning: (message) => showToast(message)
};

// Export the notification functions
window.notifications = notifications; 