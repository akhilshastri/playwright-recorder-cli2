const { BaseComponent } = require('./base');

class PaginationComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'navigation' && 
      element.getAttribute('aria-label')?.toLowerCase().includes('pagination') ||
      element.classList.contains('pagination') ||
      element.classList.contains('pager') ||
      element.hasAttribute('data-pagination')
    );
  }

  getRole() {
    return 'navigation';
  }

  getCustomAttributes() {
    const attrs = {};

    const currentPage = this.getCurrentPage();
    if (currentPage) {
      attrs['current-page'] = currentPage;
    }

    const totalPages = this.getTotalPages();
    if (totalPages) {
      attrs['total-pages'] = totalPages;
    }

    const prevButton = this.element.querySelector(
      '[aria-label*="previous" i], .prev, .previous, [data-page="prev"]'
    );
    const nextButton = this.element.querySelector(
      '[aria-label*="next" i], .next, [data-page="next"]'
    );

    if (prevButton) {
      attrs['has-prev'] = !prevButton.hasAttribute('disabled') &&
                         prevButton.getAttribute('aria-disabled') !== 'true';
    }
    if (nextButton) {
      attrs['has-next'] = !nextButton.hasAttribute('disabled') &&
                         nextButton.getAttribute('aria-disabled') !== 'true';
    }

    const firstButton = this.element.querySelector(
      '[aria-label*="first" i], .first, [data-page="first"]'
    );
    const lastButton = this.element.querySelector(
      '[aria-label*="last" i], .last, [data-page="last"]'
    );

    if (firstButton || lastButton) {
      attrs['has-first-last'] = true;
    }

    const itemsPerPageText = this.element.textContent.match(/(\d+)\s+per\s+page/i);
    if (itemsPerPageText) {
      attrs['items-per-page'] = parseInt(itemsPerPageText[1]);
    }

    const totalItemsText = this.element.textContent.match(/of\s+(\d+)\s+items/i);
    if (totalItemsText) {
      attrs['total-items'] = parseInt(totalItemsText[1]);
    }

    return attrs;
  }

  getCurrentPage() {
    const active = this.element.querySelector(
      '[aria-current="page"], .active, .current, [data-page].active'
    );
    
    if (active) {
      const pageText = active.textContent.trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum)) return pageNum;
    }

    return null;
  }

  getTotalPages() {
    const pageLinks = this.element.querySelectorAll(
      'a[data-page], button[data-page], .page-link'
    );
    
    let maxPage = 0;
    pageLinks.forEach(link => {
      const pageText = link.textContent.trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    });

    if (maxPage > 0) return maxPage;

    const totalPagesText = this.element.textContent.match(/of\s+(\d+)/i);
    if (totalPagesText) {
      return parseInt(totalPagesText[1]);
    }

    return null;
  }
}

module.exports = { PaginationComponent };
