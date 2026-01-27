const { BaseComponent } = require('./base');

class ModalComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'dialog' ||
      element.getAttribute('role') === 'alertdialog' ||
      element.classList.contains('modal') ||
      element.classList.contains('dialog') ||
      element.hasAttribute('data-modal')
    );
  }

  getRole() {
    const role = this.element.getAttribute('role');
    return role === 'alertdialog' ? 'alertdialog' : 'dialog';
  }

  getCustomAttributes() {
    const attrs = {};

    const sizeClasses = ['small', 'medium', 'large', 'xl', 'fullscreen'];
    for (const size of sizeClasses) {
      if (this.element.classList.contains(size) || 
          this.element.classList.contains(`modal-${size}`)) {
        attrs['size'] = size;
        break;
      }
    }

    const title = this.element.querySelector(
      '[role="heading"], .modal-title, .dialog-title, h1, h2, h3'
    );
    if (title) {
      attrs['title'] = title.textContent.trim();
    }

    const closeButton = this.element.querySelector(
      '[aria-label*="close" i], .close, .modal-close, button[data-dismiss]'
    );
    if (closeButton) {
      attrs['closeable'] = true;
    }

    const backdrop = document.querySelector('.modal-backdrop, .overlay, .dialog-backdrop');
    if (backdrop) {
      attrs['has-backdrop'] = true;
      
      const backdropClickClose = backdrop.hasAttribute('data-dismiss') ||
                                backdrop.classList.contains('dismiss-on-click');
      if (backdropClickClose) {
        attrs['backdrop-dismissible'] = true;
      }
    }

    const footer = this.element.querySelector('.modal-footer, .dialog-footer, [role="group"]');
    if (footer) {
      const buttons = footer.querySelectorAll('button');
      if (buttons.length > 0) {
        attrs['footer-actions'] = Array.from(buttons)
          .map(btn => btn.textContent.trim())
          .filter(Boolean);
      }
    }

    const isOpen = this.element.classList.contains('show') ||
                  this.element.classList.contains('open') ||
                  this.element.getAttribute('aria-hidden') === 'false' ||
                  window.getComputedStyle(this.element).display !== 'none';
    attrs['open'] = isOpen;

    return attrs;
  }
}

module.exports = { ModalComponent };
