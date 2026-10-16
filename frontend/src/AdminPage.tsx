import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { useCurrency } from './CurrencyContext';
import { formatMoney, currencySymbol } from './money';
import type { AdminInsights, Category } from './types';

export default function AdminPage() {
  const { currency } = useCurrency();
  const [data, setData] = useState<AdminInsights | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: '', color: '#8b7cf6' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [insights, result] = await Promise.all([
        api<AdminInsights>('/admin/insights'),
        api<{ categories: Category[] }>('/categories'),
      ]);
      setData(insights);
      setCategories(result.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin data.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(editingId ? `/categories/${editingId}` : '/categories', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setForm({ name: '', color: '#8b7cf6' });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category.');
    } finally {
      setSaving(false);
    }
  }
  async function removeCategory(id: string) {
    if (
      !confirm('Delete this category? Its expenses and recurring bills will move to Uncategorized.')
    )
      return;
    setSaving(true);
    setError('');
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        setEditingId(null);
        setForm({ name: '', color: '#8b7cf6' });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.');
    } finally {
      setSaving(false);
    }
  }
  function categoryRanking(title: string, items: AdminInsights['topCategories']) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>{title}</h2>
        </div>
        {items.map((item) => (
          <div className="admin-line" key={item.name}>
            <span>{item.name}</span>
            <strong>{item.count} records</strong>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Admin dashboard</h1>
          <p className="muted">Platform activity and category management.</p>
        </div>
      </header>
      {error && <div className="error-message">{error}</div>}
      {!data ? (
        <p className="empty">{error ? 'Unable to load insights.' : 'Loading admin dashboard...'}</p>
      ) : (
        <>
          <section className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-top">
                <span>Registered users</span>
                <b>◎</b>
              </div>
              <strong>{data.totalUsers}</strong>
              <small>All account roles</small>
            </div>
            <div className="stat-card green">
              <div className="stat-top">
                <span>Total expenses</span>
                <b>↗</b>
              </div>
              <strong>{data.totalExpenses}</strong>
              <small>{data.currentMonthCount} recorded this month</small>
            </div>
            <div className="stat-card orange">
              <div className="stat-top">
                <span>Value recorded</span>
                <b>{currencySymbol(currency)}</b>
              </div>
              <strong>{formatMoney(data.totalValue, currency)}</strong>
              <small>Across all users</small>
            </div>
          </section>
          <section className="admin-grid">
            <div className="panel">
              <div className="panel-heading">
                <h2>Expense categories</h2>
              </div>
              <form className="inline-form" onSubmit={saveCategory}>
                <input
                  aria-label="Category name"
                  value={form.name}
                  maxLength={100}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder={editingId ? 'Edit category' : 'New category'}
                  required
                />
                <input
                  type="color"
                  aria-label="Category color"
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                />
                <button className="secondary-button" disabled={saving}>
                  {editingId ? 'Save' : 'Add'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingId(null);
                      setForm({ name: '', color: '#8b7cf6' });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </form>
              <div className="admin-category-list">
                {categories.map((category) => (
                  <div key={category.id}>
                    <span className="category-dot" style={{ background: category.color }} />
                    {category.name}
                    <div>
                      <button
                        disabled={saving || category.name === 'Uncategorized'}
                        onClick={() => {
                          setEditingId(category.id);
                          setForm({ name: category.name, color: category.color });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        disabled={saving || category.name === 'Uncategorized'}
                        onClick={() => removeCategory(category.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Spending by category</h2>
              </div>
              <div className="category-list">
                {data.spendingByCategory.map((item) => (
                  <div className="category-row" key={item.name}>
                    <span className="category-dot" style={{ background: item.color }} />
                    <span>
                      {item.name}
                      <small>{item.count} records</small>
                    </span>
                    <strong>{formatMoney(item.total, currency)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="admin-grid">
            {categoryRanking('Top 5 most-used categories', data.topCategories)}
            {categoryRanking('Bottom 5 least-used categories', data.bottomCategories)}
          </section>
          <section className="admin-grid">
            <div className="panel">
              <div className="panel-heading">
                <h2>Recently added expenses</h2>
              </div>
              {data.recentExpenses.length ? (
                data.recentExpenses.map((expense, index) => (
                  <div className="admin-line" key={`${expense.title}-${index}`}>
                    <span>
                      {expense.title}
                      <small>
                        {expense.userName} · {expense.categoryName} · {expense.date}
                      </small>
                    </span>
                    <strong>{formatMoney(expense.amount, currency)}</strong>
                  </div>
                ))
              ) : (
                <p className="empty">No expenses yet.</p>
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Recently registered users</h2>
              </div>
              {data.recentUsers.map((person) => (
                <div className="admin-line" key={person.email}>
                  <span>
                    {person.name}
                    <small>
                      {person.email} · {person.createdAt.slice(0, 10)}
                    </small>
                  </span>
                  <strong className="role-label">{person.role}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
