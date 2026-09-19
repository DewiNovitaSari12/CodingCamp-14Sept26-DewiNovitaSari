# Implementation Plan: Expense and Budget Visualizer

## Overview

Build a fully client-side, single-page expense tracker delivered as three static files (`index.html`, `css/style.css`, `js/app.js`). The app records expense transactions, displays them in a reverse-chronological list, shows a live total balance, and renders a pie chart of spending by category using Chart.js. All data is persisted in `localStorage`. There is no build step, no backend, and no framework.

---

## Tasks

- [x] 1. Set up project structure and HTML shell
  - Create the root `index.html` file with the full semantic HTML structure as defined in Design §1: `<header>` with `#balance-display`, `<section id="form-section">` containing `#expense-form` (item-name, amount, category fields and all `.error-msg` spans), `<section id="chart-section">` with `#spending-chart` canvas and `#chart-placeholder`, `<section id="list-section">` with `#transaction-list` and `#empty-state`
  - Add the Chart.js v4 CDN `<script>` tag and the `<script src="js/app.js">` tag (no other scripts or inline logic)
  - Create empty `css/style.css` and `js/app.js` files to ensure the HTML references resolve
  - _Requirements: 6.1, 6.2, 6.3_
  - Add the `#category-manager` section (inside `#form-section`) with `#add-category-form`, `#new-category-input`, `#category-error` span, and `#custom-category-list`; add the `#limit-section` with `#add-limit-form`, `#limit-category` select (with `__total__` option), `#limit-value` input, `#limit-error` span, and `#limit-list`; add `<button id="theme-toggle" aria-label="Switch to dark mode">☀️</button>` to the `<header>`
  - _Requirements: 8.1, 9.1, 10.1_

- [x] 2. Implement constants, state, and the storage layer
  - [x] 2.1 Write constants and state declarations in `js/app.js`
    - Define `STORAGE_KEY`, `MAX_AMOUNT`, `MIN_AMOUNT`, and `CATEGORY_COLORS` as per Design §2.1
    - Declare `let transactions = []` and `let chartInstance = null` as per Design §2.2
    - _Requirements: 6.1, 6.3_
    - Add `DEFAULT_CATEGORIES`, `BASE_CATEGORY_COLORS`, `AUTO_COLOR_PALETTE`, `STORAGE_KEY_CATEGORIES`, `STORAGE_KEY_LIMITS`, `STORAGE_KEY_THEME` constants as per Design §2.1
    - Declare `let categories`, `let categoryColors`, `let spendingLimits`, and `let currentTheme` state variables as per Design §2.2
    - _Requirements: 8.3, 9.2, 10.3_

  - [x] 2.2 Implement `loadFromStorage()` and `saveToStorage(txns)`
    - `loadFromStorage` must handle missing key, JSON parse error, and `localStorage` unavailability — returning `{ data: [], storageUnavailable: boolean }` in all failure cases
    - `saveToStorage` must catch `QuotaExceededError` and any other exception, returning `true` on success and `false` on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
    - Implement `loadCategories()` and `saveCategories(cats)` for `STORAGE_KEY_CATEGORIES`
    - Implement `loadLimits()` and `saveLimits(limits)` for `STORAGE_KEY_LIMITS`
    - Implement `loadTheme()` and `saveTheme(theme)` for `STORAGE_KEY_THEME`
    - All new load functions follow the same pattern: return default value on missing key, parse error, or unavailability; all save functions return `true` on success and `false` on exception
    - _Requirements: 8.5, 9.2, 10.3_

  - [ ]* 2.3 Write property test for storage layer (Property 1 & 6)
    - **Property 1: Transaction addition round-trip** — generate random valid transactions, add via logic, verify `localStorage` contains correct fields after serialization/deserialization
    - **Property 6: Storage-failure prevents state mutation** — mock `saveToStorage` to return `false`, attempt add/delete, confirm `transactions` array and DOM remain unchanged
    - **Validates: Requirements 1.2, 1.3, 1.7, 5.2, 5.4**

- [x] 3. Implement the validator and transaction factory
  - [x] 3.1 Implement `validateForm(name, amount, category)`
    - Return `{ valid, errors: { itemName?, amount? } }` as per Design §2.4
    - Empty/whitespace-only name → `errors.itemName` set
    - Non-numeric, zero, negative, or amount outside `[0.01, 999999999.99]` → `errors.amount` set
    - _Requirements: 1.5, 1.6_

  - [ ]* 3.2 Write property test for validator (Property 2)
    - **Property 2: Whitespace and invalid inputs are rejected** — generate arbitrary whitespace-only strings as item name and out-of-range/non-numeric values as amount; confirm `validateForm` always returns `valid: false` and `transactions` array is unchanged
    - **Validates: Requirements 1.5, 1.6**

  - [x] 3.3 Implement `createTransaction(itemName, amount, category)`
    - Output must include `id` (UUID via `crypto.randomUUID()`), trimmed `itemName`, `amount` rounded to 2 dp, `category`, and `createdAt` (Unix ms) as per Design §2.5
    - _Requirements: 1.2_

  - [x] 3.4 Implement `validateCategory(name, existingCategories)` and `validateLimit(value)`
    - `validateCategory`: trim name; empty/whitespace → `error: 'Category name is required.'`; case-insensitive duplicate in `existingCategories` → `error: 'Category already exists.'`; otherwise `{ valid: true }` — as per Design §2.4
    - `validateLimit`: non-numeric, zero, negative, or outside [0.01, 999999999.99] → error; otherwise `{ valid: true }` — as per Design §2.4
    - _Requirements: 8.2, 9.1_

- [x] 4. Implement the render layer
  - [x] 4.1 Implement `renderTransactionList(txns)` and `renderBalance(txns)`
    - `renderTransactionList`: clear `#transaction-list`, sort by `createdAt` descending, create one `<li>` per transaction showing item name, amount, and category, add a `.delete-btn` with `data-id` attribute, toggle `#empty-state` visibility
    - `renderBalance`: sum all amounts, format to exactly 2 decimal places, write to `#balance-value`
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write property test for balance and render order (Property 3 & 7)
    - **Property 3: Balance equals sum of amounts** — generate random arrays of transactions, confirm rendered balance matches independently computed sum rounded to 2 dp, covering empty array, single item, and floating-point edge cases (e.g., 0.1 + 0.2)
    - **Property 7: Transaction list render order** — generate transactions with random `createdAt` values, confirm rendered DOM order is strictly descending by `createdAt`
    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.4**

  - [x] 4.3 Implement `renderChart(txns)`
    - Compute per-category sums (`Food`, `Transport`, `Fun`) from the transactions array
    - If no transactions: destroy existing Chart.js instance, show `#chart-placeholder`, hide canvas
    - If transactions exist: upsert Chart.js pie chart instance with correct data arrays and `CATEGORY_COLORS`, hide `#chart-placeholder`
    - Guard with `typeof Chart !== 'undefined'`; show fallback message if Chart.js unavailable
    - Enable tooltip showing category name and percentage rounded to 1 decimal place
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.4 Write property test for chart data (Property 4)
    - **Property 4: Chart segment proportions are correct** — generate random transaction arrays with mixed categories, compute expected per-category sums independently, confirm values passed to Chart.js match; verify data array entries sum to total
    - **Validates: Requirements 4.1, 4.3, 4.4**

  - [x] 4.5 Implement `renderErrors(errors)` and `clearErrors()`
    - `renderErrors`: write error strings into `#item-name-error`, `#amount-error`, `#storage-error` spans; clear spans that have no corresponding error
    - `clearErrors`: empty all `.error-msg` spans
    - _Requirements: 1.5, 1.6, 1.7, 2.5_

  - [x] 4.6 Implement `renderCategoryOptions(cats)`, `renderLimitControls(limits, categories)`, and `renderAlerts(txns, limits)`
    - `renderCategoryOptions`: clear and repopulate `<select id="category">` and `<select id="limit-category">` with one `<option>` per category string; include `'__total__'` → "Overall Total" option in limit selector
    - `renderLimitControls`: render current limits as a list with edit/remove buttons; populate limit category selector
    - `renderAlerts`: compute per-category totals and overall total; for each key in `limits`, add CSS class `alert-exceeded` to Balance Display or category label if total ≥ limit, otherwise remove it
    - _Requirements: 8.1, 9.1, 9.3, 9.4, 9.5_

- [x] 5. Checkpoint — Validate render layer in isolation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement event handlers and initialisation
  - [x] 6.1 Implement `handleFormSubmit(e)`
    - Follow the exact sequence from Design §2.7: `preventDefault` → `clearErrors` → `validateForm` (on failure: `renderErrors`, return) → `createTransaction` → `saveToStorage` (on failure: show storage error, return) → push to `transactions` → `renderTransactionList` + `renderBalance` + `renderChart` + `renderAlerts` → reset form fields
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.2_

  - [ ]* 6.2 Write property test for form submit (Property 8)
    - **Property 8: Form reset after successful submission** — simulate successful submit with arbitrary valid inputs, confirm `#item-name` value is empty, `#amount` value is empty, and `#category` is reset to `Food` after handler completes
    - **Validates: Requirements 1.4**

  - [x] 6.3 Implement `handleDeleteClick(e)` using event delegation
    - Read `data-id` from clicked `.delete-btn`, compute `updated = transactions.filter(t => t.id !== id)`, call `saveToStorage(updated)` — on failure show error and return, else update `transactions = updated` and call all three render functions
    - _Requirements: 2.4, 2.5, 3.3, 5.2_

  - [ ]* 6.4 Write property test for deletion (Property 5)
    - **Property 5: Deletion removes transaction and updates storage** — generate a list of transactions, pick a random one to delete, confirm its `id` is absent from both `transactions` array and `localStorage` JSON, confirm balance decreases by exactly that transaction's amount
    - **Validates: Requirements 2.4, 5.2, 3.3**

  - [-] 6.5 Implement `DOMContentLoaded` initialisation
    - Apply theme first (before any render) by calling `applyTheme(loadTheme())` as the very first statement
    - Load persisted data: `loadFromStorage()`, `loadCategories()`, `loadLimits()`; handle `storageUnavailable` flag by showing load-error banner; assign results to `transactions`, `categories`, `spendingLimits`
    - Call `buildCategoryColors(categories)` to populate `categoryColors`
    - Call `renderCategoryOptions`, `renderTransactionList`, `renderBalance`, `renderChart`, `renderLimitControls`, `renderAlerts` for initial render
    - Attach all event handlers: `handleFormSubmit` on `#expense-form submit`, `handleDeleteClick` on `#transaction-list click`, `handleAddCategory` on `#add-category-form submit`, `handleSaveLimit` on `#add-limit-form submit`, `handleThemeToggle` on `#theme-toggle click`
    - _Requirements: 5.1, 5.3, 8.5, 9.2, 10.3, 10.4_

- [ ] 7. Implement CSS styling and responsive layout
  - [x] 7.1 Write CSS custom properties, reset, and base layout in `css/style.css`
    - Define color variables, spacing scale, and font-size variables
    - Apply a responsive layout: single-column on viewports < 640px, two-column (form + chart side-by-side, list below) on ≥ 640px using `flex` or `grid`; `max-width: 1200px` centered container
    - Ensure no horizontal scrollbar from 320px to 1920px; use `%` or `clamp()` — no fixed pixel widths on containers
    - _Requirements: 7.4_

  - [-] 7.2 Style header, balance display, form, transaction list, and chart section
    - Typography hierarchy: `h1`/`h2` at `1.5rem` weight `700`; labels at `1rem` weight `600`; data values (balance, amounts) at `0.875rem` weight `400` — ensuring heading text is ≥ 4px larger than label text, and label text is ≥ 4px larger than data value text
    - Style `.error-msg` spans (red, inline), the storage-error banner (yellow informational), the empty-state paragraph, and the `#chart-placeholder`
    - Style the delete button and scrollable `#transaction-list` container (`overflow-y: auto`)
    - Accessible focus ring styles on interactive elements
    - _Requirements: 7.3, 2.2_
    - Add theme CSS custom properties: `[data-theme="light"]` and `[data-theme="dark"]` variable blocks using the exact color values from Design §3 (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border-color`, `--accent`, `--alert-bg`, `--alert-border`)
    - Style `#category-manager` section (custom category input, list, delete controls) and `#limit-section` (limit form, limit list, edit/remove buttons)
    - Style `.alert-exceeded` class (red background/border using `--alert-bg` and `--alert-border` variables)
    - Style `#theme-toggle` button in header (icon-only, accessible, distinct for each theme state)
    - _Requirements: 8.1, 9.3, 10.2, 10.5, 10.6, 10.7_

- [~] 8. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement custom category management
  - [x] 9.1 Implement `buildCategoryColors(cats)` and `handleAddCategory(e)`
    - `buildCategoryColors`: merge `BASE_CATEGORY_COLORS` for defaults; assign colors from `AUTO_COLOR_PALETTE` (cycling if needed) for any unknown custom category; return full color map — as per Design §2.9
    - `handleAddCategory`: `preventDefault` → read `#new-category-input` → `validateCategory(name, categories)` (on failure: show `#category-error`, return) → push to `categories` → `buildCategoryColors` → `saveCategories` (on failure: show storage error, return) → `renderCategoryOptions` → `renderChart` → reset input — as per Design §2.9
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [-] 9.2 Implement `handleDeleteCategory(name)`
    - Check if any transaction uses this category → if yes: show error `'Category is in use and cannot be deleted.'`, return
    - Remove from `categories`, call `saveCategories` (on failure: show storage error, revert removal, return), call `renderCategoryOptions` and `renderChart`
    - _Requirements: 8.6_

  - [ ]* 9.3 Write property test for custom categories (Property 9)
    - **Property 9: Custom categories persist and are available in the selector** — generate random valid category names; after `handleAddCategory` succeeds, confirm category is present in `categories` array, in `localStorage['evb_categories']`, and as an option in `<select id="category">`
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5**

- [x] 10. Implement spending limit management
  - [x] 10.1 Implement `handleSaveLimit(e)` and `handleRemoveLimit(key)`
    - `handleSaveLimit`: `preventDefault` → read selected key and value → `validateLimit(value)` (on failure: show `#limit-error`, return) → `spendingLimits[key] = parseFloat(value)` → `saveLimits` (on failure: show storage error, return) → `renderLimitControls` → `renderAlerts` — as per Design §2.10
    - `handleRemoveLimit`: `delete spendingLimits[key]` → `saveLimits` → `renderLimitControls` → `renderAlerts` (clears alert for removed key)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [ ]* 10.2 Write property test for spending alerts (Property 10)
    - **Property 10: Spending alert activates when limit is met or exceeded** — generate random transaction arrays and random limit values; verify `renderAlerts` adds `alert-exceeded` class when total ≥ limit and removes it when total < limit, across all category and overall-total combinations
    - **Validates: Requirements 9.3, 9.4, 9.5**

- [x] 11. Implement dark/light mode toggle
  - [x] 11.1 Implement `applyTheme(theme)` and `handleThemeToggle()`
    - `applyTheme`: set `document.documentElement.dataset.theme = theme`; update `#theme-toggle` `aria-label` ("Switch to dark mode" / "Switch to light mode") and icon (☀️ for light, 🌙 for dark) — as per Design §2.11
    - `handleThemeToggle`: compute `next = currentTheme === 'light' ? 'dark' : 'light'` → `saveTheme(next)` → `applyTheme(next)` → update `currentTheme` — as per Design §2.11
    - _Requirements: 10.1, 10.2, 10.3, 10.7_

  - [ ]* 11.2 Write property test for theme persistence (Property 11)
    - **Property 11: Theme toggle persists and applies before first paint** — for both `'light'` and `'dark'`, call `saveTheme`, then `loadTheme`, confirm returned value matches; also verify `applyTheme` sets `document.documentElement.dataset.theme` correctly
    - **Validates: Requirements 10.3, 10.4**

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation before moving to the next phase
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) and validate the universal correctness properties defined in Design §Correctness Properties
- Unit tests cover `validateForm`, `createTransaction`, `loadFromStorage`, `saveToStorage`, balance calculation, and category totals as detailed in Design §Testing Strategy
- All render functions are idempotent — safe to call multiple times with the same data
- Storage writes always happen before DOM updates (Design §Architecture)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.3"] },
    { "id": 2, "tasks": ["2.3", "3.1", "3.4"] },
    { "id": 3, "tasks": ["3.2", "4.1", "4.3", "4.5", "4.6"] },
    { "id": 4, "tasks": ["4.2", "4.4", "6.1", "6.3", "9.1", "10.1", "11.1"] },
    { "id": 5, "tasks": ["6.2", "6.4", "6.5", "7.1", "9.2", "9.3", "10.2", "11.2"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["8. Final checkpoint"] }
  ]
}
```
