const { detectComponent } = require('../components');

class AriaSnapshotGenerator {
  constructor(page) {
    this.page = page;
  }

  async generateSnapshot(selector, options = {}) {
    const includeComponentAttrs = options.includeComponentAttrs !== false;
    const includeRowData = options.includeRowData || false;
    const maxRows = options.maxRows || 3;

    const snapshot = await this.page.evaluate(
      ({ selector, includeComponentAttrs, includeRowData, maxRows }) => {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        // Component detection functions
        const detectGrid = (el) => {
          return (
            el.id === 'grid' ||
            el.classList.contains('ag-grid') ||
            el.classList.contains('data-grid') ||
            el.getAttribute('role') === 'grid' ||
            el.hasAttribute('data-grid')
          );
        };

        const detectTable = (el) => {
          return (
            el.tagName === 'TABLE' ||
            el.getAttribute('role') === 'table' ||
            el.classList.contains('data-table')
          );
        };

        const detectDropdown = (el) => {
          return (
            el.getAttribute('role') === 'combobox' ||
            el.getAttribute('role') === 'listbox' ||
            el.classList.contains('dropdown') ||
            el.classList.contains('select') ||
            el.tagName === 'SELECT'
          );
        };

        const detectModal = (el) => {
          return (
            el.getAttribute('role') === 'dialog' ||
            el.getAttribute('role') === 'alertdialog' ||
            el.classList.contains('modal') ||
            el.classList.contains('dialog')
          );
        };

        const detectForm = (el) => {
          return (
            el.tagName === 'FORM' ||
            el.getAttribute('role') === 'form' ||
            el.classList.contains('form')
          );
        };

        const detectTabs = (el) => {
          return (
            el.getAttribute('role') === 'tablist' ||
            el.classList.contains('tabs') ||
            el.classList.contains('tab-list')
          );
        };

        const detectAccordion = (el) => {
          return (
            el.classList.contains('accordion') ||
            el.hasAttribute('data-accordion') ||
            (el.querySelector('[role="button"][aria-expanded]') && 
             el.querySelector('[role="region"]'))
          );
        };

        const detectPagination = (el) => {
          return (
            (el.getAttribute('role') === 'navigation' && 
             el.getAttribute('aria-label')?.toLowerCase().includes('pagination')) ||
            el.classList.contains('pagination') ||
            el.classList.contains('pager')
          );
        };

        const detectTree = (el) => {
          return (
            el.getAttribute('role') === 'tree' ||
            el.classList.contains('tree') ||
            el.classList.contains('tree-view')
          );
        };

        const getGridAttributes = (el) => {
          const attrs = {};
          
          const rows = el.querySelectorAll('[role="row"], .grid-row, .ag-row, tr');
          if (rows.length > 0) attrs['row-count'] = rows.length;

          const headerCells = el.querySelectorAll(
            '[role="columnheader"], .grid-header-cell, .ag-header-cell, thead th'
          );
          if (headerCells.length > 0) {
            attrs['column-count'] = headerCells.length;
            attrs['columns'] = Array.from(headerCells)
              .map(cell => cell.textContent.trim())
              .filter(Boolean);
          }

          const sortable = el.querySelector('[aria-sort], .sortable, .ag-header-cell-sortable');
          if (sortable) attrs['sortable'] = true;

          const filterable = el.querySelector('.filter, .ag-filter, [data-filter]');
          if (filterable) attrs['filterable'] = true;

          const selectable = el.querySelector('[aria-selected], .selected, .ag-row-selected');
          if (selectable) {
            attrs['selectable'] = true;
            const multiSelect = el.querySelector('input[type="checkbox"]');
            attrs['selection-mode'] = multiSelect ? 'multiple' : 'single';
          }

          const pagination = el.querySelector('.pagination, .ag-paging-panel');
          if (pagination) {
            attrs['paginated'] = true;
            const pageInfo = pagination.textContent.match(/(\d+)\s*of\s*(\d+)/);
            if (pageInfo) {
              attrs['current-page'] = parseInt(pageInfo[1]);
              attrs['total-pages'] = parseInt(pageInfo[2]);
            }
          }

          return attrs;
        };

        const getTableAttributes = (el) => {
          const attrs = {};
          
          const rows = el.querySelectorAll('tr, [role="row"]');
          const headerRow = el.querySelector('thead tr, [role="rowgroup"]:first-child [role="row"]');
          
          if (rows.length > 0) {
            attrs['row-count'] = rows.length - (headerRow ? 1 : 0);
          }

          if (headerRow) {
            const headers = headerRow.querySelectorAll('th, [role="columnheader"]');
            attrs['column-count'] = headers.length;
            attrs['headers'] = Array.from(headers).map(h => h.textContent.trim());
          }

          if (el.classList.contains('responsive-table')) {
            attrs['responsive'] = true;
          }

          const striped = el.querySelector('.striped, tbody tr:nth-child(even)[class*="alt"]');
          if (striped) attrs['striped'] = true;

          return attrs;
        };

        const getDropdownAttributes = (el) => {
          const attrs = {};

          const multiSelect = el.hasAttribute('multiple') ||
                             el.getAttribute('aria-multiselectable') === 'true';
          if (multiSelect) attrs['multi-select'] = true;

          const searchable = el.querySelector('input[type="search"], input[type="text"]');
          if (searchable) attrs['searchable'] = true;

          const optionElements = el.querySelectorAll('option, [role="option"]');
          const options = Array.from(optionElements)
            .map(opt => opt.textContent.trim())
            .filter(Boolean);

          if (options.length > 0) {
            attrs['option-count'] = options.length;
            if (options.length <= 5) {
              attrs['options'] = options;
            }
          }

          if (el.tagName === 'SELECT') {
            const selected = el.querySelectorAll('option:checked');
            if (selected.length > 0) {
              const values = Array.from(selected).map(opt => opt.textContent.trim());
              attrs['selected'] = multiSelect ? values : values[0];
            }
          }

          const placeholder = el.getAttribute('placeholder');
          if (placeholder) attrs['placeholder'] = placeholder.trim();

          return attrs;
        };

        const getModalAttributes = (el) => {
          const attrs = {};

          const sizeClasses = ['small', 'medium', 'large', 'xl', 'fullscreen'];
          for (const size of sizeClasses) {
            if (el.classList.contains(size) || el.classList.contains(`modal-${size}`)) {
              attrs['size'] = size;
              break;
            }
          }

          const title = el.querySelector('[role="heading"], .modal-title, h1, h2, h3');
          if (title) attrs['title'] = title.textContent.trim();

          const closeButton = el.querySelector('.close, .modal-close, [data-dismiss]');
          if (closeButton) attrs['closeable'] = true;

          const backdrop = document.querySelector('.modal-backdrop, .overlay');
          if (backdrop) {
            attrs['has-backdrop'] = true;
          }

          const footer = el.querySelector('.modal-footer, .dialog-footer');
          if (footer) {
            const buttons = footer.querySelectorAll('button');
            if (buttons.length > 0) {
              attrs['footer-actions'] = Array.from(buttons)
                .map(btn => btn.textContent.trim())
                .filter(Boolean);
            }
          }

          const isOpen = el.classList.contains('show') ||
                        el.classList.contains('open') ||
                        el.getAttribute('aria-hidden') === 'false';
          attrs['open'] = isOpen;

          return attrs;
        };

        const getFormAttributes = (el) => {
          const attrs = {};

          const name = el.getAttribute('name') || el.getAttribute('id');
          if (name) attrs['name'] = name;

          const method = el.getAttribute('method');
          if (method) attrs['method'] = method.toUpperCase();

          const inputs = el.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea');
          attrs['field-count'] = inputs.length;

          if (inputs.length > 0) {
            const fieldTypes = {};
            inputs.forEach(input => {
              const type = input.type || input.tagName.toLowerCase();
              fieldTypes[type] = (fieldTypes[type] || 0) + 1;
            });
            attrs['field-types'] = fieldTypes;
          }

          const hasValidation = el.querySelector('[required], [pattern]');
          if (hasValidation) attrs['validation'] = true;

          const submitButton = el.querySelector('button[type="submit"], input[type="submit"]');
          if (submitButton) {
            attrs['submit-button'] = submitButton.textContent.trim() || submitButton.value || 'Submit';
          }

          const errors = el.querySelectorAll('.error, .invalid, [aria-invalid="true"]');
          if (errors.length > 0) {
            attrs['has-errors'] = true;
            attrs['error-count'] = errors.length;
          }

          return attrs;
        };

        const getTabsAttributes = (el) => {
          const attrs = {};

          const tabElements = el.querySelectorAll('[role="tab"], .tab');
          const tabs = Array.from(tabElements).map(tabEl => {
            const label = tabEl.textContent.trim();
            const active = tabEl.getAttribute('aria-selected') === 'true' ||
                          tabEl.classList.contains('active');
            return { label, active };
          });

          if (tabs.length > 0) {
            attrs['tab-count'] = tabs.length;
            attrs['tabs'] = tabs.map(t => t.label);

            const activeTab = tabs.find(t => t.active);
            if (activeTab) {
              attrs['active-tab'] = activeTab.label;
            }
          }

          return attrs;
        };

        const getAccordionAttributes = (el) => {
          const attrs = {};

          const itemElements = el.querySelectorAll('.accordion-item, [data-accordion-item]');
          const items = [];
          
          itemElements.forEach(itemEl => {
            const button = itemEl.querySelector('[role="button"], button');
            if (button) {
              const label = button.textContent.trim();
              const expanded = button.getAttribute('aria-expanded') === 'true';
              items.push({ label, expanded });
            }
          });

          if (items.length > 0) {
            attrs['item-count'] = items.length;
            attrs['items'] = items;
            const expandedCount = items.filter(item => item.expanded).length;
            attrs['expanded-count'] = expandedCount;
          }

          return attrs;
        };

        const getPaginationAttributes = (el) => {
          const attrs = {};

          const active = el.querySelector('[aria-current="page"], .active');
          if (active) {
            const pageNum = parseInt(active.textContent.trim());
            if (!isNaN(pageNum)) attrs['current-page'] = pageNum;
          }

          const pageLinks = el.querySelectorAll('a, button');
          let maxPage = 0;
          pageLinks.forEach(link => {
            const pageNum = parseInt(link.textContent.trim());
            if (!isNaN(pageNum) && pageNum > maxPage) maxPage = pageNum;
          });
          if (maxPage > 0) attrs['total-pages'] = maxPage;

          const prevButton = el.querySelector('[aria-label*="previous" i], .prev');
          const nextButton = el.querySelector('[aria-label*="next" i], .next');
          
          if (prevButton) {
            attrs['has-prev'] = !prevButton.hasAttribute('disabled');
          }
          if (nextButton) {
            attrs['has-next'] = !nextButton.hasAttribute('disabled');
          }

          return attrs;
        };

        const getTreeAttributes = (el) => {
          const attrs = {};

          const itemElements = el.querySelectorAll('[role="treeitem"]');
          const items = [];
          
          itemElements.forEach(itemEl => {
            const label = itemEl.textContent.trim();
            const expanded = itemEl.getAttribute('aria-expanded') === 'true';
            const selected = itemEl.getAttribute('aria-selected') === 'true';
            items.push({ label, expanded, selected });
          });

          if (items.length > 0) {
            attrs['item-count'] = items.length;
            const expanded = items.filter(item => item.expanded).length;
            if (expanded > 0) attrs['expanded-count'] = expanded;
          }

          return attrs;
        };

        const getRowData = (el, limit) => {
          const rows = el.querySelectorAll('[role="row"], .grid-row, tbody tr');
          const data = [];

          for (let i = 0; i < Math.min(limit, rows.length); i++) {
            const cells = rows[i].querySelectorAll('[role="gridcell"], .grid-cell, td');
            const rowData = Array.from(cells).map(cell => cell.textContent.trim());
            if (rowData.length > 0) data.push(rowData);
          }

          return data;
        };

        let componentType = null;
        let customAttrs = {};

        if (includeComponentAttrs) {
          if (detectGrid(element)) {
            componentType = 'grid';
            customAttrs = getGridAttributes(element);
          } else if (detectTable(element)) {
            componentType = 'table';
            customAttrs = getTableAttributes(element);
          } else if (detectDropdown(element)) {
            componentType = 'combobox';
            customAttrs = getDropdownAttributes(element);
          } else if (detectModal(element)) {
            componentType = 'dialog';
            customAttrs = getModalAttributes(element);
          } else if (detectForm(element)) {
            componentType = 'form';
            customAttrs = getFormAttributes(element);
          } else if (detectTabs(element)) {
            componentType = 'tablist';
            customAttrs = getTabsAttributes(element);
          } else if (detectAccordion(element)) {
            componentType = 'accordion';
            customAttrs = getAccordionAttributes(element);
          } else if (detectPagination(element)) {
            componentType = 'navigation';
            customAttrs = getPaginationAttributes(element);
          } else if (detectTree(element)) {
            componentType = 'tree';
            customAttrs = getTreeAttributes(element);
          }
        }

        let rowData = null;
        if (includeRowData && (componentType === 'grid' || componentType === 'table')) {
          rowData = getRowData(element, maxRows);
        }

        const role = componentType || 
                    element.getAttribute('role') || 
                    element.tagName.toLowerCase();
        const name = element.getAttribute('aria-label') || 
                     element.getAttribute('id') ||
                     '';

        return {
          role,
          name,
          selector,
          customAttrs,
          rowData,
        };
      },
      { selector, includeComponentAttrs, includeRowData, maxRows }
    );

    return this.formatSnapshot(snapshot, options);
  }

  formatSnapshot(snapshot, options = {}) {
    const lines = [];
    const indent = '  ';

    let line = `- ${snapshot.role}`;
    if (snapshot.name) {
      line += ` "${snapshot.name}"`;
    }

    if (snapshot.customAttrs && Object.keys(snapshot.customAttrs).length > 0) {
      const attrs = [];
      
      for (const [key, value] of Object.entries(snapshot.customAttrs)) {
        if (Array.isArray(value)) {
          attrs.push(`${key}=[${value.map(v => `"${v}"`).join(', ')}]`);
        } else if (typeof value === 'object') {
          attrs.push(`${key}=${JSON.stringify(value)}`);
        } else if (typeof value === 'string') {
          attrs.push(`${key}="${value}"`);
        } else {
          attrs.push(`${key}=${value}`);
        }
      }
      
      if (attrs.length > 0) {
        line += ` [${attrs.join(' ')}]`;
      }
    }

    lines.push(line);

    if (snapshot.rowData && snapshot.rowData.length > 0) {
      lines.push(`${indent}# Sample rows:`);
      snapshot.rowData.forEach((row, idx) => {
        const rowStr = row.map(cell => `"${cell}"`).join(', ');
        lines.push(`${indent}# Row ${idx + 1}: [${rowStr}]`);
      });
    }

    return lines.join('\n');
  }

  async generateEnhancedSnapshot(selector, options = {}) {
    try {
      const locator = this.page.locator(selector);
      let playwrightSnapshot = null;
      
      try {
        playwrightSnapshot = await locator.ariaSnapshot();
      } catch (e) {
        // Native method not available
      }

      const customSnapshot = await this.generateSnapshot(selector, {
        includeComponentAttrs: true,
        includeRowData: options.includeRowData,
        maxRows: options.maxRows,
      });

      return customSnapshot || playwrightSnapshot || '- fragment';

    } catch (error) {
      console.warn('Snapshot generation failed:', error.message);
      return this.generateSnapshot(selector, options);
    }
  }
}

module.exports = { AriaSnapshotGenerator };
