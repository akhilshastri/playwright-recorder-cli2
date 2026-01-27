module.exports = {
  validation: {
    strict: false,
    arrayMatchMode: 'subset',
    countTolerance: 0,
    
    attributeSeverity: {
      'row-count': 'error',
      'column-count': 'error',
      'columns': 'warning',
      'sortable': 'info',
    },

    ignoreAttributes: [],

    flexibleAttributes: {
      'row-count': { tolerance: 2 },
      'columns': { mode: 'subset' },
    },
  },

  components: {
    grid: {
      requiredAttributes: ['row-count', 'column-count'],
      optionalAttributes: ['sortable', 'filterable', 'selectable'],
    },
    table: {
      requiredAttributes: ['row-count', 'headers'],
    },
    form: {
      requiredAttributes: ['field-count'],
      optionalAttributes: ['validation', 'multi-step'],
    },
  },

  recording: {
    defaultBrowser: 'chromium',
    defaultOutput: './tests/recorded.spec.js',
    saveSnapshots: false,
  },
};
