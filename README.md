# Retain — Personal Expense & Budget Manager

Retain is a full-stack application for tracking personal expenses and monthly budgets. Users can save payment accounts, record transfers, and keep reminders for recurring bills. Admin users can manage categories and view the platform insights required for the project.

## Technologies

- React, TypeScript, and Vite
- React Context for authentication, roles, and protected routes
- Redux Toolkit for expense search, filters, sorting, and pagination state
- Node.js and Express REST API
- SQLite using sql.js, with database persistence to a local file
- JWT and bcryptjs for authentication

## Features

- Sign up, sign in, and sign out
- Create, view, edit, and delete personal expenses
- Search title, merchant, and notes; filter by category, payment type or saved account, date range, and amount range
- Sort by date or amount and paginate expense records
- Monthly budget, spending totals, remaining balance, highest expense, category spending, and recent expenses
- Saved display currencies: GBP, USD, EUR, NGN, CAD, AUD, ZAR, and RWF
- Saved payment accounts for MTN MoMo, Airtel Money, cards, banks, cash, and digital wallets
- Account nickname, provider, phone number for mobile money, card last four digits, opening balance, default account, and color
- Account balances calculated from opening balances, linked expenses, and completed transfer records
- Record sent, received, and internal transfers, including fees, recipient, phone, reference, date, notes, and status
- Recurring bill reminders with weekly, monthly, or yearly frequency, overdue indicators, and a button to record one occurrence
- Budget notices at 50%, 80%, 100%, and over budget; a large-expense notice when the highest expense is at least 30% of the selected monthly budget
- Expense merchant, location, invoice number, notes, and optional receipt image
- Admin category create, update, and delete; linked expenses and bills move to Uncategorized when a category is deleted
- Admin totals, spending by category, top and bottom five categories by use, recent expenses, and recent users
- Responsive desktop and mobile layout

## What the money features do

This is an **expense tracker, not a payment service**. Recording a transfer does not send or receive real money. No MTN, Airtel, card, or bank account is connected to an external provider.

- Card details are limited to the account label, provider, and last four digits. Do not enter full card numbers, CVVs, passwords, or PINs.
- Balances are manual. A negative credit-card balance represents debt. Editing the opening balance corrects the starting point, not an imported bank balance.
- All numeric records share the selected display denomination. Changing currency changes formatting, **not exchange rates or stored amounts**. Enter amounts consistently in your chosen currency.
- Pending and failed transfers do not affect balances or spending. Completed transfers change balances; their principal is not counted as budget spending. Their fee is recorded as one linked expense. Deleting a transfer removes that fee and reverses the balance effects.
- Transfer-fee expenses are managed from the Transfers page, not edited separately.
- Recurring bills are in-app reminders. Clicking **Record expense** records one occurrence on its due date and advances the next date. It does not charge an account or run while the app is closed. Calendar dates are clamped to the last day of the next period where necessary.
- Receipt images are private to the expense owner. PNG, JPEG, and WebP files up to 1 MB are supported. They are stored in the SQLite file and are loaded through the authenticated expense-details API.

## Local setup

Use Node.js 22 or newer. sql.js does not require Visual Studio or C++ build tools on Windows.

### Backend (first terminal)

From the project root:

```bash
cd backend
npm ci
```

Copy `.env.example` to `.env` if you do not already have one:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Set a long random `JWT_SECRET` in `.env`, then start the API:

```bash
npm run dev
```

### Frontend (second terminal)

From the project root:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. The API runs at <http://localhost:4000/api>.

The backend creates `backend/data/retain.db` and the data folder automatically. Existing databases are upgraded with the new tables and expense fields when the backend starts. Keep this database file if you want to preserve your local records.

## Demo admin

- Email: `admin@retain.app`
- Password: `admin123`

Use sign-up for a regular user account. The demo admin is created automatically for assessment testing; do not use these public credentials for a real financial service.

## Build and check

```bash
# From the project root
npm run build --prefix frontend
node --check backend/src/server.js
```

For a production-build preview while the backend is running:

```bash
npm run preview --prefix frontend
```

## API overview

Protected requests require `Authorization: Bearer <token>`. All account, transfer, bill, expense, and budget endpoints are restricted to the authenticated owner's records. Category write endpoints and insights require the admin role.

| Method         | Endpoint                       | Purpose                                          |
| -------------- | ------------------------------ | ------------------------------------------------ |
| POST           | `/api/auth/signup`             | Create a regular user                            |
| POST           | `/api/auth/signin`             | Sign in and receive a JWT                        |
| GET            | `/api/auth/me`                 | Current user and role                            |
| GET/POST       | `/api/expenses`                | List/filter or create personal expenses          |
| GET/PUT/DELETE | `/api/expenses/:id`            | Read details, update, or delete an owned expense |
| GET/PUT        | `/api/budgets`                 | Read/update a monthly budget                     |
| GET            | `/api/dashboard?month=YYYY-MM` | Monthly dashboard and bill reminders             |
| GET            | `/api/categories`              | Available categories                             |
| POST           | `/api/categories`              | Admin: create a category                         |
| PUT/DELETE     | `/api/categories/:id`          | Admin: update/delete a category                  |
| GET            | `/api/admin/insights`          | Required admin platform summaries                |
| GET/POST       | `/api/accounts`                | List/create saved payment accounts               |
| PUT/DELETE     | `/api/accounts/:id`            | Update/delete an unlinked owned account          |
| GET/POST       | `/api/transfers`               | List/create manual transfer records              |
| PUT            | `/api/transfers/:id`           | Mark a pending record completed or failed        |
| DELETE         | `/api/transfers/:id`           | Delete a record and reverse its effects          |
| GET/POST       | `/api/bills`                   | List/create recurring reminders                  |
| PUT/DELETE     | `/api/bills/:id`               | Update/delete a recurring reminder               |
| POST           | `/api/bills/:id/record`        | Record one bill occurrence as an expense         |

Expense-list query parameters: `search`, `category`, `paymentMethod` (type or saved account ID), `minDate`, `maxDate`, `minAmount`, `maxAmount`, `sortBy` (`date` or `amount`), `sortOrder` (`asc` or `desc`), `page`, and `limit`.

## Manual testing

1. Sign up, choose RWF, and reload. Confirm the currency stays selected and the remaining-budget icon shows FRw.
2. Add MTN MoMo, cash, and card accounts. Store only the card's last four digits and mark a default account.
3. Create an expense with the default account and an optional receipt. Check its details, then edit it and confirm the receipt remains.
4. Check that adding, changing, or deleting a linked expense updates that account's balance.
5. Record a pending internal transfer. Mark it completed and confirm source, destination, and fee change only once. Delete it and confirm reversal.
6. Add a monthly bill, record one occurrence, and check the next due date and expense list.
7. Set budgets that cross the notice thresholds and check upcoming/overdue reminders.
8. Sign in as another regular user and confirm the first user's records are not shown.
9. Sign in as admin, check all required insights, and delete a category linked to a recurring bill.
10. Check the screens at desktop and mobile widths.

## Deployment

Deployment is not completed yet. Add the real frontend URL here after deployment:

**Live URL: pending deployment**

For separate services, set frontend `VITE_API_URL` to the backend URL ending in `/api`. Set backend `FRONTEND_URL` to the frontend origin and use a strong `JWT_SECRET`. The API honors `PORT` and supports `DB_FILE` for the SQLite path.

The backend needs persistent disk storage for the database, including receipts. An ephemeral filesystem loses records on restart or redeployment. Use one API instance with a persistent disk for this file-based database; do not run multiple instances writing independent copies.
