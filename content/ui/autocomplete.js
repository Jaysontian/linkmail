// content/ui/autocomplete.js
// Autocomplete functionality for job title and company fields

(function attachAutocomplete() {
  if (!window) return;
  window.UIManager = window.UIManager || {};

  // Autocomplete utility class
  window.UIManager.Autocomplete = class Autocomplete {
    constructor(inputElement, type, options = {}) {
      this.input = inputElement;
      this.type = type; // 'jobTitle' or 'company'
      this.options = {
        minLength: 1,
        maxSuggestions: 10,
        debounceMs: 300,
        ...options
      };
      
      this.suggestions = [];
      this.selectedIndex = -1;
      this.isOpen = false;
      this.debounceTimeout = null;
      
      this.init();
    }

    init() {
      this.createDropdown();
      this.attachEventListeners();
    }

    createDropdown() {
      // Create dropdown container
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'autocomplete-dropdown';
      this.dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #e1e5e9;
        border-top: none;
        border-radius: 0 0 4px 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
      `;

      // Make input container relative if not already
      const inputContainer = this.input.parentElement;
      if (window.getComputedStyle(inputContainer).position === 'static') {
        inputContainer.style.position = 'relative';
      }

      // Insert dropdown after input
      inputContainer.appendChild(this.dropdown);
    }

    attachEventListeners() {
      // Input event for typing
      this.input.addEventListener('input', (e) => {
        this.handleInput(e.target.value);
      });

      // Keyboard navigation
      this.input.addEventListener('keydown', (e) => {
        this.handleKeydown(e);
      });

      // Focus event
      this.input.addEventListener('focus', () => {
        if (this.suggestions.length > 0 && this.input.value.length >= this.options.minLength) {
          this.showDropdown();
        }
      });

      // Blur event (with small delay to allow for clicks)
      this.input.addEventListener('blur', () => {
        setTimeout(() => {
          this.hideDropdown();
        }, 150);
      });

      // Click outside to close
      document.addEventListener('click', (e) => {
        if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
          this.hideDropdown();
        }
      });
    }

    handleInput(value) {
      const trimmedValue = value.trim();
      
      // Clear suggestions if input is too short
      if (trimmedValue.length < this.options.minLength) {
        this.suggestions = [];
        this.hideDropdown();
        return;
      }

      // Debounce the API call
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(() => {
        this.fetchSuggestions(trimmedValue);
      }, this.options.debounceMs);
    }

    async fetchSuggestions(query) {
      if (!window.BackendAPI || !window.BackendAPI.isAuthenticated) {
        this.suggestions = [];
        this.hideDropdown();
        return;
      }

      try {
        // Show loading state
        this.showLoading();

        const response = await window.BackendAPI.getAutocompleteSuggestions(this.type, query);
        this.suggestions = response.suggestions || [];
        
        if (this.suggestions.length > 0) {
          this.renderSuggestions();
          this.showDropdown();
        } else {
          this.hideDropdown();
        }
      } catch (error) {
        console.error('Failed to fetch autocomplete suggestions:', error);
        this.suggestions = [];
        this.hideDropdown();
      }
    }

    showLoading() {
      this.dropdown.innerHTML = `
        <div class="autocomplete-loading" style="padding: 8px 12px; color: #666; font-size: 12px;">
          <svg xmlns="http://www.w3.org/2000/svg" style="animation: spin 1s linear infinite; margin-right: 6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          Searching...
        </div>
      `;
      this.showDropdown();
    }

    renderSuggestions() {
      this.dropdown.innerHTML = '';
      this.selectedIndex = -1;

      this.suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.style.cssText = `
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.15s ease;
        `;
        
        // Highlight matching text
        const query = this.input.value.trim();
        const regex = new RegExp(`(${query})`, 'gi');
        const highlightedText = suggestion.replace(regex, '<strong>$1</strong>');
        item.innerHTML = highlightedText;

        // Click handler
        item.addEventListener('click', () => {
          this.selectSuggestion(suggestion);
        });

        // Hover handler
        item.addEventListener('mouseenter', () => {
          this.setSelectedIndex(index);
        });

        this.dropdown.appendChild(item);
      });

      // Remove last border
      const items = this.dropdown.querySelectorAll('.autocomplete-item');
      if (items.length > 0) {
        items[items.length - 1].style.borderBottom = 'none';
      }
    }

    handleKeydown(e) {
      if (!this.isOpen || this.suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
          this.updateSelection();
          break;
        
        case 'ArrowUp':
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
          this.updateSelection();
          break;
        
        case 'Enter':
          e.preventDefault();
          if (this.selectedIndex >= 0) {
            this.selectSuggestion(this.suggestions[this.selectedIndex]);
          }
          break;
        
        case 'Escape':
          e.preventDefault();
          this.hideDropdown();
          break;
      }
    }

    setSelectedIndex(index) {
      this.selectedIndex = index;
      this.updateSelection();
    }

    updateSelection() {
      const items = this.dropdown.querySelectorAll('.autocomplete-item');
      items.forEach((item, index) => {
        if (index === this.selectedIndex) {
          item.style.backgroundColor = '#f8f9fa';
        } else {
          item.style.backgroundColor = 'white';
        }
      });
    }

    selectSuggestion(suggestion) {
      this.input.value = suggestion;
      this.hideDropdown();
      
      // Trigger input event to notify other components
      const event = new Event('input', { bubbles: true });
      this.input.dispatchEvent(event);
      
      // Focus back to input
      this.input.focus();
    }

    showDropdown() {
      this.dropdown.style.display = 'block';
      this.isOpen = true;
    }

    hideDropdown() {
      this.dropdown.style.display = 'none';
      this.isOpen = false;
      this.selectedIndex = -1;
    }

    destroy() {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      if (this.dropdown && this.dropdown.parentElement) {
        this.dropdown.parentElement.removeChild(this.dropdown);
      }
    }
  };

  // Helper function to initialize autocomplete on an input field
  window.UIManager.initAutocomplete = function(inputElement, type, options = {}) {
    // Don't initialize if already has autocomplete
    if (inputElement._autocomplete) {
      return inputElement._autocomplete;
    }

    const autocomplete = new window.UIManager.Autocomplete(inputElement, type, options);
    inputElement._autocomplete = autocomplete;
    return autocomplete;
  };

  // Helper function to destroy autocomplete on an input field
  window.UIManager.destroyAutocomplete = function(inputElement) {
    if (inputElement._autocomplete) {
      inputElement._autocomplete.destroy();
      delete inputElement._autocomplete;
    }
  };

})();
