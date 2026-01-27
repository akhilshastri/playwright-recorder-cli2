class BaseComponent {
  constructor(element) {
    this.element = element;
  }

  static detect(element) {
    return false;
  }

  getCustomAttributes() {
    return {};
  }

  getRole() {
    return null;
  }

  getName() {
    return (
      this.element.getAttribute('aria-label') ||
      this.element.getAttribute('aria-labelledby') ||
      this.element.textContent?.slice(0, 50).trim() ||
      ''
    );
  }
}

module.exports = { BaseComponent };
