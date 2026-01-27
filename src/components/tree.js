const { BaseComponent } = require('./base');

class TreeComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'tree' ||
      element.classList.contains('tree') ||
      element.classList.contains('tree-view') ||
      element.hasAttribute('data-tree')
    );
  }

  getRole() {
    return 'tree';
  }

  getCustomAttributes() {
    const attrs = {};

    const items = this.getTreeItems();
    if (items.length > 0) {
      attrs['item-count'] = items.length;

      const expanded = items.filter(item => item.expanded).length;
      const collapsed = items.filter(item => !item.expanded && item.hasChildren).length;
      
      if (expanded > 0) attrs['expanded-count'] = expanded;
      if (collapsed > 0) attrs['collapsed-count'] = collapsed;

      const leafNodes = items.filter(item => !item.hasChildren).length;
      attrs['leaf-count'] = leafNodes;

      const maxDepth = Math.max(...items.map(item => item.level));
      attrs['max-depth'] = maxDepth;
    }

    const multiSelect = this.element.getAttribute('aria-multiselectable') === 'true' ||
                       this.element.querySelector('[role="treeitem"] input[type="checkbox"]');
    if (multiSelect) {
      attrs['multi-select'] = true;
    }

    const selected = items.filter(item => item.selected);
    if (selected.length > 0) {
      attrs['selected-count'] = selected.length;
      if (selected.length <= 5) {
        attrs['selected-items'] = selected.map(item => item.label);
      }
    }

    return attrs;
  }

  getTreeItems() {
    const items = [];
    const itemElements = this.element.querySelectorAll(
      '[role="treeitem"], .tree-item, .tree-node'
    );

    itemElements.forEach(itemEl => {
      const label = itemEl.textContent.trim();
      const expanded = itemEl.getAttribute('aria-expanded') === 'true';
      const selected = itemEl.getAttribute('aria-selected') === 'true' ||
                      itemEl.classList.contains('selected');
      const hasChildren = itemEl.getAttribute('aria-expanded') !== null ||
                         itemEl.querySelector('[role="group"]') !== null;
      
      let level = 0;
      let parent = itemEl.parentElement;
      while (parent && parent !== this.element) {
        if (parent.getAttribute('role') === 'group') {
          level++;
        }
        parent = parent.parentElement;
      }

      items.push({ label, expanded, selected, hasChildren, level });
    });

    return items;
  }
}

module.exports = { TreeComponent };
