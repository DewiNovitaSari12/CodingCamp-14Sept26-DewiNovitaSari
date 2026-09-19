# Requirements Document


## Introduction

The Expense & Budget Visualizer is a client-side web application that helps a single user track spending and visualize where money goes. The user enters transactions (item name, amount, and category), views them in a scrollable list, sees a running total balance, and observes a pie chart that breaks down spending by category. All data is stored in the browser using the Local Storage API, so no backend server is required. The application is built with HTML, CSS, and vanilla JavaScript, and is intended to work as either a standalone web app or a browser extension in modern browsers.
## Glossary

- **Visualizer**: The overall Expense & Budget Visualizer web application, composed of the components below.
- **Input_Form**: The component that collects a new transaction's Item Name, Amount, and Category and submits it.
- **Transaction**: A single spending record consisting of an item name, an amount, and a category.
- **Item Name**: A text label describing a Transaction (for example, "Lunch").
- **Amount**: A numeric monetary value associated with a Transaction.
- **Category**: The classification of a Transaction. The default set is Food, Transport, Fun; users may add custom categories.
- **Transaction List**: The component that displays all stored Transactions and allows deletion.
- **Balance Display**: The component that shows the total balance derived from all stored Transactions.
- **Total Balance**: The sum of the Amount values across all stored Transactions.
- **Spending Chart**: The pie chart component that shows spending distribution by Category.
- **Storage**: The browser Local Storage used to persist all Transactions client-side.
- **Modern Browser**: A current version of Chrome, Firefox, Edge, or Safari.
- **Spending Limit**: A user-defined maximum Amount threshold applied to a Category or overall spending; exceeded thresholds trigger a visual alert.
- **Theme**: The color scheme of the Visualizer, either Light (default) or Dark.
- **Validator**: The client-side logic that checks Input_Form fields before a Transaction is saved.

---

## Requirements

### Requirement 1: Input Form — Transaction Entry

**User Story:** As a user, I want to fill in an expense form with a name, amount, and category, so that I can record a new transaction quickly without any complex setup.

#### Acceptance Criteria

1. THE App SHALL render the Input_Form containing an Item_Name text field with a maximum length of 100 characters, an Amount numeric field accepting values between 0.01 and 999999999.99, a Category selector populated with the current set of categories (defaults: Food, Transport, Fun, plus any user-created custom categories), and a submit button.
2. WHEN the user submits the Input_Form with all fields filled and an Amount value between 0.01 and 999999999.99, THE App SHALL create a new Transaction with the submitted Item_Name, Amount, Category, and a creation timestamp, and add it to the top of the Transaction_List.
3. WHEN the user submits the Input_Form with all fields filled and an Amount value between 0.01 and 999999999.99, THE App SHALL save the new Transaction to Storage within 2 seconds.
4. WHEN the user submits the Input_Form with all fields filled and an Amount value between 0.01 and 999999999.99, THE Input_Form SHALL reset the Item_Name field to empty, the Amount field to empty, and the Category selector to its first option within 500 milliseconds after submission.
5. IF the user submits the Input_Form with one or more empty fields, THEN THE Validator SHALL prevent submission, leave all field values unchanged, and display an inline error message adjacent to each empty field identifying it as required.
6. IF the user enters a value that is non-numeric, zero, negative, or greater than 999999999.99 in the Amount field and submits the Input_Form, THEN THE Validator SHALL prevent submission, leave all other field values unchanged, and display an inline error message adjacent to the Amount field indicating that Amount must be a number between 0.01 and 999999999.99.
7. IF Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL prevent the Transaction from being added to the Transaction_List and display an inline error message indicating that the transaction could not be saved.

---

### Requirement 2: Transaction List — Display and Deletion

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list and remove individual entries, so that I can review and correct my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored Transaction, showing its Item_Name, Amount, and Category.
2. WHILE the number of Transactions exceeds the visible area of the Transaction_List, THE Transaction_List SHALL be scrollable so that all Transactions remain accessible.
3. THE Transaction_List SHALL render Transactions in reverse chronological order of insertion, with the most recently added Transaction appearing first.
4. WHEN the user taps the delete control on a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Storage, and THE Transaction_List SHALL update immediately to reflect the removal without requiring a manual refresh.
5. IF Storage fails to remove the Transaction, THEN THE App SHALL display an error message indicating the deletion was unsuccessful and THE Transaction_List SHALL retain the Transaction at its previous position.
6. WHEN the Transaction_List contains no Transactions, THE Transaction_List SHALL display an empty-state message informing the user that no expenses have been recorded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending amount at the top of the page, so that I always know how much I have spent in aggregate.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of the Amount values of all Transactions stored in Storage, rendered as a decimal number with exactly 2 decimal places.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
4. WHEN the Transaction_List contains no Transactions, THE Balance_Display SHALL display a total of 0.00.
5. IF Storage is unavailable on load, THEN THE Balance_Display SHALL display 0.00 and show an informational message indicating that saved data could not be loaded.

---

### Requirement 4: Pie Chart — Spending Visualization

**User Story:** As a user, I want to see a pie chart of my spending broken down by category, so that I can understand where my money goes at a glance.

#### Acceptance Criteria

1. THE Chart SHALL display a pie chart that represents the proportion of total spending for each Category that has at least one Transaction, where each segment's arc size is proportional to that Category's sum of Transaction amounts divided by the total sum of all Transaction amounts.
2. THE Chart SHALL assign a unique color to each Category slice such that no two adjacent segments share the same color, and each Category maps to a unique color consistently across all renders; user-created categories are assigned a color automatically.
3. WHEN a new Transaction is added, THE Chart SHALL update to reflect the new spending distribution without requiring a page reload, with the updated chart rendered within 500 milliseconds of the Transaction being added.
4. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the new spending distribution without requiring a page reload, with the updated chart rendered within 500 milliseconds of the Transaction being deleted.
5. WHEN the Transaction_List contains no Transactions, THE Chart SHALL display a placeholder state in place of the pie chart that contains a text message indicating there is no spending data to display.
6. THE App SHALL render the Chart using Chart.js loaded via CDN, requiring no local installation or build step.
7. WHEN a user hovers over a pie chart segment, THE Chart SHALL display a tooltip showing the Category name and its percentage of total spending rounded to one decimal place.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my expense history when I close or refresh the tab.

#### Acceptance Criteria

1. WHEN the App is loaded or refreshed, THE App SHALL read all Transactions from Storage and populate the Transaction_List, Balance_Display, and Chart with the persisted data within 500 milliseconds of the page load event.
2. WHEN a Transaction is added or deleted, THE App SHALL write the updated Transaction collection to Storage before any UI element is updated.
3. IF Storage is unavailable or returns a parse error on load, THEN THE App SHALL initialize with an empty Transaction collection and display an informational message indicating that saved data could not be loaded.
4. IF a Storage write operation fails after a Transaction is added or deleted, THEN THE App SHALL display an error message indicating the save failed and THE Transaction_List, Balance_Display, and Chart SHALL NOT reflect the change that failed to persist.
5. THE App SHALL support storing up to 10,000 Transactions in Storage without degradation in load or write performance beyond the bounds specified in Requirement 7.

---

### Requirement 6: Project Structure and Technology Constraints

**User Story:** As a developer, I want the codebase to follow a strict single-file structure for CSS and JavaScript, so that the project stays simple, readable, and easy to maintain.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no JavaScript frameworks or libraries other than Chart.js; no inline `<style>` blocks or `<script>` blocks containing application logic are permitted.
2. THE App SHALL include exactly one CSS file located at `css/style.css`; no other external stylesheets or inline `<style>` blocks shall be referenced.
3. THE App SHALL include exactly one JavaScript application file located at `js/app.js`; the only permitted `<script>` elements in the HTML are one reference to Chart.js via CDN and one reference to `js/app.js`.
4. WHEN the App is opened directly in a file system browser (via a `file://` URL) on the current stable release of Chrome, Firefox, Edge, or Safari, THE App SHALL function fully without a backend server.
5. IF any code path attempts a network request other than loading Chart.js from its CDN URL, THEN that request SHALL be considered a violation of this requirement.

---

### Requirement 7: UI Performance and Visual Design

**User Story:** As a user, I want the interface to load quickly and respond immediately to my actions, so that the app feels snappy and professional.

#### Acceptance Criteria

1. THE App SHALL render the complete initial UI, including any persisted Transactions and the Chart, within 2 seconds on the current stable release of Chrome, Firefox, Edge, or Safari on a desktop device with a viewport width of at least 1024px, without a network connection after initial CDN assets are cached.
2. WHEN the user adds or deletes a Transaction, THE App SHALL update the Transaction_List, Balance_Display, and Chart within 300 milliseconds.
3. THE App SHALL apply typography such that heading text is at least 4px larger than label text, label text is at least 4px larger than data value text, and each of these three text roles uses a distinct font weight, so that headings, labels, and data values are visually distinguishable from one another.
4. THE App SHALL use a responsive layout so that on any screen width from 320px to 1920px, no horizontal scrollbar appears, no UI element is clipped by the viewport edge, and no two distinct UI elements overlap.

---

### Requirement 8: Custom Categories

**User Story:** As a user, I want to create my own spending categories beyond the defaults, so that I can track expenses that don't fit Food, Transport, or Fun.

#### Acceptance Criteria

1. THE Visualizer SHALL provide a dedicated UI control (e.g., an "Add Category" button or inline input) that allows the user to enter a custom category name and add it to the Category selector in the Input_Form.
2. WHEN the user adds a custom category, THE category name SHALL be trimmed of leading and trailing whitespace, SHALL NOT be empty, and SHALL NOT be a case-insensitive duplicate of an existing category; if any condition is violated THE Visualizer SHALL display an inline error and SHALL NOT add the category.
3. WHEN a custom category is added, THE Visualizer SHALL immediately include it as a selectable option in the Category dropdown and SHALL persist the updated category list to Storage so it survives a page reload.
4. THE Visualizer SHALL assign a unique color to each custom category for use in the Spending Chart; colors SHALL be chosen automatically if the user does not specify one.
5. WHEN the Visualizer is loaded, it SHALL restore all custom categories from Storage and make them available in the Category selector and Spending Chart.
6. THE Visualizer SHALL allow the user to delete a custom category only when no stored Transaction uses that category; if any Transaction references the category THE Visualizer SHALL display an error and SHALL NOT delete it.

---

### Requirement 9: Spending Limit Alert

**User Story:** As a user, I want to set a spending limit so that I am visually alerted when my expenses exceed a threshold I define.

#### Acceptance Criteria

1. THE Visualizer SHALL provide a UI control that allows the user to enter a numeric Spending Limit (minimum 0.01, maximum 999999999.99) and associate it with either a specific Category or the overall Total Balance.
2. WHEN the user saves a Spending Limit, THE Visualizer SHALL persist it to Storage so it survives a page reload.
3. WHEN the Total Balance or a Category's total spending meets or exceeds its configured Spending Limit, THE Visualizer SHALL highlight the corresponding Balance Display or Category label with a visually distinct alert style (e.g., red border or background) without requiring a page reload.
4. WHEN a Transaction is added or deleted and spending crosses or drops below a Spending Limit threshold, THE Visualizer SHALL update the alert state within 300 milliseconds.
5. IF no Spending Limit is set, THE Visualizer SHALL display no alert styling.
6. THE Visualizer SHALL allow the user to edit or remove a Spending Limit; upon removal, any active alert styling for that limit SHALL be cleared immediately.

---

### Requirement 10: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between a dark and a light theme, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Visualizer SHALL include a toggle control (button or switch) visible in the header that switches the Theme between Light and Dark modes.
2. WHEN the user activates the toggle, THE Visualizer SHALL apply the new Theme to all UI components — including the Input_Form, Transaction List, Balance Display, Spending Chart background, and any modal/overlay — within 200 milliseconds, without a page reload.
3. THE Visualizer SHALL persist the user's Theme preference to Storage; WHEN the page is reloaded, THE Visualizer SHALL apply the persisted Theme before the first paint to avoid a flash of the wrong theme.
4. IF no Theme preference is persisted, THE Visualizer SHALL default to the Light Theme.
5. THE Dark Theme SHALL use background colors with sufficient contrast so that all text elements meet WCAG 2.1 AA contrast ratio requirements (minimum 4.5:1 for normal text, 3:1 for large text).
6. THE Light Theme SHALL use background colors with sufficient contrast so that all text elements meet WCAG 2.1 AA contrast ratio requirements (minimum 4.5:1 for normal text, 3:1 for large text).
7. THE Visualizer SHALL indicate the current active Theme state in the toggle control (e.g., a sun icon for Light, a moon icon for Dark) so users can identify the current mode at a glance.
