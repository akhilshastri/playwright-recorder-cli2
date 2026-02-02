# Playwright Recorder & ARIA Snapshot Exploration Summary

## Overview
This document summarizes the exploration of Microsoft Playwright's codegen, recorder, and ARIA snapshot implementation to assess reusability for building a custom recorder with customized ARIA snapshot functionality.

**Repository:** https://github.com/microsoft/playwright
**License:** Apache License 2.0
**Cloned to:** `/tmp/playwright`

---

## 1. Architecture Overview

### 1.1 Codegen & Recorder Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser Page                        │
│                    (DOM Events: click, type, etc.)               │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│              Injected Recorder (Page Context)                    │
│  File: packages/injected/src/recorder/recorder.ts (1942 lines)  │
│  - RecordActionTool: captures user actions                      │
│  - TextAssertionTool: captures assertions                       │
│  - InspectTool: element picker                                  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ↓ (Exposed Bindings)
                        __pw_recorderRecordAction()
                        __pw_recorderPerformAction()
                        __pw_recorderState()
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Playwright Backend (Recorder)                   │
│  File: packages/playwright-core/src/server/recorder.ts          │
│  - State management                                             │
│  - Event emission (ActionAdded, SignalAdded, etc.)              │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                      RecorderApp (Coordinator)                   │
│  File: packages/playwright-core/src/server/recorder/            │
│        recorderApp.ts                                           │
│  - Launches UI window                                           │
│  - Code generation                                              │
│  - Bidirectional communication                                  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ↓ (window.dispatch / sendCommand)
┌─────────────────────────────────────────────────────────────────┐
│                       Recorder UI (React)                        │
│  File: packages/recorder/src/recorder.tsx                       │
│  - Code display                                                 │
│  - Mode controls (record, inspect, assert)                      │
│  - Call logs                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Entry Points

| Component | File | Key Function |
|-----------|------|--------------|
| CLI Command | `packages/playwright-core/src/cli/program.ts:559` | `codegen()` function |
| Backend Core | `packages/playwright-core/src/server/recorder.ts` | `Recorder` class |
| UI Coordinator | `packages/playwright-core/src/server/recorder/recorderApp.ts` | `RecorderApp` class |
| Injected Recorder | `packages/injected/src/recorder/recorder.ts` | `Recorder` & tools |
| UI Component | `packages/recorder/src/recorder.tsx` | React UI |

---

## 2. ARIA Snapshot Implementation

### 2.1 Core ARIA Snapshot Files

| File | Size | Purpose |
|------|------|---------|
| `packages/injected/src/ariaSnapshot.ts` | 745 lines | ARIA tree generation & rendering |
| `packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts` | 580 lines | Types, parsing, template matching |
| `packages/injected/src/roleUtils.ts` | 1799 lines | ARIA role computation |
| `packages/injected/src/domUtils.ts` | 223 lines | DOM utilities |
| `packages/injected/src/yaml.ts` | 88 lines | YAML escaping |

### 2.2 ARIA Snapshot Generation Modes

Playwright supports **4 different ARIA snapshot modes**:

```typescript
type AriaTreeOptions = {
  mode: 'ai' | 'expect' | 'codegen' | 'autoexpect';
};
```

#### Mode Details:

1. **'ai' mode** - For AI consumption
   - Visibility: `ariaOrVisible` (element visible if ARIA-visible OR visually visible)
   - Refs: `interactable` (only interactive elements get refs)
   - Renders: cursor pointer, active state
   - Use case: AI/LLM analysis of page structure

2. **'expect' mode** - For test assertions
   - Visibility: `aria` (ARIA visibility only)
   - Refs: `none`
   - Use case: Runtime assertion matching in tests

3. **'codegen' mode** - For code generation
   - Visibility: `aria` (ARIA visibility only)
   - Refs: `none`
   - **Renders strings as regex** (converts dynamic content to patterns)
   - Use case: Recording assertions with dynamic content handling

4. **'autoexpect' mode** - For auto-generating assertions
   - Visibility: `ariaAndVisible` (must be both ARIA-visible AND visually visible)
   - Refs: `none`
   - Use case: Automatic assertion generation on visible elements

### 2.3 Regex Pattern Generation for Dynamic Content

When using `mode: 'codegen'`, the ARIA snapshot intelligently converts dynamic content to regex patterns:

```typescript
// File: packages/injected/src/ariaSnapshot.ts:674-712

const dynamicContentPatterns = [
  // File sizes: 2mb, 100kb → /[\d,.]+[bkmBKM]+/
  { regex: /\b[\d,.]+[bkmBKM]+\b/, replacement: '[\\d,.]+[bkmBKM]+' },

  // Time durations: 2ms, 20s, 1h → /\d+[hmsp]+/
  { regex: /\b\d+[hmsp]+\b/, replacement: '\\d+[hmsp]+' },

  // Multi-digit numbers: 22, 22.3, 2,333 → /\d+/
  { regex: /\b\d{2,}\b/, replacement: '\\d+' },

  // Decimal numbers: 22.3, 100.45 → /\d+\.\d+/
  { regex: /\b\d+\.\d{2,}\b/, replacement: '\\d+\\.\\d+' },
];
```

### 2.4 ARIA Snapshot YAML Output Format

Example ARIA snapshot rendered as YAML:

```yaml
- heading "Page Title" [level=1]
  - paragraph "User count: /\d+/"
    - link "View Details" /url="https://example.com/details"
    - button "Submit" [disabled]
- navigation
  - list
    - listitem
      - link "Home" [selected]
```

**Supported Properties:**
- `[level=N]` - Heading level
- `[checked]`, `[disabled]`, `[expanded]`, `[selected]` - ARIA states
- `[ref=e1]` - Element references
- `/url="..."` - Link URLs
- `/pattern/` - Regex patterns for dynamic content

### 2.5 How ARIA Snapshot Assertions Are Generated

**Flow:**
1. User clicks "Assert snapshot" button → Mode becomes `'assertingSnapshot'`
2. User clicks element
3. `TextAssertionTool._generateAction()` calls:
   ```typescript
   ariaSnapshot: this._recorder.injectedScript.ariaSnapshot(
     target,
     { mode: 'codegen' }
   )
   ```
4. `generateAriaTree()` creates accessibility tree from DOM
5. Tree is rendered to YAML with regex patterns
6. `AssertSnapshotAction` is created with YAML string
7. Code generator produces language-specific assertion:
   ```typescript
   // JavaScript
   await expect(page.locator('.container'))
     .toMatchAriaSnapshot(`
       - heading "Title"
         - button "Click me"
     `);
   ```

---

## 3. Key Dependencies & Reusable Modules

### 3.1 Highly Reusable Modules (Minimal Dependencies)

These modules are relatively self-contained and can be extracted:

| Module | File | Lines | Dependencies | Reusability |
|--------|------|-------|--------------|-------------|
| **ARIA Snapshot** | `packages/injected/src/ariaSnapshot.ts` | 745 | roleUtils, domUtils, yaml, isomorphic/ariaSnapshot | ⭐⭐⭐⭐ High |
| **Role Utils** | `packages/injected/src/roleUtils.ts` | 1799 | domUtils | ⭐⭐⭐⭐ High |
| **Selector Generator** | `packages/injected/src/selectorGenerator.ts` | 581 | domUtils, roleUtils | ⭐⭐⭐⭐ High |
| **DOM Utils** | `packages/injected/src/domUtils.ts` | 223 | None (pure DOM) | ⭐⭐⭐⭐⭐ Very High |
| **YAML Utils** | `packages/injected/src/yaml.ts` | 88 | None | ⭐⭐⭐⭐⭐ Very High |

### 3.2 Module Dependency Graph

```
ariaSnapshot.ts
    ├── roleUtils.ts
    │   └── domUtils.ts
    ├── domUtils.ts
    ├── yaml.ts
    └── @isomorphic/ariaSnapshot (types & parsing)
        └── @isomorphic/stringUtils
```

### 3.3 Isomorphic Modules (Shared Between Browser & Node)

Located in: `packages/playwright-core/src/utils/isomorphic/`

| Module | Purpose | Reusability |
|--------|---------|-------------|
| `ariaSnapshot.ts` | ARIA types, template parsing, matching logic | ⭐⭐⭐⭐⭐ |
| `stringUtils.ts` | String normalization, whitespace handling | ⭐⭐⭐⭐⭐ |
| `yaml.ts` | YAML parsing (using 'yaml' npm package) | ⭐⭐⭐⭐ |
| `locatorGenerators.ts` | Language-specific locator generation | ⭐⭐⭐⭐ |
| `selectorParser.ts` | CSS selector parsing | ⭐⭐⭐⭐ |

---

## 4. Recorder Architecture Details

### 4.1 Recorder Modes

```typescript
type Mode =
  | 'none'                    // Idle
  | 'recording'               // Recording actions
  | 'inspecting'              // Element picker
  | 'recording-inspecting'    // Both
  | 'standby'                 // Paused between actions
  | 'assertingText'           // Text assertions
  | 'assertingValue'          // Value assertions
  | 'assertingVisibility'     // Visibility assertions
  | 'assertingSnapshot'       // ARIA snapshot assertions
```

### 4.2 Communication Protocol

**Page → Backend (Exposed Bindings):**
```typescript
__pw_recorderRecordAction(action: ActionInContext)
__pw_recorderPerformAction(action: ActionInContext)
__pw_recorderState() → UIState
__pw_recorderSetMode(mode: Mode)
__pw_recorderElementPicked(element: ElementInfo)
```

**Backend → UI:**
```typescript
// Via window.dispatch() in Recorder UI
interface RecorderFrontend {
  modeChanged(params: { mode: Mode }): void;
  pauseStateChanged(params: { paused: boolean }): void;
  sourcesUpdated(params: { sources: Source[] }): void;
  callLogsUpdated(params: { callLogs: CallLog[] }): void;
  elementPicked(params: { elementInfo: ElementInfo }): void;
}
```

**UI → Backend:**
```typescript
// Via window.sendCommand()
interface RecorderBackend {
  setMode(params: { mode: Mode }): Promise<void>;
  resume(): Promise<void>;
  pause(): Promise<void>;
  step(): Promise<void>;
  clear(): Promise<void>;
  highlightRequested(params: {
    selector?: string;
    ariaTemplate?: AriaTemplateNode
  }): Promise<void>;
}
```

### 4.3 Action Types

**Recording Actions:**
- `ClickAction`, `DblClickAction`, `HoverAction`
- `FillAction`, `PressAction`, `SelectAction`
- `CheckAction`, `UncheckAction`
- `SetInputFilesAction`
- `NavigateAction`, `OpenPageAction`, `ClosePageAction`

**Assertion Actions:**
- `AssertTextAction` - Text content assertions
- `AssertValueAction` - Input value assertions
- `AssertCheckedAction` - Checkbox state assertions
- `AssertVisibleAction` - Visibility assertions
- **`AssertSnapshotAction`** - ARIA snapshot assertions
  ```typescript
  type AssertSnapshotAction = {
    name: 'assertSnapshot';
    selector: string;
    ariaSnapshot: string;  // YAML string
    signals: Signal[];
  };
  ```

### 4.4 Signals (Side Effects)

Actions can include signals for side effects:
```typescript
type Signal =
  | { name: 'navigation', url: string }
  | { name: 'popup', popupAlias: string }
  | { name: 'download', downloadAlias: string }
  | { name: 'dialog', dialogAlias: string }
```

---

## 5. Code Reusability Assessment

### 5.1 ✅ What CAN Be Reused Directly

#### **High Priority - ARIA Snapshot Core (⭐⭐⭐⭐⭐)**

1. **ARIA Tree Generation**
   - File: `packages/injected/src/ariaSnapshot.ts`
   - Function: `generateAriaTree(rootElement, options)`
   - **Can be extracted** with dependencies on:
     - `roleUtils.ts` (ARIA role computation)
     - `domUtils.ts` (DOM visibility checks)
     - `yaml.ts` (YAML escaping)
     - `@isomorphic/ariaSnapshot` (types)
     - `@isomorphic/stringUtils` (normalization)

2. **ARIA Template Matching**
   - File: `packages/injected/src/ariaSnapshot.ts`
   - Function: `matchesExpectAriaTemplate(rootElement, template)`
   - Returns: Match results + received snapshot (both raw & regex)

3. **ARIA Snapshot Rendering**
   - File: `packages/injected/src/ariaSnapshot.ts`
   - Function: `renderAriaTree(snapshot, options)`
   - Modes: `'ai'`, `'expect'`, `'codegen'`, `'autoexpect'`

4. **Role Utilities**
   - File: `packages/injected/src/roleUtils.ts` (1799 lines)
   - Functions:
     - `getAriaRole(element)` - Compute ARIA role
     - `getElementAccessibleName(element)` - Get accessible name
     - `getElementAccessibleDescription(element)` - Get description
     - `getAriaDisabled(element)`, `getCheckedAllowMixed(element)`, etc.

5. **Selector Generation**
   - File: `packages/injected/src/selectorGenerator.ts`
   - Function: `generateSelector(element, options)`
   - Options: `{ testIdAttributeName, forTextExpect }`
   - Generates CSS selectors, test ID selectors, text selectors, etc.

#### **Medium Priority - Utilities (⭐⭐⭐⭐)**

6. **DOM Utilities**
   - File: `packages/injected/src/domUtils.ts`
   - Functions: `isElementVisible()`, `computeBox()`, `getElementComputedStyle()`

7. **YAML Utilities**
   - File: `packages/injected/src/yaml.ts`
   - Functions: `yamlEscapeKeyIfNeeded()`, `yamlEscapeValueIfNeeded()`

8. **Isomorphic Types & Parsing**
   - File: `packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts`
   - Types: `AriaNode`, `AriaTemplateNode`, `AriaRole`
   - Functions: `parseAriaSnapshot()`, `matchesNode()`, `renderAriaTree()`

### 5.2 ❌ What CANNOT Be Reused As-Is

1. **Recorder Backend** - Tightly coupled to Playwright's context & protocol
   - File: `packages/playwright-core/src/server/recorder.ts`
   - Reason: Depends on Playwright's internal `BrowserContext`, `Page`, `Frame` objects

2. **RecorderApp** - Launches UI in Chromium
   - File: `packages/playwright-core/src/server/recorder/recorderApp.ts`
   - Reason: Creates separate Chromium instance, Playwright-specific

3. **Code Generation** - Language-specific code generators
   - Files: `packages/playwright-core/src/server/codegen/*.ts`
   - Reason: Generates Playwright API calls, but structure is reusable

4. **Protocol Layer** - Playwright's internal protocol
   - File: `packages/protocol/src/channels.d.ts`
   - Reason: Internal RPC protocol, but action types can be adapted

### 5.3 🔄 What Can Be Adapted

1. **Action Types & Structures**
   - File: `packages/recorder/src/actions.d.ts`
   - **Adaptation:** Use same action schema, adapt code generation

2. **Recorder Tools Pattern**
   - File: `packages/injected/src/recorder/recorder.ts`
   - Pattern: Mode-based tool switching
   - **Adaptation:**
     - Keep: Tool pattern, assertion tools, element inspection
     - Replace: Communication layer (use your own bindings)

3. **Communication Pattern**
   - Pattern: Bidirectional page ↔ backend communication
   - **Adaptation:** Replace `__pw_recorder*` bindings with custom bindings

---

## 6. Custom Recorder Implementation Strategy

### 6.1 Recommended Approach: **Hybrid Reuse**

**Extract & Reuse Core Modules:**
1. Copy ARIA snapshot core files to your project:
   ```
   src/aria/
   ├── ariaSnapshot.ts       (from packages/injected/src/)
   ├── roleUtils.ts          (from packages/injected/src/)
   ├── domUtils.ts           (from packages/injected/src/)
   ├── yaml.ts               (from packages/injected/src/)
   └── types/
       ├── ariaSnapshot.ts   (from packages/playwright-core/src/utils/isomorphic/)
       └── stringUtils.ts    (from packages/playwright-core/src/utils/isomorphic/)
   ```

2. Maintain Apache 2.0 license headers in copied files

3. Create adapters for missing dependencies:
   ```typescript
   // Adapter for @isomorphic imports
   import * as aria from './types/ariaSnapshot';
   import { normalizeWhiteSpace } from './types/stringUtils';
   ```

**Build Custom Recorder Layer:**
1. Implement your own recorder bindings
2. Create custom communication protocol
3. Build your own UI (or reuse Playwright's React UI)
4. Implement custom code generation for your needs

### 6.2 Architecture for Custom Recorder

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
│                   (Your test framework/tool)                     │
└──────────────────────────────────────────────────────────────────┘
                               ↑
                               │ Custom Protocol
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                     Custom Recorder Backend                      │
│  - State management                                             │
│  - Custom code generation (your format)                         │
│  - Custom assertion format                                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ↓ Custom Bindings
┌─────────────────────────────────────────────────────────────────┐
│               Injected Recorder (Adapted from PW)                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         ✅ REUSE: Playwright ARIA Modules               │   │
│  │  - ariaSnapshot.ts (generateAriaTree, render, match)   │   │
│  │  - roleUtils.ts (ARIA role computation)                │   │
│  │  - selectorGenerator.ts (CSS selector generation)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         🔄 ADAPT: Recorder Tools                        │   │
│  │  - RecordActionTool (click, fill, press)               │   │
│  │  - TextAssertionTool (with custom aria snapshot)       │   │
│  │  - InspectTool (element picker)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         ✨ CUSTOM: Communication Layer                  │   │
│  │  - Your custom bindings                                │   │
│  │  - Your action format                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Customizing ARIA Snapshot

**Three Levels of Customization:**

#### Level 1: Mode Selection (Easy)
Just use different modes:
```typescript
// Standard codegen mode
const snapshot1 = generateAriaTree(element, { mode: 'codegen' });

// AI mode (more permissive visibility)
const snapshot2 = generateAriaTree(element, { mode: 'ai' });

// Custom refs
const snapshot3 = generateAriaTree(element, {
  mode: 'codegen',
  refPrefix: 'custom-'
});
```

#### Level 2: Options Extension (Medium)
Extend `InternalOptions` to add custom behaviors:
```typescript
type CustomOptions = InternalOptions & {
  includeDataAttributes?: boolean;
  includeCustomRoles?: boolean;
  customRegexPatterns?: RegexPattern[];
};
```

#### Level 3: Fork & Modify (Advanced)
Fork the ARIA snapshot modules and:
- Add custom ARIA properties
- Customize regex generation logic
- Add custom rendering formats (JSON, XML, etc.)
- Implement custom matching algorithms

**Example Customization - Add Data Attributes:**
```typescript
// In forked ariaSnapshot.ts
function buildAriaNode(element: Element, options: CustomOptions): aria.AriaNode {
  const node = {
    // ... standard ARIA properties
    role: getAriaRole(element),
    name: getElementAccessibleName(element),

    // ✨ CUSTOM: Add data attributes
    props: {
      ...standardProps,
      ...(options.includeDataAttributes ? getDataAttributes(element) : {})
    }
  };
  return node;
}
```

---

## 7. Implementation Checklist

### Phase 1: Extract Core Modules ✅
- [ ] Copy ARIA snapshot core files
- [ ] Copy role utilities
- [ ] Copy selector generator
- [ ] Copy DOM & YAML utilities
- [ ] Copy isomorphic types
- [ ] Create adapter layer for imports
- [ ] Verify Apache 2.0 license compliance

### Phase 2: Build Custom Recorder
- [ ] Design custom action format
- [ ] Implement page injection mechanism
- [ ] Create custom recorder bindings
- [ ] Implement recorder tools (record, inspect, assert)
- [ ] Build communication protocol
- [ ] Add mode switching logic

### Phase 3: Customize ARIA Snapshot
- [ ] Choose customization level (1-3)
- [ ] Implement custom ARIA properties (if needed)
- [ ] Customize regex generation (if needed)
- [ ] Add custom rendering options
- [ ] Implement custom matching logic (if needed)

### Phase 4: Backend & Code Generation
- [ ] Implement backend state management
- [ ] Create custom code generator
- [ ] Add assertion code generation
- [ ] Implement file output
- [ ] Add language support (if multi-language)

### Phase 5: UI (Optional)
- [ ] Design recorder UI (or reuse Playwright's)
- [ ] Implement mode controls
- [ ] Add code preview
- [ ] Add element highlighting
- [ ] Implement assertion preview

---

## 8. Key Takeaways

### ✅ High Reusability Components:
1. **ARIA Snapshot Generation** - Core accessibility tree logic (745 lines)
2. **Role Utilities** - ARIA role computation (1799 lines)
3. **Selector Generation** - CSS selector logic (581 lines)
4. **DOM Utilities** - Visibility & layout checks (223 lines)

**Total reusable code: ~3,400 lines** of battle-tested ARIA & selector logic

### 🔄 Adaptable Components:
1. **Recorder Tools Pattern** - Mode-based tool switching
2. **Action Types** - Action schema & structure
3. **Communication Pattern** - Bidirectional protocol

### ❌ Non-Reusable (Must Rebuild):
1. **Backend Integration** - Tightly coupled to Playwright
2. **UI Layer** - Chromium-based UI window
3. **Code Generation** - Playwright-specific API calls

### 🎯 Recommendation:
**YES, you can reuse Playwright's ARIA snapshot code!**

The core ARIA snapshot implementation is:
- Well-modularized
- Self-contained (minimal external dependencies)
- Licensed under Apache 2.0 (permissive)
- Battle-tested in production
- Actively maintained

**Strategy:**
1. Extract ARIA snapshot core modules (~3,400 lines)
2. Build custom recorder layer on top
3. Customize ARIA snapshot behavior as needed
4. Implement custom code generation for your format

This approach gives you:
- ✅ Production-ready ARIA snapshot logic
- ✅ Intelligent regex generation for dynamic content
- ✅ Comprehensive ARIA role support
- ✅ Flexible customization options
- ✅ No dependency on full Playwright framework

---

## 9. Key File Locations Reference

### ARIA Snapshot Core:
- `packages/injected/src/ariaSnapshot.ts` (745 lines)
- `packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts` (580 lines)
- `packages/injected/src/roleUtils.ts` (1799 lines)
- `packages/injected/src/selectorGenerator.ts` (581 lines)
- `packages/injected/src/domUtils.ts` (223 lines)
- `packages/injected/src/yaml.ts` (88 lines)

### Recorder Architecture:
- `packages/injected/src/recorder/recorder.ts` (1942 lines)
- `packages/playwright-core/src/server/recorder.ts`
- `packages/playwright-core/src/server/recorder/recorderApp.ts`
- `packages/recorder/src/recorder.tsx` (React UI)
- `packages/recorder/src/actions.d.ts` (Action types)
- `packages/recorder/src/recorderTypes.d.ts` (Communication types)

### Code Generation:
- `packages/playwright-core/src/server/codegen/javascript.ts`
- `packages/playwright-core/src/server/codegen/python.ts`
- `packages/playwright-core/src/server/codegen/csharp.ts`
- `packages/playwright-core/src/server/codegen/java.ts`

---

## 10. License Compliance

**Playwright License:** Apache License 2.0

**Requirements when reusing code:**
1. ✅ Include original copyright notice
2. ✅ Include Apache 2.0 license text
3. ✅ State modifications made (if any)
4. ✅ Include NOTICE file (if exists)

**Permissions:**
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use

**Your custom recorder can use any license**, but the copied Playwright files must retain their Apache 2.0 headers.

---

## Conclusion

Playwright's ARIA snapshot implementation is **highly reusable** for building a custom recorder with customized ARIA snapshot functionality. The core modules are well-designed, modular, and can be extracted with minimal dependencies.

**Recommended approach:**
1. ✅ Reuse ARIA snapshot core (~3,400 lines)
2. 🔄 Adapt recorder tools & patterns
3. ✨ Build custom communication & code generation

This gives you production-ready ARIA snapshot logic while maintaining full control over your recorder implementation.
