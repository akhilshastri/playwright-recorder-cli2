const { BaseComponent } = require('./base');

class TabsComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'tablist' ||
      element.classList.contains('tabs') ||
      element.classList.contains('tab-list') ||
      element.hasAttribute('data-tabs')
    );
  }

  getRole() {
    return 'tablist';
  }

  getCustomAttributes() {
    const attrs = {};

    const tabs = this.getTabs();
    if (tabs.length > 0) {
      attrs['tab-count'] = tabs.length;
      attrs['tabs'] = tabs.map(tab => tab.label);

      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        attrs['active-tab'] = activeTab.label;
        attrs['active-tab-index'] = tabs.indexOf(activeTab);
      }
    }

    const orientation = this.element.getAttribute('aria-orientation');
    if (orientation && orientation !== 'horizontal') {
      attrs['orientation'] = orientation;
    }

    const closeButtons = this.element.querySelectorAll(
      '.close, .tab-close, [aria-label*="close" i]'
    );
    if (closeButtons.length > 0) {
      attrs['closeable-tabs'] = true;
    }

    return attrs;
  }

  getTabs() {
    const tabElements = this.element.querySelectorAll(
      '[role="tab"], .tab, .nav-item'
    );

    return Array.from(tabElements).map(tabEl => {
      const label = tabEl.textContent.trim();
      const active = tabEl.getAttribute('aria-selected') === 'true' ||
                    tabEl.classList.contains('active') ||
                    tabEl.classList.contains('selected');
      const disabled = tabEl.getAttribute('aria-disabled') === 'true' ||
                      tabEl.hasAttribute('disabled') ||
                      tabEl.classList.contains('disabled');

      return { label, active, disabled };
    });
  }
}

module.exports = { TabsComponent };
