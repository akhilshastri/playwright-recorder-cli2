const { BaseComponent } = require('./base');

class GridComponent extends BaseComponent {
  static detect(element) {
    return (
      element.id === 'grid' ||
      element.classList.contains('ag-grid') ||
      element.classList.contains('data-grid') ||
      element.getAttribute('role') === 'grid' ||
      element.hasAttribute('data-grid')
    );
  }

  getRole() {
    return 'grid';
  }

  getCustomAttributes() {
    const attrs = {};
    
    const rows = this.element.querySelectorAll('[role="row"], .grid-row, .ag-row');
    if (rows.length > 0) {
      attrs['row-count'] = rows.length;
    }

    const headerCells = this.element.querySelectorAll(
      '[role="columnheader"], .grid-header-cell, .ag-header-cell'
    );
    if (headerCells.length > 0) {
      attrs['column-count'] = headerCells.length;
    }

    const headers = Array.from(headerCells).map(cell => 
      cell.textContent.trim()
    ).filter(Boolean);
    if (headers.length > 0) {
      attrs['columns'] = headers;
    }

    const sortable = this.element.querySelector('[aria-sort], .sortable, .ag-header-cell-sortable');
    if (sortable) {
      attrs['sortable'] = true;
    }

    const filterable = this.element.querySelector('.filter, .ag-filter, [data-filter]');
    if (filterable) {
      attrs['filterable'] = true;
    }

    const selectable = this.element.querySelector('[aria-selected], .selected, .ag-row-selected');
    if (selectable) {
      attrs['selectable'] = true;
      
      const multiSelect = this.element.querySelector('input[type="checkbox"]');
      attrs['selection-mode'] = multiSelect ? 'multiple' : 'single';
    }

    const pagination = this.element.querySelector('.pagination, .ag-paging-panel');
    if (pagination) {
      attrs['paginated'] = true;
      
      const pageInfo = pagination.textContent.match(/(\d+)\s*of\s*(\d+)/);
      if (pageInfo) {
        attrs['current-page'] = parseInt(pageInfo[1]);
        attrs['total-pages'] = parseInt(pageInfo[2]);
      }
    }

    const virtualScroll = this.element.querySelector('.virtual-scroll, .ag-virtual-scroll');
    if (virtualScroll) {
      attrs['virtual-scroll'] = true;
    }

    return attrs;
  }

  getRowData(limit = 3) {
    const rows = this.element.querySelectorAll('[role="row"], .grid-row, .ag-row');
    const data = [];

    for (let i = 0; i < Math.min(limit, rows.length); i++) {
      const cells = rows[i].querySelectorAll('[role="gridcell"], .grid-cell, .ag-cell');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      data.push(rowData);
    }

    return data;
  }
}

module.exports = { GridComponent };
