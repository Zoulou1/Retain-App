import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import db from './database.js';
import { setupMoneyTables, moneyRoutes, billsForUser } from './moneyRoutes.js';
import { fail, text, validAmount, expenseValues, insertExpense } from './expenses.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'retain-local-secret';
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '3mb' }));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, color TEXT NOT NULL DEFAULT '#8b7cf6', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL,
    category_id TEXT NOT NULL, date TEXT NOT NULL, payment_method TEXT NOT NULL,
    notes TEXT DEFAULT '', created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, month TEXT NOT NULL, amount REAL NOT NULL,
    UNIQUE(user_id, month), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);
setupMoneyTables(db);
const defaultCategories = [
  ['Food & dining', '#f28c8c'],
  ['Transport', '#6cb6ff'],
  ['Bills', '#f4bd67'],
  ['Shopping', '#a98bff'],
  ['Health', '#63c7b2'],
  ['Entertainment', '#f28bc8'],
  ['Uncategorized', '#9aa1ad'],
];
for (const [name, color] of defaultCategories) {
  db.prepare(
    'INSERT OR IGNORE INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)',
  ).run(randomUUID(), name, color, new Date().toISOString());
}
if (!db.prepare('SELECT id FROM users WHERE email = ?').get('admin@retain.app')) {
  db.prepare(
    'INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    randomUUID(),
    'Retain Admin',
    'admin@retain.app',
    bcrypt.hashSync('admin123', 10),
    'admin',
    new Date().toISOString(),
  );
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}
function createToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '2h' });
}
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please sign in first.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ message: 'Please sign in again.' });
    req.user = publicUser(user);
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access is required.' });
  next();
}
function formatExpense(row, details = false) {
  return {
    id: row.id,
    title: row.title,
    amount: row.amount,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    date: row.date,
    paymentMethod: row.payment_method,
    notes: row.notes,
    accountId: row.account_id,
    accountName: row.account_name || '',
    merchant: row.merchant,
    location: row.location,
    invoiceNumber: row.invoice_number,
    receiptName: row.receipt_name,
    hasReceipt: Boolean(row.receipt_data),
    receiptData: details ? row.receipt_data : '',
    transferId: row.transfer_id,
    createdAt: row.created_at,
  };
}
const expenseSelect = `SELECT e.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
  FROM expenses e JOIN categories c ON c.id = e.category_id LEFT JOIN accounts a ON a.id = e.account_id`;
function monthRange(value) {
  const month = value || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('Choose a valid month.');
  return { month, start: `${month}-01`, end: `${month}-31` };
}
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/auth/signup', (req, res) => {
  const name = text(req.body.name, 100);
  const email = text(req.body.email, 200).toLowerCase();
  const password = req.body.password;
  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 6 ||
    password.length > 72
  ) {
    fail('Enter a name, valid email, and a password of 6–72 characters.');
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    fail('An account with that email already exists.', 409);
  const user = {
    id: randomUUID(),
    name,
    email,
    role: 'user',
    created_at: new Date().toISOString(),
  };
  db.prepare(
    'INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(user.id, name, email, bcrypt.hashSync(password, 10), 'user', user.created_at);
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
});
app.post('/api/auth/signin', (req, res) => {
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(text(req.body.email, 200).toLowerCase());
  if (
    !user ||
    typeof req.body.password !== 'string' ||
    !bcrypt.compareSync(req.body.password, user.password)
  ) {
    fail('Email or password is incorrect.', 401);
  }
  res.json({ token: createToken(user), user: publicUser(user) });
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/categories', auth, (_req, res) => {
  res.json({
    categories: db
      .prepare('SELECT id, name, color, created_at AS createdAt FROM categories ORDER BY name')
      .all(),
  });
});
function categoryValues(body) {
  const name = text(body.name, 100);
  const color = text(body.color || '#8b7cf6', 7);
  if (!name || !/^#[0-9a-f]{6}$/i.test(color)) fail('Enter a category name and valid color.');
  return { name, color };
}
app.post('/api/categories', auth, adminOnly, (req, res) => {
  const value = categoryValues(req.body);
  if (db.prepare('SELECT id FROM categories WHERE lower(name) = lower(?)').get(value.name))
    fail('That category already exists.', 409);
  const category = { id: randomUUID(), ...value, createdAt: new Date().toISOString() };
  db.prepare('INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(
    category.id,
    category.name,
    category.color,
    category.createdAt,
  );
  res.status(201).json({ category });
});
app.put('/api/categories/:id', auth, adminOnly, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) fail('Category not found.', 404);
  if (category.name === 'Uncategorized') fail('The default category cannot be renamed.');
  const value = categoryValues(req.body);
  if (
    db
      .prepare('SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ?')
      .get(value.name, req.params.id)
  )
    fail('That category already exists.', 409);
  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(
    value.name,
    value.color,
    req.params.id,
  );
  res.json({ message: 'Category updated.' });
});
app.delete('/api/categories/:id', auth, adminOnly, (req, res) => {
  const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id);
  if (!category) fail('Category not found.', 404);
  if (category.name === 'Uncategorized') fail('The default category cannot be deleted.');
  const fallback = db.prepare("SELECT id FROM categories WHERE name = 'Uncategorized'").get();
  db.transaction(() => {
    db.prepare('UPDATE expenses SET category_id = ? WHERE category_id = ?').run(
      fallback.id,
      req.params.id,
    );
    db.prepare('UPDATE bills SET category_id = ? WHERE category_id = ?').run(
      fallback.id,
      req.params.id,
    );
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  })();
  res.json({ message: 'Linked expenses and recurring bills moved to Uncategorized.' });
});

app.get('/api/expenses', auth, (req, res) => {
  const {
    search = '',
    category = '',
    paymentMethod = '',
    minDate = '',
    maxDate = '',
    minAmount = '',
    maxAmount = '',
    sortBy = 'date',
    sortOrder = 'desc',
  } = req.query;
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 8)));
  const values = [req.user.id, `%${search}%`, `%${search}%`, `%${search}%`];
  let where = 'e.user_id = ? AND (e.title LIKE ? OR e.notes LIKE ? OR e.merchant LIKE ?)';
  if (category) {
    where += ' AND e.category_id = ?';
    values.push(category);
  }
  if (paymentMethod) {
    where += ' AND (e.payment_method = ? OR e.account_id = ?)';
    values.push(paymentMethod, paymentMethod);
  }
  if (minDate) {
    where += ' AND e.date >= ?';
    values.push(minDate);
  }
  if (maxDate) {
    where += ' AND e.date <= ?';
    values.push(maxDate);
  }
  if (minAmount !== '') {
    where += ' AND e.amount >= ?';
    values.push(validAmount(minAmount, true));
  }
  if (maxAmount !== '') {
    where += ' AND e.amount <= ?';
    values.push(validAmount(maxAmount, true));
  }
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM expenses e WHERE ${where}`)
    .get(...values).count;
  const sort = sortBy === 'amount' ? 'e.amount' : 'e.date';
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const rows = db
    .prepare(
      `${expenseSelect} WHERE ${where} ORDER BY ${sort} ${direction}, e.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, limit, (page - 1) * limit);
  res.json({
    expenses: rows.map((row) => formatExpense(row)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});
app.get('/api/expenses/:id', auth, (req, res) => {
  const row = db
    .prepare(`${expenseSelect} WHERE e.id = ? AND e.user_id = ?`)
    .get(req.params.id, req.user.id);
  if (!row) fail('Expense not found.', 404);
  res.json({ expense: formatExpense(row, true) });
});
app.post('/api/expenses', auth, (req, res) =>
  res.status(201).json({ expense: insertExpense(db, req.user.id, req.body) }),
);
app.put('/api/expenses/:id', auth, (req, res) => {
  const existing = db
    .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) fail('Expense not found.', 404);
  if (existing.transfer_id) fail('Transfer fee records are managed from the Transfers page.', 409);
  const value = expenseValues(db, req.user.id, req.body);
  db.prepare(
    `UPDATE expenses SET title = ?, amount = ?, category_id = ?, date = ?, payment_method = ?,
    notes = ?, account_id = ?, merchant = ?, location = ?, invoice_number = ?, receipt_data = ?, receipt_name = ?
    WHERE id = ? AND user_id = ?`,
  ).run(
    value.title,
    value.amount,
    value.categoryId,
    value.date,
    value.paymentMethod,
    value.notes,
    value.accountId,
    value.merchant,
    value.location,
    value.invoiceNumber,
    value.receiptData,
    value.receiptName,
    req.params.id,
    req.user.id,
  );
  res.json({ message: 'Expense updated.' });
});
app.delete('/api/expenses/:id', auth, (req, res) => {
  const existing = db
    .prepare('SELECT transfer_id FROM expenses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) fail('Expense not found.', 404);
  if (existing.transfer_id) fail('Delete the transfer record to remove its fee.', 409);
  db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Expense deleted.' });
});
app.get('/api/budgets', auth, (req, res) => {
  const { month } = monthRange(req.query.month);
  const amount =
    db.prepare('SELECT amount FROM budgets WHERE user_id = ? AND month = ?').get(req.user.id, month)
      ?.amount || 0;
  res.json({ month, amount });
});
app.put('/api/budgets', auth, (req, res) => {
  const { month } = monthRange(req.body.month);
  const amount = validAmount(req.body.amount, true);
  db.prepare(
    'INSERT INTO budgets (id, user_id, month, amount) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, month) DO UPDATE SET amount = excluded.amount',
  ).run(randomUUID(), req.user.id, month, amount);
  res.json({ month, amount });
});
app.get('/api/dashboard', auth, (req, res) => {
  const { month, start, end } = monthRange(req.query.month);
  const spent = db
    .prepare(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND date BETWEEN ? AND ?',
    )
    .get(req.user.id, start, end).total;
  const highest =
    db
      .prepare(
        'SELECT title, amount FROM expenses WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY amount DESC LIMIT 1',
      )
      .get(req.user.id, start, end) || null;
  const byCategory = db
    .prepare(
      `SELECT c.name, c.color, SUM(e.amount) AS total FROM categories c JOIN expenses e ON e.category_id = c.id
    WHERE e.user_id = ? AND e.date BETWEEN ? AND ? GROUP BY c.id ORDER BY total DESC`,
    )
    .all(req.user.id, start, end);
  const recent = db
    .prepare(
      `${expenseSelect} WHERE e.user_id = ? AND e.date BETWEEN ? AND ? ORDER BY e.date DESC, e.created_at DESC LIMIT 5`,
    )
    .all(req.user.id, start, end)
    .map((row) => formatExpense(row));
  const budget =
    db.prepare('SELECT amount FROM budgets WHERE user_id = ? AND month = ?').get(req.user.id, month)
      ?.amount || 0;
  res.json({
    month,
    spent,
    budget,
    remaining: budget - spent,
    highest,
    byCategory,
    recent,
    bills: billsForUser(db, req.user.id),
  });
});
app.get('/api/admin/insights', auth, adminOnly, (_req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const totals = db
    .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS value FROM expenses')
    .get();
  const currentMonthCount = db
    .prepare('SELECT COUNT(*) AS count FROM expenses WHERE substr(date, 1, 7) = ?')
    .get(new Date().toISOString().slice(0, 7)).count;
  const spendingByCategory = db
    .prepare(
      `SELECT c.name, c.color, COUNT(e.id) AS count, COALESCE(SUM(e.amount), 0) AS total
    FROM categories c LEFT JOIN expenses e ON c.id = e.category_id GROUP BY c.id ORDER BY total DESC`,
    )
    .all();
  const recentExpenses = db
    .prepare(
      `SELECT e.title, e.amount, e.date, u.name AS userName, c.name AS categoryName
    FROM expenses e JOIN users u ON u.id = e.user_id JOIN categories c ON c.id = e.category_id ORDER BY e.created_at DESC LIMIT 6`,
    )
    .all();
  const recentUsers = db
    .prepare(
      'SELECT name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 6',
    )
    .all();
  res.json({
    totalUsers,
    totalExpenses: totals.count,
    totalValue: totals.value,
    currentMonthCount,
    spendingByCategory,
    topCategories: [...spendingByCategory].sort((a, b) => b.count - a.count).slice(0, 5),
    bottomCategories: [...spendingByCategory].sort((a, b) => a.count - b.count).slice(0, 5),
    recentExpenses,
    recentUsers,
  });
});
app.use('/api', moneyRoutes(db, auth));
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status === 500) console.error(error.message);
  res
    .status(status)
    .json({
      message: status === 500 ? 'Could not save this change. Please try again.' : error.message,
    });
});
app.listen(PORT, () => console.log(`Retain API running at http://localhost:${PORT}`));
