// Emoji picker functionality
const emojiPickerButton = document.getElementById('emojiPickerButton');
const emojiPicker = document.getElementById('emojiPicker');
const emojiSearch = document.getElementById('emojiSearch');
const emojiPickerContent = document.getElementById('emojiPickerContent');
const templateIcon = document.getElementById('templateIcon');

// Common emojis for email templates
const commonEmojis = [
  '📧', '✉️', '📨', '📩', '📫', '📪', '📬', '📭',
  '📝', '✏️', '📋', '📄', '📑', '🔖', '📌', '📍',
  '📎', '🖇️', '📐', '✂️', '📏', '📐', '📊', '📈',
  '📉', '📋', '📑', '📚', '📖', '🔍', '🔎', '📌'
];

// Initialize emoji picker
function initEmojiPicker() {
  // Populate emoji grid
  commonEmojis.forEach(emoji => {
    const emojiElement = document.createElement('div');
    emojiElement.className = 'emoji-item';
    emojiElement.textContent = emoji;
    emojiElement.addEventListener('click', () => {
      templateIcon.textContent = emoji;
      emojiPicker.classList.remove('active');
    });
    emojiPickerContent.appendChild(emojiElement);
  });

  // Toggle emoji picker
  emojiPickerButton.addEventListener('click', () => {
    emojiPicker.classList.toggle('active');
  });

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && !emojiPickerButton.contains(e.target)) {
      emojiPicker.classList.remove('active');
    }
  });

  // Search functionality
  emojiSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const emojiItems = emojiPickerContent.getElementsByClassName('emoji-item');

    Array.from(emojiItems).forEach(item => {
      const emoji = item.textContent;
      const isVisible = emoji.includes(searchTerm);
      item.style.display = isVisible ? 'block' : 'none';
    });
  });
}

// Initialize emoji picker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initEmojiPicker();
});
