# Playwright Recorder CLI

Custom Playwright recorder with component snapshot support for advanced UI testing.

## Features

- 🎬 **Record Actions**: Capture user interactions (clicks, fills, navigation)
- 🎯 **Component Snapshots**: Capture grids, tables, forms, modals with custom attributes
- 📸 **Aria Snapshots**: Standard accessibility tree snapshots
- ✅ **Validation**: Validate snapshots against actual page state
- 🔄 **Update Snapshots**: Smart snapshot updates with patch files
- 🌐 **Multi-Component Support**: Grid, Table, Form, Modal, Tabs, Accordion, Tree, and more

## Installation

```bash
npm install
npm run install-browsers
```

## Quick Start

### 1. Record Actions and Snapshots

```bash
# Start recorder
npx playwright-recorder record --url http://localhost:3000

# Record with custom output
npx playwright-recorder record --url http://localhost:3000 --output ./tests/my-test.spec.js
```

**In the recorder:**
1. Interact with your page (clicks, fills, etc.)
2. Click "📸 Snapshot" for standard aria snapshot
3. Click "🎯 Component" for component with attributes
4. Click "💾 Save Test" to generate test file
5. Click "⏹️ Stop" when done

### 2. Run Your Tests

```bash
npx playwright test
```

### 3. Validate Snapshots

```bash
# Validate all tests
npx playwright-recorder validate tests/**/*.spec.js

# Validate specific tests
npx playwright-recorder validate tests/grid.spec.js --base-url http://localhost:3000
```

### 4. Update Snapshots

```bash
# Update all snapshots (creates patch files)
npx playwright-recorder update

# Update with 3-way merge
npx playwright-recorder update --update-source-method 3way

# Update and overwrite directly
npx playwright-recorder update --update-source-method overwrite
```

## Supported Components

### Grid
```yaml
- grid "User Grid" [
    row-count=25
    column-count=5
    columns=["Name", "Email", "Status"]
    sortable=true
    filterable=true
    selectable=true
    selection-mode="multiple"
  ]
```

### Table
```yaml
- table [
    row-count=10
    column-count=4
    headers=["Name", "Email", "Status", "Actions"]
    striped=true
  ]
```

### Form
```yaml
- form "Contact Form" [
    field-count=5
    fields=["Name", "Email", "Phone", "Message"]
    validation=true
    submit-button="Send"
  ]
```

### Modal
```yaml
- dialog "Confirmation" [
    size="medium"
    closeable=true
    has-backdrop=true
    footer-actions=["Cancel", "Confirm"]
    open=true
  ]
```

## CLI Commands

### `record`
Start recording actions and component snapshots.

### `validate`
Validate aria snapshots in test files.

### `update`
Update aria snapshots.

### `capture`
Utility to capture snapshot from URL.

## License

MIT
