# AI Agent Implementation Prompt: Enhanced ARIA Snapshot Recorder

## Project Overview

Build a custom browser recorder with enhanced ARIA (Accessible Rich Internet Applications) snapshot capabilities that goes beyond Playwright's implementation by adding component-aware snapshot generation, validation, and smart assertion generation for complex UI components.

## Context & Foundation

### What We've Learned from Playwright

We've explored Microsoft Playwright's recorder and ARIA snapshot implementation (see `PLAYWRIGHT_EXPLORATION_SUMMARY.md`). Key findings:

1. **Reusable Core Modules (~3,400 lines)**:
   - `ariaSnapshot.ts` (745 lines) - ARIA tree generation
   - `roleUtils.ts` (1799 lines) - ARIA role computation
   - `selectorGenerator.ts` (581 lines) - Selector generation
   - `domUtils.ts` (223 lines) - DOM utilities

2. **Four Snapshot Modes**:
   - `'codegen'` - Generates regex patterns for dynamic content
   - `'expect'` - For runtime assertion matching
   - `'ai'` - For AI/LLM consumption
   - `'autoexpect'` - Auto-generating assertions

3. **Architecture**:
   ```
   Page (DOM Events) → Injected Recorder → Backend State Management
   → Code Generation → UI Display
   ```

4. **License**: Apache 2.0 (permissive, can be reused)

### Repository Location
- Playwright repo cloned to: `/tmp/playwright`
- Key files to extract from: `/tmp/playwright/packages/injected/src/`

---

## Your Mission: Enhanced Component-Aware ARIA Snapshot System

Build a recorder that extends Playwright's ARIA snapshot with **component-aware intelligence** for complex UI libraries like AG-Grid, Material-UI, Ant Design, etc.

---

## Phase 1: Foundation - Extract & Set Up Playwright Core

### 1.1 Extract Reusable Modules

**Task**: Copy and adapt Playwright's core ARIA modules to our project structure.

**Files to Extract** (from `/tmp/playwright/packages/injected/src/`):
```
src/core/aria/
├── ariaSnapshot.ts           # Core ARIA tree generation (745 lines)
├── roleUtils.ts              # ARIA role computation (1799 lines)
├── selectorGenerator.ts      # CSS selector generation (581 lines)
├── domUtils.ts               # DOM utilities (223 lines)
└── yaml.ts                   # YAML escaping (88 lines)

src/core/types/
├── ariaSnapshot.ts           # From playwright-core/src/utils/isomorphic/ariaSnapshot.ts
└── stringUtils.ts            # From playwright-core/src/utils/isomorphic/stringUtils.ts
```

**Adaptation Requirements**:
1. Update import paths from `@isomorphic/` to relative paths
2. Add Apache 2.0 license headers to all copied files
3. Create adapter layer for any Playwright-specific dependencies
4. Add TypeScript types and ensure strict type checking
5. Add unit tests for core functions

**Deliverable**: Working core ARIA snapshot library that can:
- Generate ARIA tree from any DOM element
- Render tree to YAML format
- Support all 4 modes (codegen, expect, ai, autoexpect)
- Generate smart regex patterns for dynamic content

---

## Phase 2: Component-Aware Architecture

### 2.1 Component Registry System

**Task**: Build a plugin architecture for component-specific snapshot logic.

**Architecture**:
```typescript
// src/components/ComponentRegistry.ts

interface ComponentDetector {
  name: string;
  priority: number; // Higher = checked first
  detect(element: Element): boolean;
  getMetadata(element: Element): ComponentMetadata;
}

interface ComponentSnapshotHandler {
  name: string;

  // Generate enhanced snapshot with component-specific data
  generateSnapshot(
    element: Element,
    options: AriaTreeOptions
  ): EnhancedAriaSnapshot;

  // Validate snapshot matches expected structure
  validateSnapshot(
    element: Element,
    expectedSnapshot: string
  ): ValidationResult;

  // Generate smart assertions based on component state
  generateAssertions(
    element: Element,
    options: AssertionOptions
  ): Assertion[];

  // Custom rendering options
  renderOptions?: {
    includeHiddenColumns?: boolean;
    maxRows?: number;
    includeMetadata?: boolean;
  };
}

interface ComponentMetadata {
  type: string;              // 'ag-grid', 'material-table', etc.
  version?: string;
  config?: Record<string, any>;
}

class ComponentRegistry {
  private detectors: ComponentDetector[] = [];
  private handlers: Map<string, ComponentSnapshotHandler> = new Map();

  register(detector: ComponentDetector, handler: ComponentSnapshotHandler): void;
  detect(element: Element): ComponentMetadata | null;
  getHandler(componentType: string): ComponentSnapshotHandler | null;
  generateSnapshot(element: Element, options: AriaTreeOptions): EnhancedAriaSnapshot;
}
```

**Deliverable**:
- Component registry with plugin architecture
- Fallback to standard ARIA snapshot for unknown components
- Priority-based detection (specific → generic)

---

### 2.2 Enhanced Snapshot Types

**Task**: Extend Playwright's ARIA types with component-specific metadata.

```typescript
// src/types/enhancedAriaSnapshot.ts

export type EnhancedAriaSnapshot = AriaSnapshot & {
  component?: {
    type: string;
    metadata: ComponentMetadata;
    state: ComponentState;
  };
  validation?: {
    rules: ValidationRule[];
    metadata: ValidationMetadata;
  };
};

export type ComponentState = {
  // Generic states
  visible: boolean;
  disabled: boolean;
  loading?: boolean;
  error?: boolean;

  // Component-specific states (extensible)
  [key: string]: any;
};

export type ValidationRule = {
  type: 'structure' | 'content' | 'state' | 'count' | 'custom';
  path?: string;              // JSONPath or CSS selector
  condition: ValidationCondition;
  message: string;
};

export type ValidationCondition =
  | { op: 'equals', value: any }
  | { op: 'contains', value: any }
  | { op: 'matches', pattern: string }
  | { op: 'count', min?: number, max?: number }
  | { op: 'exists' }
  | { op: 'custom', fn: (element: Element) => boolean };

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: {
    checkedAt: number;
    duration: number;
    rulesEvaluated: number;
  };
};
```

**Deliverable**:
- Extended type definitions
- Backward compatible with standard ARIA snapshots
- Validation framework types

---

## Phase 3: AG-Grid Component Handler (Reference Implementation)

### 3.1 AG-Grid Detection

**Task**: Implement detector for AG-Grid instances.

```typescript
// src/components/handlers/agGrid/detector.ts

export class AGGridDetector implements ComponentDetector {
  name = 'ag-grid';
  priority = 100; // High priority for specific detection

  detect(element: Element): boolean {
    // Check for AG-Grid class names
    if (element.classList.contains('ag-root-wrapper') ||
        element.classList.contains('ag-root')) {
      return true;
    }

    // Check for AG-Grid in parent hierarchy
    if (element.closest('.ag-root-wrapper')) {
      return true;
    }

    // Check for AG-Grid API presence
    const gridApi = (element as any).gridOptions?.api;
    if (gridApi && typeof gridApi.getDisplayedRowCount === 'function') {
      return true;
    }

    return false;
  }

  getMetadata(element: Element): ComponentMetadata {
    const rootWrapper = element.closest('.ag-root-wrapper') as HTMLElement;
    const gridOptions = (rootWrapper as any)?.gridOptions;

    return {
      type: 'ag-grid',
      version: this.detectVersion(rootWrapper),
      config: {
        rowModelType: gridOptions?.rowModelType,
        enableRangeSelection: gridOptions?.enableRangeSelection,
        pagination: gridOptions?.pagination,
      }
    };
  }

  private detectVersion(element: Element): string | undefined {
    // Try to detect AG-Grid version from various sources
    const versionAttr = element.getAttribute('data-ag-grid-version');
    if (versionAttr) return versionAttr;

    // Check global AG-Grid object
    if (typeof window !== 'undefined') {
      const agGrid = (window as any)['agGrid'];
      if (agGrid?.VERSION) return agGrid.VERSION;
    }

    return undefined;
  }
}
```

---

### 3.2 AG-Grid Snapshot Handler

**Task**: Implement comprehensive AG-Grid snapshot generation with multiple scenarios.

```typescript
// src/components/handlers/agGrid/handler.ts

export class AGGridSnapshotHandler implements ComponentSnapshotHandler {
  name = 'ag-grid';

  generateSnapshot(
    element: Element,
    options: AriaTreeOptions
  ): EnhancedAriaSnapshot {
    const gridApi = this.getGridApi(element);
    const baseSnapshot = generateAriaTree(element, options);

    // Enhance with AG-Grid specific data
    return {
      ...baseSnapshot,
      component: {
        type: 'ag-grid',
        metadata: this.getMetadata(element),
        state: this.getGridState(gridApi)
      }
    };
  }

  private getGridState(gridApi: any): ComponentState & AGGridState {
    return {
      visible: true,
      disabled: false,

      // AG-Grid specific
      totalRows: gridApi.getDisplayedRowCount(),
      selectedRows: gridApi.getSelectedRows().length,
      filteredRows: this.getFilteredRowCount(gridApi),
      sortModel: gridApi.getSortModel(),
      filterModel: gridApi.getFilterModel(),
      columnState: gridApi.getColumnState(),
      paginationPageSize: gridApi.paginationGetPageSize(),
      paginationCurrentPage: gridApi.paginationGetCurrentPage(),
    };
  }

  // ... (continued below)
}

interface AGGridState {
  totalRows: number;
  selectedRows: number;
  filteredRows: number;
  sortModel: any[];
  filterModel: any;
  columnState: any[];
  paginationPageSize: number;
  paginationCurrentPage: number;
}
```

---

### 3.3 AG-Grid Scenario Handlers

**Task**: Implement specific snapshot generation for common AG-Grid scenarios.

#### Scenario 1: Grid with All Rows

```typescript
export class AGGridAllRowsScenario {
  name = 'ag-grid-all-rows';

  generateSnapshot(
    element: Element,
    options: EnhancedSnapshotOptions
  ): string {
    const gridApi = this.getGridApi(element);
    const maxRows = options.maxRows || 100;

    const rows: any[] = [];
    gridApi.forEachNodeAfterFilterAndSort((node: any, index: number) => {
      if (index >= maxRows) return;
      rows.push(this.serializeRow(node));
    });

    return this.renderGridSnapshot({
      type: 'grid-all-rows',
      columnDefs: this.getVisibleColumns(gridApi),
      rows: rows,
      metadata: {
        totalCount: gridApi.getDisplayedRowCount(),
        shownCount: rows.length,
        truncated: rows.length < gridApi.getDisplayedRowCount()
      }
    }, options);
  }

  private serializeRow(node: any): Record<string, any> {
    const data = node.data;
    const serialized: Record<string, any> = {};

    // For codegen mode, convert dynamic values to regex
    if (options.mode === 'codegen') {
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.toRegexIfNeeded(value);
      }
    } else {
      return data;
    }

    return serialized;
  }

  private toRegexIfNeeded(value: any): any {
    if (typeof value === 'number') {
      return '/\\d+/';
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return '/\\d+/';
    }
    if (typeof value === 'string' && /\d{2,}/.test(value)) {
      // Contains multi-digit numbers, convert to regex
      return value.replace(/\d{2,}/g, '\\d+');
    }
    return value;
  }

  private renderGridSnapshot(data: any, options: any): string {
    // Render as YAML with custom grid format
    return `
- grid [role=grid] [rows=${data.metadata.totalCount}]
  - row [role=row] [type=header]
${data.columnDefs.map((col: any) =>
  `    - columnheader "${col.headerName}"`
).join('\n')}
${data.rows.map((row: any, idx: number) => `
  - row [role=row] [index=${idx}]
${data.columnDefs.map((col: any) =>
  `    - gridcell "${row[col.field] || ''}"`
).join('\n')}`
).join('')}
${data.metadata.truncated ? `  # ... ${data.metadata.totalCount - data.metadata.shownCount} more rows` : ''}
`.trim();
  }
}
```

#### Scenario 2: Single Selected Row

```typescript
export class AGGridSelectedRowScenario {
  name = 'ag-grid-selected-row';

  generateSnapshot(
    element: Element,
    options: EnhancedSnapshotOptions
  ): string {
    const gridApi = this.getGridApi(element);
    const selectedNodes = gridApi.getSelectedNodes();

    if (selectedNodes.length === 0) {
      throw new Error('No row selected in grid');
    }

    if (selectedNodes.length > 1) {
      console.warn(`Multiple rows selected (${selectedNodes.length}), using first one`);
    }

    const selectedNode = selectedNodes[0];
    const rowIndex = selectedNode.rowIndex;
    const rowData = selectedNode.data;

    return this.renderSelectedRowSnapshot({
      rowIndex,
      data: this.serializeRowData(rowData, options),
      isSelected: true,
      columns: this.getVisibleColumns(gridApi)
    }, options);
  }

  private renderSelectedRowSnapshot(data: any, options: any): string {
    return `
- grid [role=grid]
  - row [role=row] [index=${data.rowIndex}] [selected=true]
${data.columns.map((col: any) =>
  `    - gridcell "${data.data[col.field] || ''}" [column=${col.field}]`
).join('\n')}
`.trim();
  }

  generateAssertion(
    element: Element,
    options: AssertionOptions
  ): Assertion[] {
    const gridApi = this.getGridApi(element);
    const selectedNode = gridApi.getSelectedNodes()[0];

    return [
      {
        type: 'snapshot',
        selector: this.generateSelector(element),
        snapshot: this.generateSnapshot(element, { mode: 'expect' }),
        message: `Grid should have row ${selectedNode.rowIndex} selected`
      },
      {
        type: 'state',
        selector: this.generateRowSelector(element, selectedNode.rowIndex),
        property: 'aria-selected',
        value: 'true',
        message: `Row ${selectedNode.rowIndex} should be selected`
      },
      {
        type: 'count',
        selector: `${this.generateSelector(element)} [aria-selected="true"]`,
        count: 1,
        message: 'Exactly one row should be selected'
      }
    ];
  }
}
```

#### Scenario 3: Filtered Grid

```typescript
export class AGGridFilteredScenario {
  name = 'ag-grid-filtered';

  generateSnapshot(
    element: Element,
    options: EnhancedSnapshotOptions
  ): string {
    const gridApi = this.getGridApi(element);
    const filterModel = gridApi.getFilterModel();
    const displayedRowCount = gridApi.getDisplayedRowCount();
    const totalRowCount = this.getTotalRowCount(gridApi);

    return `
- grid [role=grid] [filtered=true]
  - metadata
    - filters: ${JSON.stringify(filterModel)}
    - displayedRows: ${displayedRowCount}
    - totalRows: ${totalRowCount}
    - filterActive: ${Object.keys(filterModel).length > 0}
  ${this.generateRowsSnapshot(gridApi, options)}
`.trim();
  }

  generateAssertions(
    element: Element,
    options: AssertionOptions
  ): Assertion[] {
    const gridApi = this.getGridApi(element);
    const filterModel = gridApi.getFilterModel();
    const displayedRowCount = gridApi.getDisplayedRowCount();

    return [
      {
        type: 'custom',
        selector: this.generateSelector(element),
        validate: (el: Element) => {
          const api = this.getGridApi(el);
          return api.getDisplayedRowCount() === displayedRowCount;
        },
        message: `Grid should show ${displayedRowCount} rows after filtering`
      },
      {
        type: 'custom',
        selector: this.generateSelector(element),
        validate: (el: Element) => {
          const api = this.getGridApi(el);
          const currentFilter = api.getFilterModel();
          return JSON.stringify(currentFilter) === JSON.stringify(filterModel);
        },
        message: `Grid filter should match: ${JSON.stringify(filterModel)}`
      }
    ];
  }
}
```

#### Scenario 4: Sorted Grid

```typescript
export class AGGridSortedScenario {
  name = 'ag-grid-sorted';

  generateSnapshot(
    element: Element,
    options: EnhancedSnapshotOptions
  ): string {
    const gridApi = this.getGridApi(element);
    const sortModel = gridApi.getSortModel();

    const rows: any[] = [];
    gridApi.forEachNodeAfterFilterAndSort((node: any, index: number) => {
      if (index < (options.maxRows || 10)) {
        rows.push(node.data);
      }
    });

    return `
- grid [role=grid] [sorted=true]
  - metadata
    - sort: ${JSON.stringify(sortModel)}
  - rows [order=ascending/descending]
${rows.map((row, idx) => this.renderRow(row, idx, options)).join('\n')}
`.trim();
  }

  generateAssertions(
    element: Element,
    options: AssertionOptions
  ): Assertion[] {
    const gridApi = this.getGridApi(element);
    const sortModel = gridApi.getSortModel();

    if (sortModel.length === 0) {
      return [];
    }

    const firstSort = sortModel[0];

    return [
      {
        type: 'custom',
        selector: this.generateSelector(element),
        validate: (el: Element) => {
          const api = this.getGridApi(el);
          const currentSort = api.getSortModel();
          return JSON.stringify(currentSort) === JSON.stringify(sortModel);
        },
        message: `Grid should be sorted by ${firstSort.colId} ${firstSort.sort}`
      },
      {
        type: 'order',
        selector: this.generateSelector(element),
        column: firstSort.colId,
        order: firstSort.sort,
        message: `Grid rows should be in ${firstSort.sort} order by ${firstSort.colId}`
      }
    ];
  }
}
```

#### Scenario 5: Paginated Grid

```typescript
export class AGGridPaginatedScenario {
  name = 'ag-grid-paginated';

  generateSnapshot(
    element: Element,
    options: EnhancedSnapshotOptions
  ): string {
    const gridApi = this.getGridApi(element);
    const currentPage = gridApi.paginationGetCurrentPage();
    const pageSize = gridApi.paginationGetPageSize();
    const totalPages = gridApi.paginationGetTotalPages();
    const totalRows = gridApi.paginationGetRowCount();

    return `
- grid [role=grid] [paginated=true]
  - metadata
    - currentPage: ${currentPage}
    - pageSize: ${pageSize}
    - totalPages: ${totalPages}
    - totalRows: ${totalRows}
  - pagination
    - button "First" [disabled=${currentPage === 0}]
    - button "Previous" [disabled=${currentPage === 0}]
    - textbox "Page ${currentPage + 1} of ${totalPages}"
    - button "Next" [disabled=${currentPage === totalPages - 1}]
    - button "Last" [disabled=${currentPage === totalPages - 1}]
  - rows [page=${currentPage}]
${this.generateCurrentPageRows(gridApi, options)}
`.trim();
  }

  generateAssertions(element: Element, options: AssertionOptions): Assertion[] {
    const gridApi = this.getGridApi(element);
    const currentPage = gridApi.paginationGetCurrentPage();
    const pageSize = gridApi.paginationGetPageSize();

    return [
      {
        type: 'custom',
        selector: this.generateSelector(element),
        validate: (el: Element) => {
          const api = this.getGridApi(el);
          return api.paginationGetCurrentPage() === currentPage;
        },
        message: `Grid should be on page ${currentPage + 1}`
      },
      {
        type: 'count',
        selector: `${this.generateSelector(element)} [role=row]:not([role=row][type=header])`,
        count: pageSize,
        message: `Page should show ${pageSize} rows`
      }
    ];
  }
}
```

---

### 3.4 AG-Grid Validation Rules

**Task**: Implement validation rules specific to AG-Grid.

```typescript
// src/components/handlers/agGrid/validation.ts

export class AGGridValidator {

  validateStructure(element: Element, expected: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const gridApi = this.getGridApi(element);

    // Validate column structure
    const expectedColumns = expected.columns;
    const actualColumns = gridApi.getColumnState();

    if (expectedColumns) {
      for (const expCol of expectedColumns) {
        const actualCol = actualColumns.find((c: any) => c.colId === expCol.colId);
        if (!actualCol) {
          errors.push({
            type: 'missing-column',
            path: `columns.${expCol.colId}`,
            message: `Expected column '${expCol.colId}' not found`,
            expected: expCol,
            actual: null
          });
        } else if (expCol.visible !== undefined && actualCol.hide === expCol.visible) {
          warnings.push({
            type: 'column-visibility',
            path: `columns.${expCol.colId}.visible`,
            message: `Column '${expCol.colId}' visibility mismatch`,
            expected: expCol.visible,
            actual: !actualCol.hide
          });
        }
      }
    }

    // Validate row count
    if (expected.rowCount !== undefined) {
      const actualRowCount = gridApi.getDisplayedRowCount();
      if (actualRowCount !== expected.rowCount) {
        errors.push({
          type: 'row-count-mismatch',
          path: 'rowCount',
          message: `Expected ${expected.rowCount} rows, found ${actualRowCount}`,
          expected: expected.rowCount,
          actual: actualRowCount
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        checkedAt: Date.now(),
        duration: 0,
        rulesEvaluated: expectedColumns?.length || 0 + (expected.rowCount ? 1 : 0)
      }
    };
  }

  validateRowData(
    element: Element,
    rowIndex: number,
    expectedData: Record<string, any>,
    options: { allowRegex?: boolean } = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const gridApi = this.getGridApi(element);

    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    if (!node) {
      return {
        valid: false,
        errors: [{
          type: 'row-not-found',
          path: `rows[${rowIndex}]`,
          message: `Row at index ${rowIndex} not found`,
          expected: expectedData,
          actual: null
        }],
        warnings: [],
        metadata: { checkedAt: Date.now(), duration: 0, rulesEvaluated: 0 }
      };
    }

    const actualData = node.data;

    for (const [key, expectedValue] of Object.entries(expectedData)) {
      const actualValue = actualData[key];

      // Check if expected value is a regex pattern
      if (options.allowRegex && typeof expectedValue === 'string' &&
          expectedValue.startsWith('/') && expectedValue.endsWith('/')) {
        const pattern = new RegExp(expectedValue.slice(1, -1));
        if (!pattern.test(String(actualValue))) {
          errors.push({
            type: 'value-mismatch',
            path: `rows[${rowIndex}].${key}`,
            message: `Value doesn't match pattern: ${expectedValue}`,
            expected: expectedValue,
            actual: actualValue
          });
        }
      } else if (actualValue !== expectedValue) {
        errors.push({
          type: 'value-mismatch',
          path: `rows[${rowIndex}].${key}`,
          message: `Expected '${expectedValue}', got '${actualValue}'`,
          expected: expectedValue,
          actual: actualValue
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      metadata: {
        checkedAt: Date.now(),
        duration: 0,
        rulesEvaluated: Object.keys(expectedData).length
      }
    };
  }

  validateSelectionState(
    element: Element,
    expected: { selectedRowIndices: number[] }
  ): ValidationResult {
    const gridApi = this.getGridApi(element);
    const selectedNodes = gridApi.getSelectedNodes();
    const actualIndices = selectedNodes.map((n: any) => n.rowIndex).sort();
    const expectedIndices = expected.selectedRowIndices.sort();

    const errors: ValidationError[] = [];

    if (JSON.stringify(actualIndices) !== JSON.stringify(expectedIndices)) {
      errors.push({
        type: 'selection-mismatch',
        path: 'selection',
        message: 'Selection state mismatch',
        expected: expectedIndices,
        actual: actualIndices
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      metadata: { checkedAt: Date.now(), duration: 0, rulesEvaluated: 1 }
    };
  }
}
```

---

## Phase 4: Wider Component Scenarios

### 4.1 Additional Component Handlers to Implement

Build similar handlers for these common components:

#### 1. Material-UI Table / Data Grid
```typescript
// src/components/handlers/materialTable/

Scenarios:
- All rows snapshot
- Selected rows (multi-select)
- Sorted table
- Filtered table with search
- Expandable rows
- Column visibility toggle
- Dense/comfortable spacing

Validations:
- Row count validation
- Column order validation
- Selection state validation
- Expansion state validation
```

#### 2. Ant Design Table
```typescript
// src/components/handlers/antTable/

Scenarios:
- Tree data table
- Editable cells
- Fixed columns (left/right)
- Summary row
- Nested tables

Validations:
- Tree structure validation
- Edit state validation
- Summary calculation validation
```

#### 3. Form Components
```typescript
// src/components/handlers/forms/

Scenarios:
- Form with all fields filled
- Form with validation errors
- Multi-step form (wizard)
- Dynamic form fields

Validations:
- Field value validation
- Error message validation
- Required field validation
- Form submission state
```

#### 4. Modal/Dialog Components
```typescript
// src/components/handlers/dialogs/

Scenarios:
- Open modal with content
- Modal with form
- Confirmation dialog
- Multi-modal stacks

Validations:
- Modal visibility validation
- Focus trap validation
- Backdrop validation
- z-index validation
```

#### 5. Tree View Components
```typescript
// src/components/handlers/treeView/

Scenarios:
- Expanded nodes
- Selected nodes
- Lazy-loaded children
- Checkable tree

Validations:
- Expansion state validation
- Selection validation
- Node count validation
- Hierarchy validation
```

#### 6. Tabs Component
```typescript
// src/components/handlers/tabs/

Scenarios:
- Active tab snapshot
- All tabs with content
- Disabled tabs
- Dynamic tabs

Validations:
- Active tab validation
- Tab count validation
- Tab content validation
```

#### 7. Dropdown/Select Components
```typescript
// src/components/handlers/select/

Scenarios:
- Dropdown with options visible
- Multi-select with selections
- Searchable dropdown
- Grouped options

Validations:
- Option count validation
- Selection validation
- Search filter validation
```

---

### 4.2 Generic Component Patterns

For components not specifically handled, implement these generic patterns:

```typescript
// src/components/handlers/generic/

export class GenericListHandler {
  // For any list-like component
  detectPattern: 'role=list|listbox|menu';

  generateSnapshot(): string {
    // Count items
    // Capture selected items
    // Handle virtual scrolling
  }
}

export class GenericInputHandler {
  // For any input-like component
  detectPattern: 'role=textbox|searchbox|spinbutton';

  generateSnapshot(): string {
    // Capture value
    // Capture validation state
    // Capture placeholder/label
  }
}

export class GenericContainerHandler {
  // For container components
  detectPattern: 'role=region|group|section';

  generateSnapshot(): string {
    // Capture visible children
    // Capture expanded/collapsed state
  }
}
```

---

## Phase 5: Advanced Features

### 5.1 Smart Assertion Generation

**Task**: Implement AI-assisted assertion generation.

```typescript
// src/features/smartAssertions.ts

export class SmartAssertionGenerator {

  async generateAssertions(
    element: Element,
    context: RecordingContext
  ): Promise<Assertion[]> {
    const componentMeta = this.registry.detect(element);
    const handler = this.registry.getHandler(componentMeta?.type);

    if (handler) {
      // Use component-specific assertion generation
      return handler.generateAssertions(element, {
        includeVisibility: true,
        includeState: true,
        includeContent: true
      });
    }

    // Fallback to generic assertions
    return this.generateGenericAssertions(element);
  }

  private generateGenericAssertions(element: Element): Assertion[] {
    return [
      // Visibility assertion
      {
        type: 'visible',
        selector: generateSelector(element),
        message: 'Element should be visible'
      },

      // Content assertion (if text content)
      ...(element.textContent?.trim() ? [{
        type: 'text',
        selector: generateSelector(element),
        text: element.textContent.trim(),
        message: `Element should contain text: ${element.textContent.trim()}`
      }] : []),

      // ARIA snapshot assertion
      {
        type: 'snapshot',
        selector: generateSelector(element),
        snapshot: generateAriaTree(element, { mode: 'codegen' }),
        message: 'Element ARIA tree should match'
      }
    ];
  }
}
```

---

### 5.2 Snapshot Diffing

**Task**: Implement visual diff for snapshot changes.

```typescript
// src/features/snapshotDiff.ts

export class SnapshotDiffer {

  diff(
    previousSnapshot: EnhancedAriaSnapshot,
    currentSnapshot: EnhancedAriaSnapshot
  ): SnapshotDiff {
    const changes: Change[] = [];

    // Diff ARIA tree
    const ariaDiff = this.diffAriaTree(
      previousSnapshot.root,
      currentSnapshot.root
    );

    // Diff component state
    if (previousSnapshot.component && currentSnapshot.component) {
      const stateDiff = this.diffComponentState(
        previousSnapshot.component.state,
        currentSnapshot.component.state
      );
      changes.push(...stateDiff);
    }

    return {
      changes,
      summary: {
        added: changes.filter(c => c.type === 'added').length,
        removed: changes.filter(c => c.type === 'removed').length,
        modified: changes.filter(c => c.type === 'modified').length
      }
    };
  }

  renderDiff(diff: SnapshotDiff): string {
    // Render as colored diff (git-style)
    return diff.changes.map(change => {
      switch (change.type) {
        case 'added':
          return `+ ${change.path}: ${change.value}`;
        case 'removed':
          return `- ${change.path}: ${change.value}`;
        case 'modified':
          return `~ ${change.path}: ${change.oldValue} → ${change.newValue}`;
      }
    }).join('\n');
  }
}
```

---

### 5.3 Snapshot Auto-Update

**Task**: Implement smart snapshot updating during test maintenance.

```typescript
// src/features/autoUpdate.ts

export class SnapshotAutoUpdater {

  async analyzeFailure(
    element: Element,
    expectedSnapshot: string,
    actualSnapshot: string
  ): Promise<UpdateSuggestion[]> {
    const diff = this.differ.diff(
      parseAriaSnapshot(expectedSnapshot),
      parseAriaSnapshot(actualSnapshot)
    );

    const suggestions: UpdateSuggestion[] = [];

    for (const change of diff.changes) {
      // Analyze if change is likely intentional or a bug
      const confidence = this.analyzeChangeConfidence(change);

      if (confidence > 0.8) {
        suggestions.push({
          type: 'auto-update',
          change,
          confidence,
          reason: 'Likely intentional UI change'
        });
      } else if (confidence > 0.5) {
        suggestions.push({
          type: 'review-required',
          change,
          confidence,
          reason: 'Unclear if intentional or bug'
        });
      } else {
        suggestions.push({
          type: 'likely-bug',
          change,
          confidence,
          reason: 'Unexpected change, likely a regression'
        });
      }
    }

    return suggestions;
  }

  private analyzeChangeConfidence(change: Change): number {
    // Heuristics for determining if change is intentional

    // Dynamic content changes (numbers, dates) = high confidence
    if (change.path.includes('text') && /\d+/.test(change.value)) {
      return 0.9;
    }

    // Structural changes (added/removed elements) = low confidence
    if (change.type === 'added' || change.type === 'removed') {
      return 0.3;
    }

    // Styling changes = medium confidence
    if (change.path.includes('class') || change.path.includes('style')) {
      return 0.6;
    }

    return 0.5;
  }
}
```

---

### 5.4 Multi-Component Workflows

**Task**: Handle complex workflows involving multiple components.

```typescript
// src/features/workflows.ts

export class WorkflowRecorder {

  async recordWorkflow(
    name: string,
    steps: WorkflowStep[]
  ): Promise<Workflow> {
    const recordedSteps: RecordedStep[] = [];

    for (const step of steps) {
      const recordedStep = await this.recordStep(step);
      recordedSteps.push(recordedStep);
    }

    return {
      name,
      steps: recordedSteps,
      assertions: this.generateWorkflowAssertions(recordedSteps)
    };
  }

  private generateWorkflowAssertions(
    steps: RecordedStep[]
  ): WorkflowAssertion[] {
    const assertions: WorkflowAssertion[] = [];

    // Add assertions for state transitions
    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i - 1];
      const currStep = steps[i];

      // Check if component state changed as expected
      if (prevStep.component && currStep.component) {
        const stateChange = this.detectStateChange(
          prevStep.component.state,
          currStep.component.state
        );

        if (stateChange) {
          assertions.push({
            type: 'state-transition',
            step: i,
            from: prevStep.component.state,
            to: currStep.component.state,
            message: `Step ${i}: ${stateChange.description}`
          });
        }
      }
    }

    return assertions;
  }
}

// Example workflow: "Add item to grid"
const workflow = {
  name: 'Add new row to AG-Grid',
  steps: [
    {
      action: 'click',
      selector: 'button.add-row',
      description: 'Click add row button'
    },
    {
      action: 'wait',
      condition: 'dialog-visible',
      description: 'Wait for add dialog'
    },
    {
      action: 'fill',
      selector: 'input[name="name"]',
      value: 'John Doe',
      description: 'Enter name'
    },
    {
      action: 'click',
      selector: 'button.save',
      description: 'Save new row'
    },
    {
      action: 'assert',
      component: 'ag-grid',
      scenario: 'row-added',
      validation: {
        rowCount: '+1',
        lastRow: { name: 'John Doe' }
      },
      description: 'Verify row added to grid'
    }
  ]
};
```

---

## Phase 6: Code Generation

### 6.1 Multi-Framework Support

**Task**: Generate test code for multiple frameworks.

```typescript
// src/codegen/generators/

export interface CodeGenerator {
  language: string;
  framework: string;
  generate(actions: Action[], options: CodegenOptions): string;
}

// Playwright Test
export class PlaywrightTestGenerator implements CodeGenerator {
  language = 'typescript';
  framework = 'playwright-test';

  generate(actions: Action[]): string {
    return `
import { test, expect } from '@playwright/test';
import { matchAriaSnapshot } from './aria-snapshot-matcher';

test('recorded test', async ({ page }) => {
  ${actions.map(a => this.generateAction(a)).join('\n  ')}
});
`;
  }

  private generateAction(action: Action): string {
    switch (action.name) {
      case 'assertSnapshot':
        return `await expect(page.locator('${action.selector}'))
    .toMatchAriaSnapshot(\`${action.ariaSnapshot}\`);`;

      case 'assertComponentState':
        return `await expect(page.locator('${action.selector}'))
    .toMatchComponentState(${JSON.stringify(action.expectedState)});`;

      // ... other actions
    }
  }
}

// Cypress
export class CypressGenerator implements CodeGenerator {
  language = 'typescript';
  framework = 'cypress';

  generate(actions: Action[]): string {
    return `
describe('recorded test', () => {
  it('should work', () => {
    ${actions.map(a => this.generateAction(a)).join('\n    ')}
  });
});
`;
  }
}

// WebDriverIO
export class WebdriverIOGenerator implements CodeGenerator {
  language = 'typescript';
  framework = 'webdriverio';

  // ... implementation
}

// Selenium
export class SeleniumGenerator implements CodeGenerator {
  language = 'java';
  framework = 'selenium';

  // ... implementation
}
```

---

### 6.2 Custom Matchers Generation

**Task**: Generate custom matcher functions for component assertions.

```typescript
// src/codegen/matchers/

export class MatcherGenerator {

  generateAGGridMatcher(): string {
    return `
export async function expectGridRowCount(
  locator: Locator,
  expectedCount: number
) {
  const count = await locator.evaluate((el: any) => {
    return el.gridOptions.api.getDisplayedRowCount();
  });

  expect(count).toBe(expectedCount);
}

export async function expectGridRowSelected(
  locator: Locator,
  rowIndex: number
) {
  const isSelected = await locator.evaluate((el: any, idx: number) => {
    const node = el.gridOptions.api.getDisplayedRowAtIndex(idx);
    return node?.isSelected() || false;
  }, rowIndex);

  expect(isSelected).toBe(true);
}

export async function expectGridSorted(
  locator: Locator,
  column: string,
  order: 'asc' | 'desc'
) {
  const sortModel = await locator.evaluate((el: any) => {
    return el.gridOptions.api.getSortModel();
  });

  expect(sortModel).toEqual([{
    colId: column,
    sort: order
  }]);
}
`;
  }
}
```

---

## Phase 7: Testing & Documentation

### 7.1 Unit Tests

**Requirements**:
- [ ] Test ARIA snapshot generation for all modes
- [ ] Test component detection for all handlers
- [ ] Test validation rules
- [ ] Test snapshot diffing
- [ ] Test code generation for all frameworks
- [ ] Test regex pattern generation

### 7.2 Integration Tests

**Requirements**:
- [ ] Test recording flow end-to-end
- [ ] Test AG-Grid scenarios with real grid instances
- [ ] Test multi-component workflows
- [ ] Test snapshot validation in test execution
- [ ] Test auto-update suggestions

### 7.3 Documentation

**Requirements**:
- [ ] API documentation for all public interfaces
- [ ] Component handler development guide
- [ ] Usage examples for each component scenario
- [ ] Migration guide from standard ARIA snapshots
- [ ] Contributing guide for adding new component handlers

---

## Technical Requirements

### Stack
- **Language**: TypeScript (strict mode)
- **Build**: ESBuild or Vite
- **Testing**: Vitest or Jest
- **Code Style**: ESLint + Prettier
- **Type Checking**: TypeScript 5.0+

### Dependencies
- Reuse Playwright ARIA core (Apache 2.0)
- yaml (for YAML parsing)
- zod (for schema validation)
- No heavy frameworks (keep lightweight)

### Browser Compatibility
- Chrome/Edge (Chromium) 90+
- Firefox 90+
- Safari 14+

### Performance Goals
- Snapshot generation: < 100ms for typical components
- Validation: < 50ms per rule
- Component detection: < 10ms
- Memory: < 50MB for recorder

---

## Deliverables

### Phase 1-2 (Foundation)
- [ ] Extracted Playwright ARIA core modules
- [ ] Component registry architecture
- [ ] Enhanced snapshot types
- [ ] Basic recorder UI

### Phase 3 (AG-Grid)
- [ ] AG-Grid detector
- [ ] All 5+ scenario handlers
- [ ] Validation rules
- [ ] Generated test code examples

### Phase 4 (More Components)
- [ ] Material-UI Table handler
- [ ] Ant Design Table handler
- [ ] Form components handler
- [ ] Modal/Dialog handler
- [ ] Generic fallback handlers

### Phase 5 (Advanced)
- [ ] Smart assertion generation
- [ ] Snapshot diffing
- [ ] Auto-update suggestions
- [ ] Multi-component workflows

### Phase 6 (Code Gen)
- [ ] Playwright Test generator
- [ ] Cypress generator
- [ ] Custom matchers for all components
- [ ] Framework-agnostic output option

### Phase 7 (Polish)
- [ ] Comprehensive test suite (>80% coverage)
- [ ] Full API documentation
- [ ] Usage examples
- [ ] Performance benchmarks
- [ ] Migration guide

---

## Success Criteria

1. **Reusability**: Successfully extracted and adapted Playwright ARIA core
2. **Extensibility**: Easy to add new component handlers (< 2 hours per component)
3. **Accuracy**: Snapshot validation catches real bugs (< 1% false positives)
4. **Performance**: Fast enough for interactive recording (< 100ms snapshots)
5. **Developer Experience**: Clear APIs, good error messages, helpful documentation
6. **Maintenance**: Auto-update suggestions reduce snapshot maintenance burden by 50%
7. **Coverage**: Handles 80%+ of common component scenarios out of the box

---

## Example Usage (End Goal)

```typescript
import { record, expect } from './enhanced-recorder';

// Recording
await record.start();
await record.click('#add-button');
await record.assertComponentSnapshot('#my-grid', {
  scenario: 'ag-grid-all-rows',
  maxRows: 10
});
const code = await record.stop();

// Generated test
test('add row to grid', async ({ page }) => {
  await page.click('#add-button');

  // Component-aware assertion
  await expect(page.locator('#my-grid'))
    .toMatchAGGridSnapshot({
      rowCount: 10,
      columns: ['name', 'email', 'status'],
      rows: [
        { name: /\w+/, email: /.*@.*/, status: 'active' },
        // ... more rows
      ]
    });
});

// Validation in test execution
const result = await validator.validate('#my-grid', expectedSnapshot);
if (!result.valid) {
  // Smart error messages
  console.log(result.errors); // Specific to AG-Grid structure

  // Auto-update suggestions
  const suggestions = await autoUpdater.analyzeFailure(
    page.locator('#my-grid'),
    expectedSnapshot,
    actualSnapshot
  );

  console.log(suggestions); // "Row count changed: 10 → 11 (likely intentional)"
}
```

---

## Questions for Clarification

Before starting implementation, please clarify:

1. **Target Framework**: Should we prioritize Playwright, or support multiple frameworks from the start?
2. **UI**: Build custom recorder UI or reuse/adapt Playwright's React UI?
3. **Distribution**: NPM package, browser extension, or standalone tool?
4. **License**: What license for our custom code? (Note: Playwright ARIA code must stay Apache 2.0)
5. **Component Priority**: Start with AG-Grid only, or implement multiple components in parallel?
6. **Code Generation**: Generate only Playwright Test code initially, or multiple frameworks?
7. **Backend**: Node.js backend for recorder, or browser-only implementation?
8. **Storage**: How should snapshots be stored? (inline in tests, separate files, database?)

---

## Repository Structure

```
playwright-recorder-cli2/
├── src/
│   ├── core/
│   │   ├── aria/               # Extracted Playwright ARIA modules
│   │   │   ├── ariaSnapshot.ts
│   │   │   ├── roleUtils.ts
│   │   │   ├── selectorGenerator.ts
│   │   │   ├── domUtils.ts
│   │   │   └── yaml.ts
│   │   └── types/              # Type definitions
│   │       ├── ariaSnapshot.ts
│   │       ├── enhanced.ts
│   │       └── validation.ts
│   ├── components/
│   │   ├── ComponentRegistry.ts
│   │   └── handlers/
│   │       ├── agGrid/
│   │       │   ├── detector.ts
│   │       │   ├── handler.ts
│   │       │   ├── scenarios/
│   │       │   │   ├── allRows.ts
│   │       │   │   ├── selectedRow.ts
│   │       │   │   ├── filtered.ts
│   │       │   │   ├── sorted.ts
│   │       │   │   └── paginated.ts
│   │       │   └── validation.ts
│   │       ├── materialTable/
│   │       ├── antTable/
│   │       └── generic/
│   ├── recorder/
│   │   ├── RecorderBackend.ts
│   │   ├── RecorderUI.tsx
│   │   └── tools/
│   │       ├── RecordTool.ts
│   │       ├── AssertTool.ts
│   │       └── InspectTool.ts
│   ├── features/
│   │   ├── smartAssertions.ts
│   │   ├── snapshotDiff.ts
│   │   ├── autoUpdate.ts
│   │   └── workflows.ts
│   ├── codegen/
│   │   ├── generators/
│   │   │   ├── playwright.ts
│   │   │   ├── cypress.ts
│   │   │   └── selenium.ts
│   │   └── matchers/
│   └── injected/
│       └── recorderInjection.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── api/
│   ├── guides/
│   └── examples/
├── examples/
│   ├── ag-grid/
│   ├── material-ui/
│   └── workflows/
└── package.json
```

---

## Timeline Estimate

- **Phase 1-2 (Foundation)**: 2-3 weeks
- **Phase 3 (AG-Grid)**: 2 weeks
- **Phase 4 (More Components)**: 3-4 weeks
- **Phase 5 (Advanced Features)**: 2 weeks
- **Phase 6 (Code Generation)**: 1-2 weeks
- **Phase 7 (Testing & Docs)**: 2 weeks

**Total**: 12-16 weeks for full implementation

**MVP** (Phase 1-3 only): 4-5 weeks

---

## Get Started

1. Review `/tmp/playwright` repository structure
2. Extract ARIA snapshot core modules (Phase 1)
3. Set up project structure with TypeScript
4. Implement component registry (Phase 2)
5. Build AG-Grid handler as reference (Phase 3)
6. Iterate on other components
7. Add advanced features
8. Polish and document

Good luck! 🚀
