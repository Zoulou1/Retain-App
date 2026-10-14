import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { fail, text, validAmount, validDate, ownedAccount, insertExpense } from './expenses.js';

export function setupMoneyTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
      type TEXT NOT NULL, provider TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
      last_four TEXT NOT NULL DEFAULT '', opening_balance REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0, color TEXT NOT NULL DEFAULT '#8b7cf6',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, direction TEXT NOT NULL,
      account_id TEXT NOT NULL, to_account_id TEXT, amount REAL NOT NULL, fee REAL NOT NULL,
      recipient TEXT NOT NULL, phone TEXT NOT NULL, reference TEXT NOT NULL,
      date TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL,
      fee_expense_id TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(to_account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL,
      category_id TEXT NOT NULL, account_id TEXT, frequency TEXT NOT NULL,
      next_date TEXT NOT NULL, payment_method TEXT NOT NULL, notes TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );
  `);
  const columns = db
    .prepare('PRAGMA table_info(expenses)')
    .all()
    .map((item) => item.name);
  const extraColumns = {
    account_id: 'TEXT REFERENCES accounts(id)',
    merchant: "TEXT DEFAULT ''",
    location: "TEXT DEFAULT ''",
    invoice_number: "TEXT DEFAULT ''",
    receipt_data: "TEXT DEFAULT ''",
    receipt_name: "TEXT DEFAULT ''",
    transfer_id: 'TEXT',
  };
  for (const [name, type] of Object.entries(extraColumns)) {
    if (!columns.includes(name)) db.exec(`ALTER TABLE expenses ADD COLUMN ${name} ${type}`);
  }
}

function phoneNumber(value) {
  const phone = text(value, 30).replace(/[\s()-]/g, '');
  if (phone && !/^\+?\d{7,15}$/.test(phone))
    fail('Enter a valid phone number, including the country code if needed.');
  return phone;
}

function accountValues(body) {
  const name = text(body.name, 100);
  const type = text(body.type, 30);
  const provider = text(body.provider, 100);
  if (!name || !provider) fail('Account name and provider are required.');
  if (!['Card', 'Cash', 'Mobile money', 'Bank', 'Wallet'].includes(type))
    fail('Choose a valid account type.');
  const phone = type === 'Mobile money' ? phoneNumber(body.phone) : '';
  const lastFour = ['Card', 'Bank'].includes(type) ? text(body.lastFour, 4) : '';
  if (type === 'Mobile money' && !phone) fail('A mobile money phone number is required.');
  if ((type === 'Card' || lastFour) && !/^\d{4}$/.test(lastFour))
    fail('Enter only the last four digits, not the full card or bank number.');
  const openingBalance = Number(body.openingBalance);
  if (!Number.isFinite(openingBalance) || Math.abs(openingBalance) > 1000000000000)
    fail('Enter a valid opening balance.');
  const color = text(body.color || '#8b7cf6', 7);
  if (!/^#[0-9a-f]{6}$/i.test(color)) fail('Choose a valid color.');
  return {
    name,
    type,
    provider,
    phone,
    lastFour,
    openingBalance: Math.round(openingBalance * 100) / 100,
    isDefault: body.isDefault ? 1 : 0,
    color,
  };
}

export function accountsForUser(db, userId) {
  return db
    .prepare(
      `SELECT a.id, a.name, a.type, a.provider, a.phone, a.last_four AS lastFour,
      a.opening_balance AS openingBalance, a.is_default AS isDefault, a.color,
      a.opening_balance
      - COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.account_id = a.id AND e.user_id = a.user_id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.account_id = a.id AND t.user_id = a.user_id AND t.status = 'completed' AND t.direction IN ('send', 'internal')), 0)
      + COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.user_id = a.user_id AND t.status = 'completed' AND ((t.direction = 'receive' AND t.account_id = a.id) OR (t.direction = 'internal' AND t.to_account_id = a.id))), 0)
      AS balance
    FROM accounts a WHERE a.user_id = ? ORDER BY a.is_default DESC, a.name`,
    )
    .all(userId);
}

export function billsForUser(db, userId) {
  return db
    .prepare(
      `SELECT b.id, b.title, b.amount, b.category_id AS categoryId,
      c.name AS categoryName, b.account_id AS accountId, a.name AS accountName,
      b.frequency, b.next_date AS nextDate, b.payment_method AS paymentMethod, b.notes
    FROM bills b JOIN categories c ON c.id = b.category_id
    LEFT JOIN accounts a ON a.id = b.account_id
    WHERE b.user_id = ? ORDER BY b.next_date`,
    )
    .all(userId);
}

function advanceDate(value, frequency) {
  const date = new Date(`${value}T12:00:00Z`);
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    if (frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCFullYear(date.getUTCFullYear() + 1);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

export function moneyRoutes(db, auth) {
  const router = Router();
  router.use(auth);
  router.get('/accounts', (req, res) => res.json({ accounts: accountsForUser(db, req.user.id) }));
  router.post('/accounts', (req, res) => {
    const value = accountValues(req.body);
    const id = randomUUID();
    db.transaction(() => {
      if (value.isDefault)
        db.prepare('UPDATE accounts SET is_default = 0 WHERE user_id = ?').run(req.user.id);
      db.prepare(
        `INSERT INTO accounts (id, user_id, name, type, provider, phone, last_four, opening_balance, is_default, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        req.user.id,
        value.name,
        value.type,
        value.provider,
        value.phone,
        value.lastFour,
        value.openingBalance,
        value.isDefault,
        value.color,
      );
    })();
    res
      .status(201)
      .json({ account: accountsForUser(db, req.user.id).find((account) => account.id === id) });
  });
  router.put('/accounts/:id', (req, res) => {
    ownedAccount(db, req.user.id, req.params.id);
    const value = accountValues(req.body);
    db.transaction(() => {
      if (value.isDefault)
        db.prepare('UPDATE accounts SET is_default = 0 WHERE user_id = ?').run(req.user.id);
      db.prepare(
        `UPDATE accounts SET name = ?, type = ?, provider = ?, phone = ?, last_four = ?,
        opening_balance = ?, is_default = ?, color = ? WHERE id = ? AND user_id = ?`,
      ).run(
        value.name,
        value.type,
        value.provider,
        value.phone,
        value.lastFour,
        value.openingBalance,
        value.isDefault,
        value.color,
        req.params.id,
        req.user.id,
      );
    })();
    res.json({ message: 'Payment account updated.' });
  });
  router.delete('/accounts/:id', (req, res) => {
    ownedAccount(db, req.user.id, req.params.id);
    const linked = db
      .prepare(
        `SELECT
      (SELECT COUNT(*) FROM expenses WHERE account_id = ?) +
      (SELECT COUNT(*) FROM transfers WHERE account_id = ? OR to_account_id = ?) +
      (SELECT COUNT(*) FROM bills WHERE account_id = ?) AS count`,
      )
      .get(req.params.id, req.params.id, req.params.id, req.params.id);
    if (linked.count)
      fail('This account has linked records. Remove or reassign them before deleting it.', 409);
    db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Payment account deleted.' });
  });

  const transferList = (userId) =>
    db
      .prepare(
        `SELECT t.id, t.direction, t.account_id AS accountId,
    t.to_account_id AS toAccountId, a.name AS accountName, target.name AS toAccountName,
    t.amount, t.fee, t.recipient, t.phone, t.reference, t.date, t.status, t.notes
    FROM transfers t JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts target ON target.id = t.to_account_id
    WHERE t.user_id = ? ORDER BY t.date DESC, t.created_at DESC`,
      )
      .all(userId);

  function recordFee(transfer) {
    if (!transfer.fee) return null;
    const category = db.prepare("SELECT id FROM categories WHERE name = 'Uncategorized'").get();
    const expense = insertExpense(
      db,
      transfer.user_id,
      {
        title: 'Transfer fee',
        amount: transfer.fee,
        date: transfer.date,
        categoryId: category.id,
        accountId: transfer.account_id,
        paymentMethod: 'Bank transfer',
        notes: `Fee for ${transfer.direction} transfer. Reference: ${transfer.reference || 'none'}`,
      },
      transfer.id,
    );
    return expense.id;
  }

  router.get('/transfers', (req, res) => res.json({ transfers: transferList(req.user.id) }));
  router.post('/transfers', (req, res) => {
    const body = req.body;
    if (!['send', 'receive', 'internal'].includes(body.direction))
      fail('Choose a transfer direction.');
    if (!['pending', 'completed', 'failed'].includes(body.status))
      fail('Choose a valid transfer status.');
    const account = ownedAccount(db, req.user.id, body.accountId);
    if (!account) fail('Choose a payment account.');
    const target =
      body.direction === 'internal' ? ownedAccount(db, req.user.id, body.toAccountId) : null;
    if (body.direction === 'internal' && (!target || target.id === account.id))
      fail('Choose a different destination account.');
    const transfer = {
      id: randomUUID(),
      user_id: req.user.id,
      direction: body.direction,
      account_id: account.id,
      to_account_id: target?.id || null,
      amount: validAmount(body.amount),
      fee: validAmount(body.fee ?? 0, true),
      recipient: text(body.recipient),
      phone: phoneNumber(body.phone),
      reference: text(body.reference, 100),
      date: validDate(body.date),
      status: body.status,
      notes: text(body.notes, 2000),
    };
    db.transaction(() => {
      const expenseId = transfer.status === 'completed' ? recordFee(transfer) : null;
      db.prepare(
        `INSERT INTO transfers (id, user_id, direction, account_id, to_account_id,
        amount, fee, recipient, phone, reference, date, status, notes, fee_expense_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        transfer.id,
        req.user.id,
        transfer.direction,
        transfer.account_id,
        transfer.to_account_id,
        transfer.amount,
        transfer.fee,
        transfer.recipient,
        transfer.phone,
        transfer.reference,
        transfer.date,
        transfer.status,
        transfer.notes,
        expenseId,
        new Date().toISOString(),
      );
    })();
    res
      .status(201)
      .json({ transfer: transferList(req.user.id).find((item) => item.id === transfer.id) });
  });
  router.put('/transfers/:id', (req, res) => {
    const transfer = db
      .prepare('SELECT * FROM transfers WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!transfer) fail('Transfer not found.', 404);
    if (transfer.status !== 'pending')
      fail('Only pending records can be marked completed or failed.', 409);
    if (!['completed', 'failed'].includes(req.body.status)) fail('Choose completed or failed.');
    db.transaction(() => {
      const expenseId = req.body.status === 'completed' ? recordFee(transfer) : null;
      db.prepare(
        'UPDATE transfers SET status = ?, fee_expense_id = ? WHERE id = ? AND user_id = ?',
      ).run(req.body.status, expenseId, transfer.id, req.user.id);
    })();
    res.json({ message: 'Transfer status updated.' });
  });
  router.delete('/transfers/:id', (req, res) => {
    const transfer = db
      .prepare('SELECT * FROM transfers WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!transfer) fail('Transfer not found.', 404);
    db.transaction(() => {
      if (transfer.fee_expense_id)
        db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(
          transfer.fee_expense_id,
          req.user.id,
        );
      db.prepare('DELETE FROM transfers WHERE id = ? AND user_id = ?').run(
        transfer.id,
        req.user.id,
      );
    })();
    res.json({ message: 'Transfer record removed and balance effects reversed.' });
  });

  function billValues(userId, body) {
    const title = text(body.title);
    if (!title) fail('Bill title is required.');
    const amount = validAmount(body.amount);
    const nextDate = validDate(body.nextDate);
    const frequency = text(body.frequency, 20);
    if (!['weekly', 'monthly', 'yearly'].includes(frequency)) fail('Choose a valid frequency.');
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
      fail('Choose a payment method.');
    return {
      title,
      amount,
      nextDate,
      frequency,
      categoryId: body.categoryId,
      accountId: account?.id || null,
      paymentMethod,
      notes: text(body.notes, 2000),
    };
  }
  router.get('/bills', (req, res) => res.json({ bills: billsForUser(db, req.user.id) }));
  router.post('/bills', (req, res) => {
    const value = billValues(req.user.id, req.body);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO bills (id, user_id, title, amount, category_id, account_id, frequency, next_date, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.user.id,
      value.title,
      value.amount,
      value.categoryId,
      value.accountId,
      value.frequency,
      value.nextDate,
      value.paymentMethod,
      value.notes,
    );
    res.status(201).json({ bill: billsForUser(db, req.user.id).find((bill) => bill.id === id) });
  });
  router.put('/bills/:id', (req, res) => {
    const value = billValues(req.user.id, req.body);
    const result = db
      .prepare(
        `UPDATE bills SET title = ?, amount = ?, category_id = ?, account_id = ?,
      frequency = ?, next_date = ?, payment_method = ?, notes = ? WHERE id = ? AND user_id = ?`,
      )
      .run(
        value.title,
        value.amount,
        value.categoryId,
        value.accountId,
        value.frequency,
        value.nextDate,
        value.paymentMethod,
        value.notes,
        req.params.id,
        req.user.id,
      );
    if (!result.changes) fail('Recurring bill not found.', 404);
    res.json({ message: 'Recurring bill updated.' });
  });
  router.delete('/bills/:id', (req, res) => {
    const result = db
      .prepare('DELETE FROM bills WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    if (!result.changes) fail('Recurring bill not found.', 404);
    res.json({ message: 'Recurring bill deleted.' });
  });
  router.post('/bills/:id/record', (req, res) => {
    const bill = db
      .prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!bill) fail('Recurring bill not found.', 404);
    const nextDate = advanceDate(bill.next_date, bill.frequency);
    db.transaction(() => {
      insertExpense(db, req.user.id, {
        title: bill.title,
        amount: bill.amount,
        categoryId: bill.category_id,
        accountId: bill.account_id,
        date: bill.next_date,
        paymentMethod: bill.payment_method,
        notes: bill.notes,
      });
      db.prepare('UPDATE bills SET next_date = ? WHERE id = ? AND user_id = ?').run(
        nextDate,
        bill.id,
        req.user.id,
      );
    })();
    res.json({ message: 'One bill occurrence recorded as an expense.', nextDate });
  });
  return router;
}
