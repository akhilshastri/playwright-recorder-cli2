const { BaseComponent } = require('./base');

class FormComponent extends BaseComponent {
  static detect(element) {
    return (
      element.tagName === 'FORM' ||
      element.getAttribute('role') === 'form' ||
      element.classList.contains('form') ||
      element.hasAttribute('data-form')
    );
  }

  getRole() {
    return 'form';
  }

  getCustomAttributes() {
    const attrs = {};

    const name = this.element.getAttribute('name') || 
                this.element.getAttribute('id');
    if (name) {
      attrs['name'] = name;
    }

    const method = this.element.getAttribute('method');
    if (method) {
      attrs['method'] = method.toUpperCase();
    }

    const fields = this.getFormFields();
    attrs['field-count'] = fields.length;

    if (fields.length > 0) {
      const fieldTypes = {};
      fields.forEach(field => {
        const type = field.type || 'text';
        fieldTypes[type] = (fieldTypes[type] || 0) + 1;
      });
      attrs['field-types'] = fieldTypes;

      const fieldNames = fields
        .map(field => field.label || field.name || field.placeholder)
        .filter(Boolean);
      if (fieldNames.length > 0 && fieldNames.length <= 10) {
        attrs['fields'] = fieldNames;
      }
    }

    const hasValidation = this.element.querySelector('[required], [pattern]') ||
                         this.element.hasAttribute('novalidate') === false;
    if (hasValidation) {
      attrs['validation'] = true;
    }

    const submitButton = this.element.querySelector(
      'button[type="submit"], input[type="submit"]'
    );
    if (submitButton) {
      attrs['submit-button'] = submitButton.textContent.trim() || 
                              submitButton.value || 
                              'Submit';
    }

    const errors = this.element.querySelectorAll(
      '.error, .invalid, [aria-invalid="true"], .form-error'
    );
    if (errors.length > 0) {
      attrs['has-errors'] = true;
      attrs['error-count'] = errors.length;
    }

    const steps = this.element.querySelectorAll('.step, .form-step, [data-step]');
    if (steps.length > 1) {
      attrs['multi-step'] = true;
      attrs['step-count'] = steps.length;
      
      const currentStep = this.element.querySelector('.step.active, .step.current');
      if (currentStep) {
        const stepIndex = Array.from(steps).indexOf(currentStep);
        attrs['current-step'] = stepIndex + 1;
      }
    }

    return attrs;
  }

  getFormFields() {
    const fields = [];
    const inputs = this.element.querySelectorAll(
      'input, select, textarea, [role="textbox"], [role="combobox"]'
    );

    inputs.forEach(input => {
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
        return;
      }

      const field = {
        type: input.type || input.tagName.toLowerCase(),
        name: input.getAttribute('name'),
        id: input.getAttribute('id'),
      };

      const label = this.findLabel(input);
      if (label) {
        field.label = label;
      }

      const placeholder = input.getAttribute('placeholder');
      if (placeholder) {
        field.placeholder = placeholder;
      }

      fields.push(field);
    });

    return fields;
  }

  findLabel(input) {
    const inputId = input.getAttribute('id');
    if (inputId) {
      const label = this.element.querySelector(`label[for="${inputId}"]`);
      if (label) return label.textContent.trim();
    }

    const parentLabel = input.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.trim();
    }

    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent.trim();
    }

    return null;
  }
}

module.exports = { FormComponent };
