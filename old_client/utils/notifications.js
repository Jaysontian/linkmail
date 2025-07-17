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

// Show a toast notification with type (success, error, info, warning)
function showToast(message, type = 'info') {
  const container = createToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

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

// Define notification functions
window.notifications = {
  success: (message) => showToast(message, 'success'),
  error: (message) => showToast(message, 'error'),
  info: (message) => showToast(message, 'info'),
  warning: (message) => showToast(message, 'warning')
};

// Add convenience methods to window object
window.showSuccess = window.notifications.success;
window.showError = window.notifications.error;
window.showInfo = window.notifications.info;
window.showWarning = window.notifications.warning;

// Add some basic styles for the notifications if they don't exist
const styleElement = document.createElement('style');
styleElement.textContent = `
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  padding: 12px 16px;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 320px;
  max-width: 100%;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;
}

.toast.show {
  opacity: 1;
  transform: translateY(0);
}

.toast-success {
  border-left: 4px solid #4caf50;
}

.toast-error {
  border-left: 4px solid #f44336;
}

.toast-info {
  border-left: 4px solid #2196f3;
}

.toast-warning {
  border-left: 4px solid #ff9800;
}

.toast-content {
  flex: 1;
  font-size: 14px;
}

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 0 0 10px;
  color: #999;
}
`;

document.head.appendChild(styleElement);
