const { BaseComponent } = require('./base');

class TableComponent extends BaseComponent {
  static detect(element) {
    return (
      element.tagName === 'TABLE' ||
      element.getAttribute('role') === 'table' ||
      element.classList.contains('data-table')
    );
  }

  getRole() {
    return 'table';
  }

  getCustomAttributes() {
    const attrs = {};

    const rows = this.element.querySelectorAll('tr, [role="row"]');
    const headerRow = this.element.querySelector('thead tr, [role="rowgroup"]:first-child [role="row"]');
    
    if (rows.length > 0) {
      attrs['row-count'] = rows.length - (headerRow ? 1 : 0);
    }

    if (headerRow) {
      const headers = headerRow.querySelectorAll('th, [role="columnheader"]');
      attrs['column-count'] = headers.length;
      attrs['headers'] = Array.from(headers).map(h => h.textContent.trim());
    }

    if (this.element.classList.contains('responsive-table') || 
        this.element.hasAttribute('data-responsive')) {
      attrs['responsive'] = true;
    }

    const striped = this.element.querySelector('.striped, tbody tr:nth-child(even)[class*="alt"]');
    if (striped) {
      attrs['striped'] = true;
    }

    return attrs;
  }
}

module.exports = { TableComponent };
