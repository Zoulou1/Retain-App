import { randomUUID } from 'node:crypto';

export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function text(value, max = 200) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max)
    fail(`Text must be no longer than ${max} characters.`);
  return value.trim();
}

export function validAmount(value, allowZero = false) {
  const amount = Number(value);
  if (
    value === '' ||
    value === null ||
    value === undefined ||
    !Number.isFinite(amount) ||
    amount > 1000000000000 ||
    (allowZero ? amount < 0 : amount <= 0)
  ) {
    fail('Enter a valid amount.');
  }
  return Math.round(amount * 100) / 100;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Enter a valid date.');
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    fail('Enter a valid date.');
  return value;
}

export function ownedAccount(db, userId, accountId) {
  if (!accountId) return null;
  const account = db
    .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId);
  if (!account) fail('Payment account not found.', 404);
  return account;
}

export function expenseValues(db, userId, body) {
  const title = text(body.title);
  const amount = validAmount(body.amount);
  const date = validDate(body.date);
  if (!title) fail('Expense title is required.');
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(body.categoryId || ''))
    fail('Choose a valid category.');
  const account = ownedAccount(db, userId, body.accountId);
  const paymentMethod = account
    ? account.type === 'Bank'
      ? 'Bank transfer'
      : account.type
    : text(body.paymentMethod, 30);
  if (
    !['Card', 'Cash', 'Bank transfer', 'Direct debit', 'Mobile money', 'Wallet'].includes(
      paymentMethod,
    )
  )
    fail('Choose a valid payment method.');
  const receiptData = body.receiptData || '';
  if (
    typeof receiptData !== 'string' ||
    (receiptData &&
      (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(receiptData) ||
        receiptData.length > 1400000))
  ) {
    fail('Use a PNG, JPEG, or WebP receipt smaller than 1 MB.');
  }
  return {
    title,
    amount,
    date,
    paymentMethod,
    categoryId: body.categoryId,
    accountId: account?.id || null,
    notes: text(body.notes, 2000),
    merchant: text(body.merchant),
    location: text(body.location),
    invoiceNumber: text(body.invoiceNumber, 100),
    receiptData,
    receiptName: receiptData ? text(body.receiptName, 200) : '',
  };
}

export function insertExpense(db, userId, body, transferId = null) {
  const expense = expenseValues(db, userId, body);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO expenses
    (id, user_id, title, amount, category_id, date, payment_method, notes, created_at,
     account_id, merchant, location, invoice_number, receipt_data, receipt_name, transfer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    expense.title,
    expense.amount,
    expense.categoryId,
    expense.date,
    expense.paymentMethod,
    expense.notes,
    new Date().toISOString(),
    expense.accountId,
    expense.merchant,
    expense.location,
    expense.invoiceNumber,
    expense.receiptData,
    expense.receiptName,
    transferId,
  );
  return { id, ...expense };
}
