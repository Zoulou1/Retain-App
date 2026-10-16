import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './AuthContext';
import { currencyOptions, useCurrency, type CurrencyCode } from './CurrencyContext';
import type { DashboardData } from './types';
import ExpensesPage, { ExpenseRow } from './ExpensesPage';
import { AccountsPage, TransfersPage, BillsPage } from './MoneyPages';
import DashboardAlerts from './DashboardAlerts';
import AdminPage from './AdminPage';
import { formatMoney as money, currencySymbol, todayDate } from './money';

const today = todayDate();
const thisMonth = today.slice(0, 7);

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading Retain...</div>;
  return user ? <Outlet /> : <Navigate to="/signin" replace />;
}
function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/app" replace />;
}

function AppLayout() {
  const { user, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/app" className="brand">
          <span className="brand-mark">R</span>
          <span>retain</span>
        </Link>
        <div className="profile-mini">
          <div className="avatar">{user?.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.role === 'admin' ? 'Administrator' : 'Personal account'}</small>
          </div>
        </div>
        <label className="currency-control">
          Display currency
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
          >
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <small>Display only — no conversion</small>
        </label>
        <nav className="main-nav">
          <NavLink to="/app" end>
            Overview <span>⌂</span>
          </NavLink>
          <NavLink to="/app/expenses">
            Expenses <span>↗</span>
          </NavLink>
          <NavLink to="/app/accounts">
            Payment accounts <span>◎</span>
          </NavLink>
          <NavLink to="/app/transfers">
            Transfers <span>⇄</span>
          </NavLink>
          <NavLink to="/app/bills">
            Recurring bills <span>↻</span>
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/app/admin">
              Admin dashboard <span>⚙</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip">
            <span>✦</span>
            <strong>Small habits add up</strong>
            <p>Check your spending every few days to stay on track.</p>
          </div>
          <button
            className="logout"
            onClick={() => {
              signOut();
              navigate('/signin');
            }}
          >
            Sign out <span>→</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      mode === 'signin' ? await signIn(email, password) : await signUp(name, email, password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-decoration">
        <Link to="/signin" className="brand light">
          <span className="brand-mark">R</span>
          <span>retain</span>
        </Link>
        <div className="quote">
          <p>“A clearer view of your money starts with one small entry.”</p>
          <span>— Your future self</span>
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>
      <div className="auth-card">
        <div className="mobile-brand">
          <span className="brand-mark">R</span> retain
        </div>
        <div className="eyebrow">WELCOME BACK</div>
        <h1>{mode === 'signin' ? 'Your money, in focus.' : 'Start your clearer money story.'}</h1>
        <p className="auth-subtitle">
          {mode === 'signin'
            ? 'Sign in to see where your money is going.'
            : 'Create an account and make your monthly plan feel simple.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              minLength={mode === 'signup' ? 6 : undefined}
              required
            />
          </label>
          {error && <div className="error-message">{error}</div>}
          <button className="primary-button full" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}{' '}
            <span>→</span>
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'signin' ? 'New to Retain?' : 'Already have an account?'}{' '}
          <Link to={mode === 'signin' ? '/signup' : '/signin'}>
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
        {mode === 'signin' && <p className="demo-note">Demo admin: admin@retain.app / admin123</p>}
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function DashboardPage() {
  const { currency } = useCurrency();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [budgetValue, setBudgetValue] = useState('');
  const [error, setError] = useState('');
  async function load() {
    try {
      const result = await api<DashboardData>(`/dashboard?month=${month}`);
      setData(result);
      setBudgetValue(String(result.budget || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard.');
    }
  }
  useEffect(() => {
    load();
  }, [month]);
  async function saveBudget(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/budgets', {
        method: 'PUT',
        body: JSON.stringify({ month, amount: Number(budgetValue) }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget.');
    }
  }
  if (!data)
    return (
      <div className="page">
        {error ? (
          <div className="error-message">{error}</div>
        ) : (
          <p className="empty">Loading your dashboard...</p>
        )}
      </div>
    );
  const budgetPercent = data.budget ? Math.min(100, (data.spent / data.budget) * 100) : 0;
  const status =
    data.budget === 0
      ? 'Set a budget'
      : data.remaining < 0
        ? 'Over budget'
        : budgetPercent >= 80
          ? 'Approaching limit'
          : 'Within budget';
  return (
    <div className="page">
      <Header
        title="Good to see you."
        subtitle="Here is your money snapshot for the month."
        action={
          <label className="month-picker">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        }
      />
      {error && <div className="error-message">{error}</div>}
      <section className="stats-grid">
        <StatCard
          label="Spent this month"
          value={money(data.spent, currency)}
          note={status}
          tone={data.remaining < 0 ? 'red' : 'purple'}
          icon="↗"
        />
        <StatCard
          label="Remaining budget"
          value={data.budget ? money(data.remaining, currency) : 'Not set'}
          note={
            data.budget ? `${Math.round(budgetPercent)}% of budget used` : 'Choose a limit below'
          }
          tone={data.remaining < 0 ? 'red' : 'green'}
          icon={currencySymbol(currency)}
        />
        <StatCard
          label="Biggest expense"
          value={data.highest ? money(data.highest.amount, currency) : '—'}
          note={data.highest?.title || 'No expenses yet'}
          tone="orange"
          icon="↑"
        />
      </section>
      <DashboardAlerts data={data} />
      <section className="dashboard-grid">
        <div className="panel budget-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">MONTHLY PLAN</p>
              <h2>Budget check-in</h2>
            </div>
            <span
              className={`status-pill ${data.remaining < 0 ? 'danger' : budgetPercent >= 80 ? 'warning' : 'success'}`}
            >
              {status}
            </span>
          </div>
          <div className="budget-number">
            <strong>{data.budget ? money(data.spent, currency) : money(0, currency)}</strong>
            <span>of {money(data.budget, currency)}</span>
          </div>
          <div className="progress">
            <span style={{ width: `${budgetPercent}%` }} />
          </div>
          <form className="budget-form" onSubmit={saveBudget}>
            <label>
              Monthly budget ({currency})
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetValue}
                onChange={(e) => setBudgetValue(e.target.value)}
                placeholder="1500"
              />
            </label>
            <button className="secondary-button">Save budget</button>
          </form>
        </div>
        <div className="panel category-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SPENDING MIX</p>
              <h2>By category</h2>
            </div>
            <span className="quiet">{month}</span>
          </div>
          {data.byCategory.length ? (
            <div className="category-list">
              {data.byCategory.map((item) => (
                <div className="category-row" key={item.name}>
                  <span className="category-dot" style={{ background: item.color }} />
                  <span>{item.name}</span>
                  <strong>{money(item.total, currency)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No category spending yet." />
          )}
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ACTIVITY</p>
            <h2>Recent expenses</h2>
          </div>
          <Link to="/app/expenses" className="text-link">
            View all →
          </Link>
        </div>
        {data.recent.length ? (
          <div className="expense-table">
            {data.recent.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} />
            ))}
          </div>
        ) : (
          <Empty text="Add your first expense to start seeing your story." />
        )}
      </section>
    </div>
  );
}
function StatCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
  icon: string;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <b>{icon}</b>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<AuthPage mode="signin" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="bills" element={<BillsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
