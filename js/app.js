/* js/app.js */

/* ============================================================
   §2.1 CONSTANTS
   ============================================================ */

const STORAGE_KEY = 'evb_transactions';
const MAX_AMOUNT  = 999999999.99;
const MIN_AMOUNT  = 0.01;

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

// Static color map kept for backward-compatibility with early render calls
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// Canonical base colors for the three defaults
const BASE_CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// Colors auto-assigned to custom categories (cycles when exhausted)
const AUTO_COLOR_PALETTE = [
  '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF',
  '#7CFC00', '#FF69B4', '#00CED1', '#FFD700',
];

const STORAGE_KEY_CATEGORIES = 'evb_categories';
const STORAGE_KEY_LIMITS     = 'evb_limits';
const STORAGE_KEY_THEME      = 'evb_theme';

/* ============================================================
   §2.2 STATE
   ============================================================ */

let transactions   = [];
let categories     = [...DEFAULT_CATEGORIES];
let categoryColors = { ...BASE_CATEGORY_COLORS };
let spendingLimits = {};
let chartInstance  = null;
let currentTheme   = 'light';

/* ============================================================
   §2.3 STORAGE LAYER
   ============================================================ */

function loadFromStorage() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (_e) {
    return { data: [], storageUnavailable: true };
  }

  if (raw === null) {
    return { data: [], storageUnavailable: false };
  }

  try {
    const parsed = JSON.parse(raw);
    return { data: Array.isArray(parsed) ? parsed : [], storageUnavailable: false };
  } catch (_e) {
    return { data: [], storageUnavailable: false };
  }
}

function saveToStorage(txns) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
    return true;
  } catch (_e) {
    return false;
  }
}

function loadCategories() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
  } catch (_e) {
    return { data: [...DEFAULT_CATEGORIES], storageUnavailable: true };
  }

  if (raw === null) {
    return { data: [...DEFAULT_CATEGORIES], storageUnavailable: false };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return { data: [...DEFAULT_CATEGORIES], storageUnavailable: false };
    }

    const customCategories = parsed.filter(
      (cat) => typeof cat === 'string' && cat.trim().length > 0
    );

    const mergedCategories = [...DEFAULT_CATEGORIES];

    customCategories.forEach((cat) => {
      const trimmed = cat.trim();
      const exists = mergedCategories.some(
        (existing) => existing.toLowerCase() === trimmed.toLowerCase()
      );

      if (!exists) {
        mergedCategories.push(trimmed);
      }
    });

    return {
      data: mergedCategories,
      storageUnavailable: false,
    };
  } catch (_e) {
    return { data: [...DEFAULT_CATEGORIES], storageUnavailable: false };
  }
}

function saveCategories(cats) {
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
    return true;
  } catch (_e) {
    return false;
  }
}

function loadLimits() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY_LIMITS);
  } catch (_e) {
    return { data: {}, storageUnavailable: true };
  }

  if (raw === null) {
    return { data: {}, storageUnavailable: false };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { data: {}, storageUnavailable: false };
    }

    const validLimits = {};

    Object.entries(parsed).forEach(([key, value]) => {
      const numberValue = Number(value);

      if (
        typeof key === 'string' &&
        Number.isFinite(numberValue) &&
        numberValue >= MIN_AMOUNT &&
        numberValue <= MAX_AMOUNT
      ) {
        validLimits[key] = numberValue;
      }
    });

    return {
      data: validLimits,
      storageUnavailable: false,
    };
  } catch (_e) {
    return { data: {}, storageUnavailable: false };
  }
}

function saveLimits(limits) {
  try {
    localStorage.setItem(STORAGE_KEY_LIMITS, JSON.stringify(limits));
    return true;
  } catch (_e) {
    return false;
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  } catch (_e) {
    return 'light';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    return true;
  } catch (_e) {
    return false;
  }
}

/* ============================================================
   §2.4 VALIDATOR
   ============================================================ */

function validateForm(name, amount, category) {
  const errors = {};

  if (!name || name.trim().length === 0) {
    errors.itemName = 'Item name is required.';
  }

  const parsed = Number(amount);

  if (
    amount === '' ||
    amount === null ||
    amount === undefined ||
    !Number.isFinite(parsed)
  ) {
    errors.amount = `Amount must be a number between ${MIN_AMOUNT} and ${MAX_AMOUNT}.`;
  } else if (parsed < MIN_AMOUNT || parsed > MAX_AMOUNT) {
    errors.amount = `Amount must be a number between ${MIN_AMOUNT} and ${MAX_AMOUNT}.`;
  }

  if (!category || category.trim().length === 0) {
    errors.category = 'Category is required.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function validateCategory(name, existingCategories) {
  const trimmed = (name || '').trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Category name is required.' };
  }

  const lower = trimmed.toLowerCase();
  const isDuplicate = existingCategories.some(
    (cat) => cat.trim().toLowerCase() === lower
  );

  if (isDuplicate) {
    return { valid: false, error: 'Category already exists.' };
  }

  return { valid: true };
}

function validateLimit(value) {
  const parsed = Number(value);

  if (
    value === '' ||
    value === null ||
    value === undefined ||
    !Number.isFinite(parsed)
  ) {
    return {
      valid: false,
      error: `Limit must be a number between ${MIN_AMOUNT} and ${MAX_AMOUNT}.`,
    };
  }

  if (parsed < MIN_AMOUNT || parsed > MAX_AMOUNT) {
    return {
      valid: false,
      error: `Limit must be a number between ${MIN_AMOUNT} and ${MAX_AMOUNT}.`,
    };
  }

  return { valid: true };
}

/* ============================================================
   §2.5 TRANSACTION FACTORY
   ============================================================ */

function createTransaction(itemName, amount, category) {
  return {
    id:        typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2),
    itemName:  itemName.trim(),
    amount:    parseFloat(Number(amount).toFixed(2)),
    category:  category,
    createdAt: Date.now(),
  };
}

/* ============================================================
   §2.6 RENDER LAYER
   ============================================================ */

function renderTransactionList(txns) {
  const list       = document.getElementById('transaction-list');
  const emptyState = document.getElementById('empty-state');

  if (!list || !emptyState) return;

  list.innerHTML = '';

  if (txns.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  const sorted = txns.slice().sort((a, b) => b.createdAt - a.createdAt);

  sorted.forEach((txn) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = txn.id;

    li.innerHTML = `
      <span class="txn-name">${escapeHtml(txn.itemName)}</span>
      <span class="txn-category">${escapeHtml(txn.category)}</span>
      <span class="txn-amount">$${Number(txn.amount).toFixed(2)}</span>
      <button class="delete-btn" data-id="${escapeHtml(txn.id)}" aria-label="Delete ${escapeHtml(txn.itemName)}">Delete</button>
    `;

    list.appendChild(li);
  });
}

function renderBalance(txns) {
  const totalCents = txns.reduce((sum, txn) => {
    return sum + Math.round(Number(txn.amount) * 100);
  }, 0);

  const total = totalCents / 100;

  const balanceValue = document.getElementById('balance-value');

  if (balanceValue) {
    balanceValue.textContent = '$' + total.toFixed(2);
  }
}

/* ============================================================
   §2.6 HELPERS (render utilities)
   ============================================================ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function renderChart(txns) {
  const canvas      = document.getElementById('spending-chart');
  const placeholder = document.getElementById('chart-placeholder');

  if (!canvas || !placeholder) return;

  if (typeof Chart === 'undefined') {
    placeholder.textContent = 'Chart unavailable — Chart.js could not be loaded.';
    placeholder.hidden = false;
    canvas.hidden = true;
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (txns.length === 0) {
    placeholder.hidden = false;
    canvas.hidden = true;
    return;
  }

  const totals = {};

  txns.forEach((txn) => {
    const amount = Number(txn.amount);

    if (!Number.isFinite(amount)) return;

    totals[txn.category] = (totals[txn.category] || 0) + amount;
  });

  const activeCategories = Object.keys(totals).filter(
    (cat) => totals[cat] > 0
  );

  if (activeCategories.length === 0) {
    placeholder.hidden = false;
    canvas.hidden = true;
    return;
  }

  const colorMap =
    typeof categoryColors !== 'undefined' ? categoryColors : CATEGORY_COLORS;

  const labels     = activeCategories;
  const dataValues = activeCategories.map((cat) => totals[cat]);
  const colors     = activeCategories.map(
    (cat) => colorMap[cat] || '#CCCCCC'
  );

  const grandTotal = dataValues.reduce((sum, v) => sum + v, 0);

  placeholder.hidden = true;
  canvas.hidden = false;

  chartInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          data:            dataValues,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const pct = ((context.parsed / grandTotal) * 100).toFixed(1);
              return context.label + ': ' + pct + '%';
            },
          },
        },
      },
    },
  });
}

function renderErrors(errors) {
  const fieldMap = {
    itemName: 'item-name-error',
    amount:   'amount-error',
    storage:  'storage-error',
    category: 'category-error',
  };

  Object.entries(fieldMap).forEach(([key, id]) => {
    const el = document.getElementById(id);

    if (el) {
      el.textContent = errors[key] || '';
    }
  });
}

function clearErrors() {
  document.querySelectorAll('.error-msg').forEach((el) => {
    el.textContent = '';
  });
}

/* ============================================================
   §2.6 RENDER — renderCategoryOptions, renderLimitControls, renderAlerts
   ============================================================ */

function renderCategoryOptions(cats) {
  const select = document.getElementById('category');

  if (!select) return;

  select.innerHTML = '';

  cats.forEach((cat) => {
    const option = document.createElement('option');

    option.value       = cat;
    option.textContent = cat;

    select.appendChild(option);
  });
}

function renderLimitControls(limits, categories) {
  const limitSelect = document.getElementById('limit-category');

  if (limitSelect) {
    const previousValue = limitSelect.value;

    limitSelect.innerHTML = '';

    const totalOption = document.createElement('option');

    totalOption.value       = '__total__';
    totalOption.textContent = 'Overall Total';

    limitSelect.appendChild(totalOption);

    categories.forEach((cat) => {
      const option = document.createElement('option');

      option.value       = cat;
      option.textContent = cat;

      limitSelect.appendChild(option);
    });

    const availableValues = Array.from(limitSelect.options).map(
      (option) => option.value
    );

    if (availableValues.includes(previousValue)) {
      limitSelect.value = previousValue;
    }
  }

  const limitList = document.getElementById('limit-list');

  if (!limitList) return;

  limitList.innerHTML = '';

  const limitEntries = Object.entries(limits);

  if (limitEntries.length === 0) return;

  limitEntries.forEach(([key, value]) => {
    const label = key === '__total__' ? 'Overall Total' : escapeHtml(key);
    const li    = document.createElement('li');

    li.className = 'limit-item';

    li.innerHTML =
      `<span class="limit-key">${label}</span>` +
      `<span class="limit-value">$${Number(value).toFixed(2)}</span>` +
      `<button class="remove-limit-btn" data-key="${escapeHtml(key)}" ` +
        `aria-label="Remove limit for ${label}">Remove</button>`;

    limitList.appendChild(li);
  });
}

function renderAlerts(txns, limits) {
  const categoryTotals = {};
  let overallTotal = 0;

  txns.forEach((txn) => {
    const amount = Number(txn.amount);

    if (!Number.isFinite(amount)) return;

    categoryTotals[txn.category] =
      (categoryTotals[txn.category] || 0) + amount;

    overallTotal += amount;
  });

  overallTotal = Math.round(overallTotal * 100) / 100;

  Object.keys(categoryTotals).forEach((cat) => {
    categoryTotals[cat] =
      Math.round(categoryTotals[cat] * 100) / 100;
  });

  const balanceDisplay = document.getElementById('balance-display');

  if (balanceDisplay) {
    if (limits['__total__'] !== undefined) {
      if (overallTotal >= Number(limits['__total__'])) {
        balanceDisplay.classList.add('alert-exceeded');
      } else {
        balanceDisplay.classList.remove('alert-exceeded');
      }
    } else {
      balanceDisplay.classList.remove('alert-exceeded');
    }
  }

  const categorySpans = document.querySelectorAll(
    '#transaction-list .txn-category'
  );

  categorySpans.forEach((span) => {
    const cat = span.textContent;

    if (limits[cat] !== undefined) {
      const catTotal = categoryTotals[cat] || 0;

      if (catTotal >= Number(limits[cat])) {
        span.classList.add('alert-exceeded');
      } else {
        span.classList.remove('alert-exceeded');
      }
    } else {
      span.classList.remove('alert-exceeded');
    }
  });
}

/* ============================================================
   §2.7 EVENT HANDLERS
   ============================================================ */

function handleFormSubmit(e) {
  e.preventDefault();

  clearErrors();

  const name     = document.getElementById('item-name').value;
  const amount   = document.getElementById('amount').value;
  const category = document.getElementById('category').value;

  const validation = validateForm(name, amount, category);

  if (!validation.valid) {
    renderErrors(validation.errors);
    return;
  }

  const newTxn = createTransaction(name, amount, category);

  const updatedTransactions = [...transactions, newTxn];
  const saved = saveToStorage(updatedTransactions);

  if (!saved) {
    renderErrors({
      storage: 'Could not save the transaction. Please try again.',
    });
    return;
  }

  transactions = updatedTransactions;

  renderTransactionList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
  renderAlerts(transactions, spendingLimits);

  document.getElementById('item-name').value  = '';
  document.getElementById('amount').value     = '';
  document.getElementById('category').selectedIndex = 0;
}

/* ============================================================
   §2.7 EVENT HANDLERS
   ============================================================ */

function handleDeleteClick(e) {
  const deleteButton = e.target.closest('.delete-btn');

  if (!deleteButton) return;

  const id = deleteButton.dataset.id;

  if (!id) return;

  const updated = transactions.filter((t) => t.id !== id);

  if (updated.length === transactions.length) return;

  const saved = saveToStorage(updated);

  if (!saved) {
    renderErrors({
      storage: 'Could not delete the transaction. Please try again.',
    });
    return;
  }

  transactions = updated;

  renderTransactionList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
  renderAlerts(transactions, spendingLimits);
}

/* ============================================================
   §2.10 SPENDING LIMIT MANAGER
   ============================================================ */

function handleSaveLimit(e) {
  e.preventDefault();

  const key   = document.getElementById('limit-category').value;
  const value = document.getElementById('limit-value').value;

  const limitErrorEl = document.getElementById('limit-error');

  const validation = validateLimit(value);

  if (!validation.valid) {
    if (limitErrorEl) limitErrorEl.textContent = validation.error;
    return;
  }

  if (limitErrorEl) limitErrorEl.textContent = '';

  const previousValue = spendingLimits[key];

  spendingLimits[key] = parseFloat(Number(value).toFixed(2));

  const saved = saveLimits(spendingLimits);

  if (!saved) {
    if (previousValue === undefined) {
      delete spendingLimits[key];
    } else {
      spendingLimits[key] = previousValue;
    }

    if (limitErrorEl) {
      limitErrorEl.textContent =
        'Could not save the limit. Please try again.';
    }

    return;
  }

  renderLimitControls(spendingLimits, categories);
  renderAlerts(transactions, spendingLimits);

  document.getElementById('limit-value').value = '';
}

function handleRemoveLimit(key) {
  if (!Object.prototype.hasOwnProperty.call(spendingLimits, key)) {
    return;
  }

  const previousValue = spendingLimits[key];

  delete spendingLimits[key];

  const saved = saveLimits(spendingLimits);

  if (!saved) {
    spendingLimits[key] = previousValue;

    const limitErrorEl = document.getElementById('limit-error');

    if (limitErrorEl) {
      limitErrorEl.textContent =
        'Could not remove the limit. Please try again.';
    }

    return;
  }

  renderLimitControls(spendingLimits, categories);
  renderAlerts(transactions, spendingLimits);
}

function handleLimitListClick(e) {
  const removeButton = e.target.closest('.remove-limit-btn');

  if (!removeButton) return;

  const key = removeButton.dataset.key;

  if (key !== undefined) {
    handleRemoveLimit(key);
  }
}

/* ============================================================
   §2.9 CATEGORY MANAGER
   ============================================================ */

function buildCategoryColors(cats) {
  const colorMap = { ...BASE_CATEGORY_COLORS };

  let customIndex = 0;

  cats.forEach((cat) => {
    if (!colorMap[cat]) {
      colorMap[cat] =
        AUTO_COLOR_PALETTE[customIndex % AUTO_COLOR_PALETTE.length];

      customIndex++;
    }
  });

  categoryColors = colorMap;

  return colorMap;
}

function handleAddCategory(e) {
  e.preventDefault();

  const input  = document.getElementById('new-category-input');
  const name   = input ? input.value : '';
  const errEl  = document.getElementById('category-error');

  const result = validateCategory(name, categories);

  if (!result.valid) {
    if (errEl) errEl.textContent = result.error;
    return;
  }

  if (errEl) errEl.textContent = '';

  const trimmedName = name.trim();
  const previousCategories = [...categories];
  const previousColors = { ...categoryColors };

  categories.push(trimmedName);

  buildCategoryColors(categories);

  const saved = saveCategories(categories);

  if (!saved) {
    categories = previousCategories;
    categoryColors = previousColors;

    const storageErr = document.getElementById('storage-error');

    if (storageErr) {
      storageErr.textContent =
        'Could not save category — storage is unavailable.';
    }

    return;
  }

  renderCategoryOptions(categories);
  renderLimitControls(spendingLimits, categories);
  renderChart(transactions);

  if (input) input.value = '';
}

/* ============================================================
   §2.11 THEME MANAGER
   ============================================================ */

function applyTheme(theme) {
  const validTheme = theme === 'dark' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', validTheme);

  const btn = document.getElementById('theme-toggle');

  if (!btn) return;

  if (validTheme === 'light') {
    btn.setAttribute('aria-label', 'Switch to dark mode');
    btn.textContent = '☀️';
  } else {
    btn.setAttribute('aria-label', 'Switch to light mode');
    btn.textContent = '🌙';
  }
}

function handleThemeToggle() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);

  currentTheme = next;
  saveTheme(next);

  const btn = document.getElementById('theme-toggle');

  if (btn) {
    if (next === 'dark') {
      btn.setAttribute('aria-label', 'Switch to light mode');
      btn.textContent = '🌙';
    } else {
      btn.setAttribute('aria-label', 'Switch to dark mode');
      btn.textContent = '☀️';
    }
  }
}

/* ============================================================
   §2.12 INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const transactionStorage = loadFromStorage();
  const categoryStorage = loadCategories();
  const limitStorage = loadLimits();

  transactions = Array.isArray(transactionStorage.data)
    ? transactionStorage.data.filter(
        (txn) =>
          txn &&
          typeof txn.itemName === 'string' &&
          typeof txn.category === 'string' &&
          Number.isFinite(Number(txn.amount))
      )
    : [];

  categories = Array.isArray(categoryStorage.data)
    ? categoryStorage.data
    : [...DEFAULT_CATEGORIES];

  spendingLimits =
    limitStorage.data && typeof limitStorage.data === 'object'
      ? limitStorage.data
      : {};

  currentTheme = loadTheme();

  applyTheme(currentTheme);
  buildCategoryColors(categories);

  renderCategoryOptions(categories);
  renderLimitControls(spendingLimits, categories);
  renderTransactionList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
  renderAlerts(transactions, spendingLimits);

  if (
    transactionStorage.storageUnavailable ||
    categoryStorage.storageUnavailable ||
    limitStorage.storageUnavailable
  ) {
    renderErrors({
      storage: 'Browser storage is unavailable. Data may not be saved.',
    });
  }

  const expenseForm = document.getElementById('expense-form');

  if (expenseForm) {
    expenseForm.addEventListener('submit', handleFormSubmit);
  }

  const transactionList = document.getElementById('transaction-list');

  if (transactionList) {
    transactionList.addEventListener('click', handleDeleteClick);
  }

  const categoryForm = document.getElementById('add-category-form');

  if (categoryForm) {
    categoryForm.addEventListener('submit', handleAddCategory);
  }

  const limitForm = document.getElementById('add-limit-form');

  if (limitForm) {
    limitForm.addEventListener('submit', handleSaveLimit);
  }

  const limitList = document.getElementById('limit-list');

  if (limitList) {
    limitList.addEventListener('click', handleLimitListClick);
  }

  const themeToggle = document.getElementById('theme-toggle');

  if (themeToggle) {
    themeToggle.addEventListener('click', handleThemeToggle);
  }
});