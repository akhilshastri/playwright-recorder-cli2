const { BaseComponent } = require('./base');

class DropdownComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'combobox' ||
      element.getAttribute('role') === 'listbox' ||
      element.classList.contains('dropdown') ||
      element.classList.contains('select') ||
      element.tagName === 'SELECT' ||
      element.hasAttribute('data-dropdown')
    );
  }

  getRole() {
    return 'combobox';
  }

  getCustomAttributes() {
    const attrs = {};

    const multiSelect = this.element.hasAttribute('multiple') ||
                       this.element.getAttribute('aria-multiselectable') === 'true';
    if (multiSelect) {
      attrs['multi-select'] = true;
    }

    const searchable = this.element.querySelector('input[type="search"], input[type="text"]') ||
                      this.element.hasAttribute('data-searchable');
    if (searchable) {
      attrs['searchable'] = true;
    }

    const options = this.getOptions();
    if (options.length > 0) {
      attrs['option-count'] = options.length;
      
      if (options.length <= 5) {
        attrs['options'] = options;
      } else {
        attrs['options-sample'] = options.slice(0, 5);
      }
    }

    const selected = this.getSelectedOptions();
    if (selected.length > 0) {
      attrs['selected'] = multiSelect ? selected : selected[0];
    }

    if (this.element.hasAttribute('disabled') || 
        this.element.getAttribute('aria-disabled') === 'true') {
      attrs['disabled'] = true;
    }

    const placeholder = this.element.getAttribute('placeholder') ||
                       this.element.querySelector('[class*="placeholder"]')?.textContent;
    if (placeholder) {
      attrs['placeholder'] = placeholder.trim();
    }

    return attrs;
  }

  getOptions() {
    const optionElements = this.element.querySelectorAll(
      'option, [role="option"], .dropdown-option, .select-option'
    );
    
    return Array.from(optionElements)
      .map(opt => opt.textContent.trim())
      .filter(Boolean);
  }

  getSelectedOptions() {
    if (this.element.tagName === 'SELECT') {
      const selectedOptions = this.element.querySelectorAll('option:checked');
      return Array.from(selectedOptions).map(opt => opt.textContent.trim());
    }

    const selected = this.element.querySelectorAll(
      '[aria-selected="true"], .selected, .dropdown-option.active'
    );
    return Array.from(selected).map(opt => opt.textContent.trim());
  }
}

module.exports = { DropdownComponent };
