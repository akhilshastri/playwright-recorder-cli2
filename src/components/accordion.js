const { BaseComponent } = require('./base');

class AccordionComponent extends BaseComponent {
  static detect(element) {
    return (
      element.classList.contains('accordion') ||
      element.hasAttribute('data-accordion') ||
      (element.querySelector('[role="button"][aria-expanded]') && 
       element.querySelector('[role="region"]'))
    );
  }

  getRole() {
    return 'accordion';
  }

  getCustomAttributes() {
    const attrs = {};

    const items = this.getAccordionItems();
    if (items.length > 0) {
      attrs['item-count'] = items.length;
      attrs['items'] = items.map(item => ({
        label: item.label,
        expanded: item.expanded,
      }));

      const expandedCount = items.filter(item => item.expanded).length;
      attrs['expanded-count'] = expandedCount;

      const allowMultiple = expandedCount > 1 || 
                           this.element.hasAttribute('data-allow-multiple');
      if (allowMultiple) {
        attrs['allow-multiple'] = true;
      }
    }

    const allowAllCollapsed = !this.element.hasAttribute('data-require-one-open');
    if (!allowAllCollapsed) {
      attrs['require-one-open'] = true;
    }

    return attrs;
  }

  getAccordionItems() {
    const items = [];
    
    const itemElements = this.element.querySelectorAll(
      '.accordion-item, .accordion-section, [data-accordion-item]'
    );

    itemElements.forEach(itemEl => {
      const button = itemEl.querySelector(
        '[role="button"], button, .accordion-header, .accordion-button'
      );
      
      if (button) {
        const label = button.textContent.trim();
        const expanded = button.getAttribute('aria-expanded') === 'true' ||
                        itemEl.classList.contains('open') ||
                        itemEl.classList.contains('expanded');

        items.push({ label, expanded });
      }
    });

    return items;
  }
}

module.exports = { AccordionComponent };
