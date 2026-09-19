# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a fully client-side, single-page web application delivered as three static files: `index.html`, `css/style.css`, and `js/app.js`. There is no build step, no server, and no external dependency except Chart.js loaded via CDN. All transaction data is persisted exclusively in the browser's `localStorage`.

The app allows a user to:
- Record expense transactions (name, amount, category).
- View all transactions in a reverse-chronological scrollable list.
- Delete individual transactions.
- See a live-updating total balance.
- See a live-updating pie chart of spending by category.
- Create custom spending categories beyond the three defaults.
- Set a spending limit (per-category or overall) and receive a visual alert when exceeded.
- Toggle between Light and Dark themes, with preference persisted across sessions.

All UI updates (balance, chart, list) happen synchronously in the same call stack as the storage write, so the screen is never out of sync with storage.

### Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Markup | HTML5 | Required by constraints |
| Styling | CSS3 (single file) | Required by constraints |
| Logic | Vanilla ES2020 JS (single file) | Required by constraints |
| Charts | Chart.js v4 via CDN | Required by constraints |
| Persistence | `localStorage` | Required by constraints |
| Build | None | Works from `file://` URL |

---

## Architecture

The app follows a **unidirectional data flow** pattern implemented without a framework:

```
User Action
    │
    ▼
Event Handler (js/app.js)
    │
    ├─► Validator (pure functions)
    │       │ validation error → render error messages → stop
    │
    ├─► Storage Layer (read/write localStorage)
    │       │ storage error → render error message → stop
    │
    ├─► State update (in-memory array)
    │
    └─► Render Layer (DOM mutation)
            ├─ renderTransactionList()
            ├─ renderBalance()
            ├─ renderChart()
            ├─ renderAlerts()
            └─ renderLimitControls()
```

**Key principles:**
- A single in-memory `transactions` array is the source of truth at runtime. It is loaded once from `localStorage` on page load and kept in sync on every add/delete.
- Storage writes always happen **before** DOM updates. If the write fails, the DOM is not changed.
- All render functions are idempotent — they can be called any number of times and produce the same result for the same data.
- No global mutable state other than the `transactions` array, the `categories` array, `spendingLimits`, and the `Chart` instance reference.

### File Structure

```
index.html          ← HTML shell, CDN script tag, app.js script tag
css/
  style.css         ← all styles
js/
  app.js            ← all application logic
```

---

## Components and Interfaces

### 1. HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">          ← Balance_Display
      <span id="balance-label">Total Spent</span>
      <span id="balance-value">0.00</span>
    </div>
    <button id="theme-toggle" aria-label="Switch to dark mode">☀️</button>
  </header>

  <main>
    <section id="form-section">         ← Input_Form area
      <form id="expense-form">
        <div class="field-group">
          <label for="item-name">Item Name</label>
          <input id="item-name" type="text" maxlength="100" />
          <span class="error-msg" id="item-name-error"></span>
        </div>
        <div class="field-group">
          <label for="amount">Amount</label>
          <input id="amount" type="number" step="0.01" />
          <span class="error-msg" id="amount-error"></span>
        </div>
        <div class="field-group">
          <label for="category">Category</label>
          <select id="category">
            <!-- populated by renderCategoryOptions -->
          </select>
        </div>
        <span class="error-msg" id="storage-error"></span>
        <button type="submit">Add Expense</button>
      </form>

      <div id="category-manager">
        <h3>Manage Categories</h3>
        <form id="add-category-form">
          <input id="new-category-input" type="text" maxlength="50" placeholder="New category name" />
          <span class="error-msg" id="category-error"></span>
          <button type="submit">Add Category</button>
        </form>
        <ul id="custom-category-list"></ul>
      </div>
    </section>

    <section id="chart-section">        ← Chart area
      <canvas id="spending-chart"></canvas>
      <div id="chart-placeholder" hidden>No spending data to display.</div>
    </section>

    <section id="list-section">         ← Transaction_List area
      <h2>Transactions</h2>
      <ul id="transaction-list"></ul>
      <p id="empty-state" hidden>No expenses have been recorded.</p>
    </section>

    <section id="limit-section">        ← Spending Limit area
      <h2>Spending Limits</h2>
      <form id="add-limit-form">
        <select id="limit-category">
          <option value="__total__">Overall Total</option>
          <!-- populated by renderLimitControls -->
        </select>
        <input id="limit-value" type="number" step="0.01" min="0.01" placeholder="Limit amount" />
        <span class="error-msg" id="limit-error"></span>
        <button type="submit">Set Limit</button>
      </form>
      <ul id="limit-list"></ul>
    </section>
  </main>
</body>
```

### 2. JavaScript Modules (all within `js/app.js`)

The file is organized into clearly commented sections, not ES modules (to remain `file://`-compatible without a bundler):

#### 2.1 Constants

```js
const STORAGE_KEY = 'evb_transactions';
const MAX_AMOUNT  = 999999999.99;
const MIN_AMOUNT  = 0.01;

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

const BASE_CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// Auto-generated colors for custom categories (hue rotation palette)
const AUTO_COLOR_PALETTE = [
  '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF',
  '#7CFC00', '#FF69B4', '#00CED1', '#FFD700',
];

const STORAGE_KEY_CATEGORIES = 'evb_categories';
const STORAGE_KEY_LIMITS     = 'evb_limits';
const STORAGE_KEY_THEME      = 'evb_theme';
```

#### 2.2 State

```js
let transactions   = [];        // Array<Transaction>
let categories     = [...DEFAULT_CATEGORIES]; // Array<string> — default + custom
let categoryColors = { ...BASE_CATEGORY_COLORS }; // Record<string, string>
let spendingLimits = {};        // Record<string, number> — key: category name or '__total__'
let chartInstance  = null;      // Chart.js instance
let currentTheme   = 'light';   // 'light' | 'dark'
```

#### 2.3 Storage Layer

| Function | Signature | Behavior |
|---|---|---|
| `loadFromStorage()` | `() → { data: Transaction[], storageUnavailable: boolean }` | Reads and JSON-parses `localStorage[STORAGE_KEY]`. Returns `[]` on missing key, parse error, or `localStorage` unavailability. Sets a flag to show load-error message if unavailable. |
| `saveToStorage(txns)` | `(Transaction[]) → boolean` | JSON-serializes and writes to `localStorage`. Returns `true` on success, `false` on `QuotaExceededError` or any other exception. |
| `loadCategories()` | `() → { data: string[], storageUnavailable: boolean }` | Reads `STORAGE_KEY_CATEGORIES` from localStorage. Returns default categories on missing key, parse error, or storage unavailability. |
| `saveCategories(cats)` | `(string[]) → boolean` | JSON-serializes and writes to `localStorage[STORAGE_KEY_CATEGORIES]`. Returns `true` on success, `false` on any exception. |
| `loadLimits()` | `() → { data: Record<string, number>, storageUnavailable: boolean }` | Reads `STORAGE_KEY_LIMITS`. Returns `{}` on missing key, parse error, or unavailability. |
| `saveLimits(limits)` | `(Record<string, number>) → boolean` | JSON-serializes and writes to `localStorage[STORAGE_KEY_LIMITS]`. Returns `true` on success, `false` on any exception. |
| `loadTheme()` | `() → 'light' \| 'dark'` | Reads `STORAGE_KEY_THEME`. Returns `'light'` if missing or unavailable. |
| `saveTheme(theme)` | `('light' \| 'dark') → boolean` | Writes theme string to `localStorage[STORAGE_KEY_THEME]`. Returns `true` on success, `false` on any exception. |

#### 2.4 Validator

| Function | Signature | Behavior |
|---|---|---|
| `validateForm(name, amount, category)` | `(string, string, string) → ValidationResult` | Returns `{ valid: boolean, errors: { itemName?: string, amount?: string } }`. Empty/whitespace name → error. Non-numeric, zero, negative, or out-of-range amount → error. |
| `validateCategory(name, existingCategories)` | `(string, string[]) → { valid: boolean, error?: string }` | Trims name. Empty → error `'Category name is required.'`. Case-insensitive duplicate of existing → error `'Category already exists.'`. Otherwise `{ valid: true }`. |
| `validateLimit(value)` | `(string) → { valid: boolean, error?: string }` | Non-numeric, zero, negative, or outside [0.01, 999999999.99] → error. Otherwise `{ valid: true }`. |

```ts
// Pseudo-type
type ValidationResult = {
  valid: boolean;
  errors: {
    itemName?: string;  // set when item name is empty
    amount?: string;    // set when amount is invalid
  };
};
```

#### 2.5 Transaction Factory

```js
function createTransaction(itemName, amount, category) {
  return {
    id:        crypto.randomUUID(),   // unique identifier for delete
    itemName:  itemName.trim(),
    amount:    parseFloat(parseFloat(amount).toFixed(2)),
    category:  category,
    createdAt: Date.now(),            // Unix ms timestamp
  };
}
```

#### 2.6 Render Layer

| Function | Behavior |
|---|---|
| `renderTransactionList(txns)` | Clears `#transaction-list`, creates one `<li>` per transaction (newest first), toggles `#empty-state`. |
| `renderBalance(txns)` | Sums amounts, formats to 2 decimal places, updates `#balance-value`. |
| `renderChart(txns)` | Computes per-category sums. If no transactions: destroys chart, shows `#chart-placeholder`. Else: upserts Chart.js instance with new data, hides placeholder. |
| `renderErrors(errors)` | Writes error strings into the relevant `.error-msg` spans; clears spans that have no error. |
| `clearErrors()` | Clears all `.error-msg` spans. |

#### 2.7 Event Handlers

| Handler | Trigger | Steps |
|---|---|---|
| `handleFormSubmit(e)` | `#expense-form submit` | 1. `preventDefault`. 2. `clearErrors`. 3. `validateForm` → on failure: `renderErrors`, return. 4. `createTransaction`. 5. `saveToStorage([...transactions, newTxn])` → on failure: show storage error, return. 6. Push to `transactions`. 7. `renderTransactionList`, `renderBalance`, `renderChart`, `renderAlerts`. 8. Reset form fields. |
| `handleDeleteClick(e)` | Click on `.delete-btn` inside `#transaction-list` | 1. Read `data-id` from button. 2. Compute `updated = transactions.filter(t => t.id !== id)`. 3. `saveToStorage(updated)` → on failure: show error, return. 4. `transactions = updated`. 5. `renderTransactionList`, `renderBalance`, `renderChart`, `renderAlerts`. |

#### 2.8 Initialisation

```js
document.addEventListener('DOMContentLoaded', () => {
  // Theme must be applied first to avoid flash of wrong theme
  const savedTheme = loadTheme();
  applyTheme(savedTheme);

  // Load persisted data
  const txResult  = loadFromStorage();
  const catResult = loadCategories();
  const limResult = loadLimits();

  if (txResult.storageUnavailable || catResult.storageUnavailable) {
    showLoadError();
  }

  transactions   = txResult.data;
  categories     = catResult.data;
  categoryColors = buildCategoryColors(categories);
  spendingLimits = limResult.data;

  // Initial render
  renderCategoryOptions(categories);
  renderTransactionList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
  renderLimitControls(spendingLimits, categories);
  renderAlerts(transactions, spendingLimits);

  // Attach event handlers
  document.getElementById('expense-form')
    .addEventListener('submit', handleFormSubmit);
  document.getElementById('transaction-list')
    .addEventListener('click', handleDeleteClick);
  document.getElementById('add-category-form')
    .addEventListener('submit', handleAddCategory);
  document.getElementById('add-limit-form')
    .addEventListener('submit', handleSaveLimit);
  document.getElementById('theme-toggle')
    .addEventListener('click', handleThemeToggle);
});
```

#### 2.9 Category Manager

| Function | Signature | Behavior |
|---|---|---|
| `buildCategoryColors(cats)` | `(string[]) → Record<string, string>` | Returns a color map merging `BASE_CATEGORY_COLORS` for known defaults and assigning colors from `AUTO_COLOR_PALETTE` (cycling if needed) for any custom category not already present in `BASE_CATEGORY_COLORS`. |
| `renderCategoryOptions(cats)` | `(string[]) → void` | Clears and repopulates the `<select id="category">` element with one `<option>` per category string. |
| `handleAddCategory(e)` | Add-category form submit | 1. `preventDefault`. 2. Read new category name from `#new-category-input`. 3. `validateCategory(name, categories)` → on failure: show inline error in `#category-error`, return. 4. Push name to `categories`. 5. `buildCategoryColors(categories)` → update `categoryColors`. 6. `saveCategories(categories)` → on failure: show storage error, return. 7. `renderCategoryOptions(categories)`. 8. `renderChart(transactions)` (to include the new category). 9. Reset `#new-category-input`. |
| `handleDeleteCategory(name)` | Delete-category button click | 1. Check if any transaction uses this category → if yes: show error `'Category is in use and cannot be deleted.'`, return. 2. Remove from `categories`. 3. `saveCategories(categories)` → on failure: show storage error, revert, return. 4. `renderCategoryOptions(categories)`. 5. `renderChart(transactions)`. |

#### 2.10 Spending Limit Manager

Spending limits are stored as a map keyed by category name or the special key `'__total__'` for the overall balance.

| Function | Signature | Behavior |
|---|---|---|
| `renderLimitControls(limits, categories)` | `(Record<string, number>, string[]) → void` | Renders a list of current limits (category name + limit value + edit/remove buttons). Also renders an "Add Limit" form with a category selector (including `'__total__'` → "Overall Total") and a numeric input. |
| `handleSaveLimit(e)` | Save-limit form submit | 1. `preventDefault`. 2. Read selected key and value. 3. `validateLimit(value)` → on failure: show inline error, return. 4. Update `spendingLimits[key] = parseFloat(value)`. 5. `saveLimits(spendingLimits)` → on failure: show storage error, return. 6. `renderLimitControls(spendingLimits, categories)`. 7. `renderAlerts(transactions, spendingLimits)`. |
| `handleRemoveLimit(key)` | Remove-limit button click | 1. `delete spendingLimits[key]`. 2. `saveLimits(spendingLimits)`. 3. `renderLimitControls(spendingLimits, categories)`. 4. `renderAlerts(transactions, spendingLimits)` (clears alert for that key). |
| `renderAlerts(txns, limits)` | `(Transaction[], Record<string, number>) → void` | Computes per-category totals and overall total. For each key in `limits`: if the relevant total ≥ limit value, adds CSS class `alert-exceeded` to the corresponding element (balance display or category label in the transaction list); otherwise removes the class. |

`renderAlerts` is called after every add, delete, and limit change.

#### 2.11 Theme Manager

Theme is implemented via a `data-theme` attribute on `<html>`. CSS variables are defined under `[data-theme="light"]` (default) and `[data-theme="dark"]` selectors. Switching the attribute value triggers the CSS variable change instantly (< 200 ms via CSS transitions).

| Function | Signature | Behavior |
|---|---|---|
| `applyTheme(theme)` | `('light' \| 'dark') → void` | Sets `document.documentElement.dataset.theme = theme`. Updates the toggle button's `aria-label` and icon (`☀️` for light, `🌙` for dark). |
| `handleThemeToggle()` | Toggle button click | 1. Compute `next = currentTheme === 'light' ? 'dark' : 'light'`. 2. `saveTheme(next)`. 3. `applyTheme(next)`. 4. Updates module-level `currentTheme`. |

Theme application on load (in Section 2.8 Initialisation) happens **before** any other render to avoid flash-of-wrong-theme. `applyTheme(loadTheme())` is the **first** statement inside the `DOMContentLoaded` callback.

### 3. CSS Structure (`css/style.css`)

The stylesheet is organized into sections:

1. **CSS Custom Properties / Reset** — variables for colors, spacing, font sizes.
2. **Theme Variables** — `[data-theme="light"]` and `[data-theme="dark"]` CSS custom property definitions.
3. **Layout** — `body` flex/grid structure, responsive breakpoints using `@media`.
4. **Header / Balance Display** — distinct heading font size, weight hierarchy.
5. **Form** — field groups, labels, inputs, button, error message styling.
6. **Transaction List** — scrollable container (`overflow-y: auto`), list item layout, delete button.
7. **Chart Section** — canvas sizing, placeholder text.
8. **Category Manager** — custom category input, list of custom categories with delete controls.
9. **Spending Limit Section** — limit form, limit list, alert styling.
10. **Utility** — `.error-msg`, `.hidden`, `.alert-exceeded`, accessible focus ring styles.

All color references use CSS custom properties rather than hard-coded values:

```css
/* Light theme (default) */
[data-theme="light"] {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f5f5f5;
  --text-primary:  #111111;
  --text-secondary:#555555;
  --border-color:  #dddddd;
  --accent:        #2196F3;
  --alert-bg:      #ffe0e0;
  --alert-border:  #e53935;
}

/* Dark theme */
[data-theme="dark"] {
  --bg-primary:    #1e1e1e;
  --bg-secondary:  #2d2d2d;
  --text-primary:  #f0f0f0;
  --text-secondary:#aaaaaa;
  --border-color:  #444444;
  --accent:        #64B5F6;
  --alert-bg:      #4a1a1a;
  --alert-border:  #ef9a9a;
}
```

Typography hierarchy (satisfying Requirement 7.3):
- Headings (`h1`, `h2`): `1.5rem`, `font-weight: 700`
- Labels: `1rem`, `font-weight: 600`
- Data values (balance, transaction amounts): `0.875rem`, `font-weight: 400`

Responsive behavior (Requirement 7.4):
- Single-column layout on narrow viewports (< 640px).
- Two-column layout (form + chart side-by-side, list below) on wider viewports (≥ 640px).
- `max-width: 1200px` centered container prevents over-stretching on very wide screens.
- All widths use `%` or `clamp()` — no fixed pixel widths on containers.

---

## Data Models

### Transaction

```ts
interface Transaction {
  id:        string;   // UUID v4, generated by crypto.randomUUID()
  itemName:  string;   // trimmed, 1–100 characters
  amount:    number;   // float, rounded to 2 decimal places, 0.01–999999999.99
  category:  string;   // one of the current categories (default or custom)
  createdAt: number;   // Unix timestamp in milliseconds
}
```

### SpendingLimits

```ts
interface SpendingLimits {
  [key: string]: number;  // key: category name or '__total__'; value: limit amount
}
```

### Storage Format

Transactions are stored as a JSON-serialized array under the key `'evb_transactions'`:

```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "itemName": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1726300800000
  }
]
```

### Storage Keys Summary

| Key | Type | Purpose |
|---|---|---|
| `evb_transactions` | `Transaction[]` | All stored transactions |
| `evb_categories` | `string[]` | Full list of category names (defaults + custom) |
| `evb_limits` | `SpendingLimits` | Spending limit thresholds |
| `evb_theme` | `'light' \| 'dark'` | User's theme preference |

**Size estimate for 10,000 transactions:**  
Each record is approximately 150 bytes of JSON. 10,000 × 150 = ~1.5 MB. The `localStorage` quota on all major browsers is ≥ 5 MB, so 10,000 transactions fit comfortably. A single `JSON.parse` of 1.5 MB executes in < 50 ms on modern hardware, well within the 500 ms load budget.

### Chart Data Model (runtime only)

```ts
interface CategoryTotals {
  [category: string]: number;  // dynamic — includes defaults and custom categories
}
```

Computed by reducing the `transactions` array each time `renderChart` is called. Not persisted.

### ValidationResult (runtime only)

```ts
interface ValidationResult {
  valid: boolean;
  errors: {
    itemName?: string;
    amount?:   string;
  };
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction addition round-trip

*For any* valid transaction (non-empty item name, amount in [0.01, 999999999.99], valid category), after it is added via `handleFormSubmit`, reading back from `localStorage` and parsing the stored JSON should contain a transaction with the same `itemName`, `amount`, and `category`.

**Validates: Requirements 1.2, 1.3, 5.2**

---

### Property 2: Whitespace and invalid inputs are rejected

*For any* string composed entirely of whitespace characters submitted as the item name, or any value that is non-numeric, zero, negative, or greater than 999,999,999.99 submitted as the amount, `validateForm` should return `valid: false` and the `transactions` array should remain unchanged.

**Validates: Requirements 1.5, 1.6**

---

### Property 3: Balance equals sum of amounts

*For any* collection of transactions, `renderBalance` should display a value equal to the sum of all transaction amounts rounded to exactly 2 decimal places, and this should hold after every add and after every delete.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 4: Chart segment proportions are correct

*For any* non-empty collection of transactions, each category's pie segment arc should be proportional to that category's sum divided by the total sum of all amounts (i.e., the data array passed to Chart.js sums to the total, with each entry equal to its category's total).

**Validates: Requirements 4.1, 4.3, 4.4**

---

### Property 5: Deletion removes transaction and updates storage

*For any* transaction present in the list, after `handleDeleteClick` succeeds, that transaction's `id` should not appear in either the in-memory `transactions` array or the JSON stored in `localStorage`, and the balance should decrease by that transaction's amount.

**Validates: Requirements 2.4, 5.2, 3.3**

---

### Property 6: Storage-failure prevents state mutation

*For any* add or delete action, if `saveToStorage` returns `false`, the `transactions` array, the DOM transaction list, the balance value, and the chart data should all remain identical to their state before the action was attempted.

**Validates: Requirements 1.7, 2.5, 5.4**

---

### Property 7: Transaction list render order

*For any* collection of transactions with distinct `createdAt` values, `renderTransactionList` should render them in strictly descending order of `createdAt` (most recent first).

**Validates: Requirements 2.3**

---

### Property 8: Form reset after successful submission

*For any* successful form submission, after the handler completes, the `item-name` input value should be empty, the `amount` input value should be empty, and the `category` selector should be reset to its first option (`Food`).

**Validates: Requirements 1.4**

---

### Property 9: Custom categories persist and are available in the selector

*For any* valid custom category name (non-empty, non-duplicate after trim), after `handleAddCategory` succeeds, the category should be present in both the `categories` array and `localStorage['evb_categories']`, and it should appear as an option in `<select id="category">`.

**Validates: Requirements 8.1, 8.2, 8.3, 8.5**

---

### Property 10: Spending alert activates when limit is met or exceeded

*For any* spending limit `L` set for key `K`, after any add or delete that causes the relevant total to cross `L`, `renderAlerts` should add or remove the `alert-exceeded` CSS class on the corresponding element consistently — present when total ≥ L, absent when total < L.

**Validates: Requirements 9.3, 9.4, 9.5**

---

### Property 11: Theme toggle persists and applies before first paint

*For any* saved theme value (`'light'` or `'dark'`), on page load `applyTheme(loadTheme())` is called before any other render, so `document.documentElement.dataset.theme` is set to the correct value before any element is painted.

**Validates: Requirements 10.2, 10.3, 10.4**

---

## Error Handling

### Validation Errors (user input)

- Triggered before any storage interaction.
- Inline error messages appear adjacent to the offending field via `.error-msg` spans.
- All field values are preserved so the user can correct them.
- Errors are cleared on the next submit attempt.

### Storage Write Failure

- Detected when `localStorage.setItem` throws (e.g., `QuotaExceededError`).
- No changes are made to the in-memory `transactions` array.
- No DOM updates are made (list, balance, chart remain unchanged).
- A storage error message is shown near the submit button / delete control.

### Storage Read Failure on Load

- Detected when `localStorage` is inaccessible or when `JSON.parse` throws.
- App initializes with `transactions = []`.
- An informational banner is shown explaining that saved data could not be loaded.
- The app remains fully functional for new entries during the current session.

### Chart.js Load Failure

- If Chart.js fails to load from CDN (offline, CDN down), `window.Chart` will be `undefined`.
- `renderChart` checks `typeof Chart !== 'undefined'` before attempting to create an instance.
- If unavailable, the chart section shows a fallback message: "Chart unavailable — Chart.js could not be loaded."

### Error Message Display Rules

| Scenario | Location | Style |
|---|---|---|
| Empty item name | Adjacent to item name field | Red inline text, `.error-msg` |
| Invalid amount | Adjacent to amount field | Red inline text, `.error-msg` |
| Storage write failure | Below submit button | Red inline text, `.error-msg` |
| Storage unavailable on load | Top of page (banner) | Yellow informational banner |
| Delete storage failure | Near the transaction item | Red inline text |
| Empty/duplicate category name | Adjacent to new-category input | Red inline text, `.error-msg` |
| Category in use (delete blocked) | Adjacent to category list item | Red inline text, `.error-msg` |
| Invalid limit value | Adjacent to limit value input | Red inline text, `.error-msg` |
| Spending limit exceeded | Balance display / category label | `.alert-exceeded` CSS class (red bg/border) |
| Theme save failure | Silent (non-critical) | No visible error; theme still applied in-memory |

---

## Testing Strategy

### Unit Tests

Unit tests cover pure functions in isolation, using specific examples and edge cases. A simple test harness (or a lightweight library like [uvu](https://github.com/lukeed/uvu)) can be used without a bundler by running via Node.js.

**Functions to unit-test:**

| Function | Test Cases |
|---|---|
| `validateForm` | Valid input → `valid: true`. Empty name → error on `itemName`. Whitespace-only name → error. Amount = 0 → error. Amount = -1 → error. Amount = `"abc"` → error. Amount = 999999999.99 → valid. Amount = 1000000000 → error. All fields empty → errors on both. |
| `createTransaction` | Output has `id`, `itemName` (trimmed), `amount` (2 dp float), `category`, `createdAt` fields. |
| `loadFromStorage` | Missing key → returns `[]`. Valid JSON → returns parsed array. Malformed JSON → returns `[]`. |
| `saveToStorage` | Normal write → returns `true`. Simulated quota error → returns `false`. |
| Balance calculation (extracted helper) | Empty array → `0.00`. Single item → equals its amount. Multiple items → correct sum. Floating-point edge: `0.1 + 0.2 → 0.30`. |
| Category totals (extracted helper) | All same category → one non-zero entry. Mixed → correct per-category totals. |
| `validateCategory` | Valid name → `valid: true`. Empty/whitespace → error. Duplicate (case-insensitive) → error. |
| `validateLimit` | Valid value → `valid: true`. Zero, negative, non-numeric, > 999999999.99 → error. |
| `buildCategoryColors` | Default categories get expected hex codes. Custom category gets a color from AUTO_COLOR_PALETTE. Colors are unique. |
| `renderAlerts` | Total < limit → no `.alert-exceeded`. Total === limit → `.alert-exceeded` added. Total > limit → `.alert-exceeded` added. No limit set → no class. |

### Property-Based Tests

Property-based tests use a library such as [fast-check](https://github.com/dubzzz/fast-check) to verify universal properties across randomly generated inputs.

Each test is configured to run a **minimum of 100 iterations**.

Each test is tagged with a comment identifying the design property it validates:
`// Feature: expense-budget-visualizer, Property N: <property_text>`

| Property | Test Description |
|---|---|
| **Property 1** (add round-trip) | Generate random valid transactions. Add each via the logic, verify `localStorage` contains the transaction with correct fields. |
| **Property 2** (invalid inputs rejected) | Generate arbitrary strings as item name and arbitrary values as amount. Confirm `validateForm` returns `valid: false` for whitespace-only names and out-of-range/non-numeric amounts. |
| **Property 3** (balance = sum) | Generate random arrays of transactions. Compute balance independently. Confirm `renderBalance` output matches. |
| **Property 4** (chart proportions) | Generate random transaction arrays with mixed categories. Compute expected per-category sums. Confirm values passed to Chart.js match. |
| **Property 5** (delete removes) | Generate a list of transactions, pick a random one to delete, confirm it is absent from both memory and storage, confirm balance decreases by that amount. |
| **Property 6** (storage failure → no mutation) | Mock `saveToStorage` to return `false`. Attempt add/delete. Confirm `transactions` and DOM remain unchanged. |
| **Property 7** (render order) | Generate transactions with random `createdAt` values. Confirm `renderTransactionList` outputs items in descending `createdAt` order. |
| **Property 8** (form reset) | Simulate successful submit with arbitrary valid inputs. Confirm input fields are reset to initial state. |
| **Property 9** (custom category round-trip) | Generate random valid category names. Add each, verify presence in array and localStorage. |
| **Property 10** (alert threshold accuracy) | Generate random transaction arrays and random limits. Verify `renderAlerts` adds/removes class correctly for all combinations of total vs limit. |
| **Property 11** (theme persistence) | For both `'light'` and `'dark'`: save via `saveTheme`, reload via `loadTheme`, verify returned value matches. |

### Integration / Manual Tests

These are verified manually in a browser (Chrome, Firefox, Edge, Safari) opened via `file://`:

- Full add → list → chart → balance cycle in each browser.
- Reload page → data persists.
- Delete all transactions → empty state shown for list, chart shows placeholder, balance shows `0.00`.
- Open DevTools → Application → Storage → clear `localStorage` → reload → app shows empty state.
- Throttle CPU in DevTools → verify load completes within 2 s, add/delete within 300 ms.
- Resize viewport from 320 px to 1920 px → no horizontal scroll, no clipping, no overlap.
- Hover over pie slice → tooltip shows category name and percentage.
- Add a custom category → it appears in the dropdown → add a transaction using it → it appears in the chart with a unique color.
- Try to add a duplicate category (same name, different case) → error shown, no duplicate created.
- Try to delete a category that has transactions → error shown, category remains.
- Set an overall spending limit → add transactions until total meets the limit → balance display turns red.
- Remove the limit → alert styling disappears immediately.
- Toggle to dark mode → all components update within 200 ms → reload page → dark mode is still active.
- Toggle back to light mode → sun icon shown in toggle → light mode applied.
