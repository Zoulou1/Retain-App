import { useEffect, useId, useState, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from './api';
import { useCurrency } from './CurrencyContext';
import { formatMoney, todayDate, type Account } from './money';
import { clearFilters, setFilter, setPage, type FilterState } from './filters';
import type { RootState } from './store';
import type { Category, Expense, ExpenseForm } from './types';

const paymentTypes = ['Card', 'Cash', 'Bank transfer', 'Direct debit', 'Mobile money', 'Wallet'];
function emptyForm(categoryId = '', accountId = ''): ExpenseForm {
  return {
    title: '',
    amount: '',
    categoryId,
    accountId,
    date: todayDate(),
    paymentMethod: 'Card',
    notes: '',
    merchant: '',
    location: '',
    invoiceNumber: '',
    receiptData: '',
    receiptName: '',
  };
}

export function ExpenseRow({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { currency } = useCurrency();
  const [details, setDetails] = useState<Expense | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  async function showDetails() {
    setBusy(true);
    setError('');
    try {
      const data = await api<{ expense: Expense }>(`/expenses/${expense.id}`);
      setDetails(data.expense);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load expense.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="expense-row">
        <div
          className="expense-icon"
          style={{ background: `${expense.categoryColor}25`, color: expense.categoryColor }}
        >
          {expense.title.slice(0, 1).toUpperCase()}
        </div>
        <div className="expense-main">
          <strong>{expense.title}</strong>
          <span>
            {expense.categoryName} · {expense.accountName || expense.paymentMethod}
            {expense.hasReceipt ? ' · Receipt' : ''}
          </span>
        </div>
        <time>{expense.date}</time>
        <strong className="expense-amount">{formatMoney(expense.amount, currency)}</strong>
        <div className="row-actions">
          <button disabled={busy} onClick={showDetails}>
            {busy ? 'Loading...' : 'Details'}
          </button>
          {onEdit && !expense.transferId && <button onClick={onEdit}>Edit</button>}
          {onDelete && !expense.transferId && <button onClick={onDelete}>Delete</button>}
        </div>
      </div>
      {error && <p className="error-message">{error}</p>}
      {details && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="modal-heading">
              <h2 id={titleId}>{details.title}</h2>
              <button className="close" onClick={() => setDetails(null)} aria-label="Close details">
                ×
              </button>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Amount</dt>
                <dd>{formatMoney(details.amount, currency)}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{details.categoryName}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{details.date}</dd>
              </div>
              <div>
                <dt>Payment method</dt>
                <dd>{details.accountName || details.paymentMethod}</dd>
              </div>
              <div>
                <dt>Merchant</dt>
                <dd>{details.merchant || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{details.location || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Invoice number</dt>
                <dd>{details.invoiceNumber || 'Not recorded'}</dd>
              </div>
            </dl>
            {details.notes && <p className="details-notes">{details.notes}</p>}
            {details.transferId && (
              <p className="muted">
                This fee is linked to a transfer. Manage it from the Transfers page.
              </p>
            )}
            {details.receiptData && (
              <div>
                <p className="muted">{details.receiptName}</p>
                <img
                  className="receipt-preview"
                  src={details.receiptData}
                  alt={`Receipt for ${details.title}`}
                />
              </div>
            )}
            <button className="secondary-button" onClick={() => setDetails(null)}>
              Close
            </button>
          </section>
        </div>
      )}
    </>
  );
}

export default function ExpensesPage() {
  const { currency } = useCurrency();
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const titleId = useId();

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ ...filters, page: String(filters.page), limit: '8' });
    Promise.all([
      api<{ categories: Category[] }>('/categories'),
      api<{ accounts: Account[] }>('/accounts'),
      api<{ expenses: Expense[]; pages: number; total: number }>(`/expenses?${query}`),
    ])
      .then(([categoryData, accountData, expenseData]) => {
        if (!active) return;
        setCategories(categoryData.categories);
        setAccounts(accountData.accounts);
        setExpenses(expenseData.expenses);
        setPages(expenseData.pages);
        setTotal(expenseData.total);
        setError('');
        if (filters.page > expenseData.pages) dispatch(setPage(expenseData.pages));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load expenses.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, refresh, dispatch]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm(categories[0]?.id, accounts.find((account) => account.isDefault)?.id));
    setFormError('');
    setShowForm(true);
  }
  async function openEdit(id: string) {
    try {
      const { expense } = await api<{ expense: Expense }>(`/expenses/${id}`);
      setEditingId(id);
      setForm({
        title: expense.title,
        amount: String(expense.amount),
        categoryId: expense.categoryId,
        accountId: expense.accountId || '',
        date: expense.date,
        paymentMethod: expense.paymentMethod,
        notes: expense.notes || '',
        merchant: expense.merchant || '',
        location: expense.location || '',
        invoiceNumber: expense.invoiceNumber || '',
        receiptName: expense.receiptName || '',
        receiptData: expense.receiptData || '',
      });
      setFormError('');
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load expense.');
    }
  }
  async function saveExpense(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api(editingId ? `/expenses/${editingId}` : '/expenses', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setRefresh((value) => value + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  }
  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense? Its amount will be restored to the linked account balance.'))
      return;
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete expense.');
    }
  }
  function change<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    dispatch(setFilter({ key, value }));
  }
  function attachReceipt(file?: File) {
    if (!file) return;
    if (file.size > 1000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFormError('Choose a PNG, JPEG, or WebP receipt smaller than 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((old) => ({ ...old, receiptData: String(reader.result), receiptName: file.name }));
      setFormError('');
    };
    reader.onerror = () => setFormError('Could not read this receipt.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUR RECORDS</p>
          <h1>Expenses</h1>
          <p className="muted">Keep the small things visible.</p>
        </div>
        <button className="primary-button" onClick={openNew} disabled={!categories.length}>
          + Add expense
        </button>
      </header>
      {error && <div className="error-message">{error}</div>}
      <section className="filter-panel expense-filters" aria-label="Expense filters">
        <label className="search-box">
          Search
          <input
            value={filters.search}
            onChange={(event) => change('search', event.target.value)}
            placeholder="Title, merchant, or notes"
          />
        </label>
        <label>
          Category
          <select
            value={filters.category}
            onChange={(event) => change('category', event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment
          <select
            value={filters.paymentMethod}
            onChange={(event) => change('paymentMethod', event.target.value)}
          >
            <option value="">All methods</option>
            {paymentTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From date
          <input
            type="date"
            value={filters.minDate}
            onChange={(event) => change('minDate', event.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={filters.maxDate}
            onChange={(event) => change('maxDate', event.target.value)}
          />
        </label>
        <label>
          Minimum ({currency})
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.minAmount}
            onChange={(event) => change('minAmount', event.target.value)}
          />
        </label>
        <label>
          Maximum ({currency})
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.maxAmount}
            onChange={(event) => change('maxAmount', event.target.value)}
          />
        </label>
        <label>
          Sort
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(event) => {
              const [sortBy, sortOrder] = event.target.value.split('-') as [
                'date' | 'amount',
                'asc' | 'desc',
              ];
              change('sortBy', sortBy);
              change('sortOrder', sortOrder);
            }}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </label>
        <button className="clear-button" onClick={() => dispatch(clearFilters())}>
          Clear
        </button>
      </section>
      <section className="panel expenses-panel">
        <div className="panel-heading">
          <h2>
            {total} expense{total === 1 ? '' : 's'}
          </h2>
          <span className="quiet">
            Page {filters.page} of {pages}
          </span>
        </div>
        {loading ? (
          <p className="empty">Loading expenses...</p>
        ) : expenses.length ? (
          expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onEdit={() => openEdit(expense.id)}
              onDelete={() => deleteExpense(expense.id)}
            />
          ))
        ) : (
          <p className="empty">No expenses match those filters.</p>
        )}
        <div className="pagination">
          <button
            disabled={loading || filters.page <= 1}
            onClick={() => dispatch(setPage(filters.page - 1))}
          >
            ← Previous
          </button>
          <span>
            {filters.page} / {pages}
          </span>
          <button
            disabled={loading || filters.page >= pages}
            onClick={() => dispatch(setPage(filters.page + 1))}
          >
            Next →
          </button>
        </div>
      </section>
      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            !saving && event.target === event.currentTarget && setShowForm(false)
          }
        >
          <form
            className="modal"
            onSubmit={saveExpense}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="modal-heading">
              <h2 id={titleId}>{editingId ? 'Edit expense' : 'Add an expense'}</h2>
              <button
                type="button"
                className="close"
                aria-label="Close form"
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>
            {formError && <div className="error-message">{formError}</div>}
            <label>
              What was it for?
              <input
                maxLength={200}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Amount ({currency})
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  required
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Category
                <select
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  required
                >
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Saved payment account
                <select
                  value={form.accountId}
                  onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                >
                  <option value="">No linked account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!form.accountId && (
              <label>
                Payment method
                <select
                  value={form.paymentMethod}
                  onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}
                >
                  {paymentTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-grid">
              <label>
                Merchant (optional)
                <input
                  maxLength={200}
                  value={form.merchant}
                  onChange={(event) => setForm({ ...form, merchant: event.target.value })}
                />
              </label>
              <label>
                Location (optional)
                <input
                  maxLength={200}
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                />
              </label>
            </div>
            <label>
              Invoice number (optional)
              <input
                maxLength={100}
                value={form.invoiceNumber}
                onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })}
              />
            </label>
            <label>
              Receipt image (optional, max 1 MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => attachReceipt(event.target.files?.[0])}
              />
            </label>
            {form.receiptData && (
              <div>
                <img
                  className="receipt-preview compact"
                  src={form.receiptData}
                  alt="Selected receipt"
                />
                <p className="muted">{form.receiptName}</p>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setForm({ ...form, receiptData: '', receiptName: '' })}
                >
                  Remove receipt
                </button>
              </div>
            )}
            <label>
              Notes (optional)
              <textarea
                maxLength={2000}
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={saving}>
                {saving ? 'Saving...' : 'Save expense'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
