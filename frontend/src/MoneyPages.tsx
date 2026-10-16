import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api } from './api';
import { useCurrency } from './CurrencyContext';
import { formatMoney, todayDate, type Account, type Bill, type Transfer } from './money';

type Category = { id: string; name: string; color?: string };
type PageProps = { className?: string };

type AccountForm = {
  name: string;
  type: Account['type'];
  provider: string;
  phone: string;
  lastFour: string;
  openingBalance: string;
  isDefault: boolean;
  color: string;
};

type TransferForm = {
  direction: Transfer['direction'];
  accountId: string;
  toAccountId: string;
  amount: string;
  fee: string;
  recipient: string;
  phone: string;
  reference: string;
  date: string;
  status: Transfer['status'];
  notes: string;
};

type BillForm = {
  title: string;
  amount: string;
  categoryId: string;
  accountId: string;
  frequency: Bill['frequency'];
  nextDate: string;
  paymentMethod: string;
  notes: string;
};

const accountTypes: Account['type'][] = ['Card', 'Cash', 'Mobile money', 'Bank', 'Wallet'];
const providers = ['MTN MoMo', 'Airtel Money', 'Visa', 'Mastercard', 'Bank', 'PayPal', 'Other'];
const paymentMethods = ['Bank transfer', 'Direct debit', 'Mobile money', 'Wallet', 'Card', 'Cash'];

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal money-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="money-modal-title"
      >
        <div className="modal-heading">
          <h2 id="money-modal-title">{title}</h2>
          <button className="close" type="button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Message({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </>
  );
}

function maskPhone(phone: string) {
  const compact = phone.replace(/\s/g, '');
  if (!compact) return '—';
  return `•••• ${compact.slice(-4)}`;
}

function accountTypePaymentMethod(type: Account['type']) {
  return type === 'Bank' ? 'Bank transfer' : type;
}

function accountPayload(form: AccountForm) {
  return {
    name: form.name.trim(),
    type: form.type,
    provider: form.provider.trim(),
    phone: form.phone.trim(),
    lastFour: form.lastFour.trim(),
    openingBalance: Number(form.openingBalance || 0),
    isDefault: form.isDefault,
    color: form.color,
  };
}

const emptyAccount = (): AccountForm => ({
  name: '',
  type: 'Cash',
  provider: 'Other',
  phone: '',
  lastFour: '',
  openingBalance: '0',
  isDefault: false,
  color: '#8e80e4',
});

function AccountFormFields({
  form,
  setForm,
}: {
  form: AccountForm;
  setForm: (next: AccountForm) => void;
}) {
  const update = (key: keyof AccountForm, value: string | boolean) =>
    setForm({ ...form, [key]: value });
  return (
    <>
      <div className="form-grid">
        <label>
          Account name
          <input
            required
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label>
          Type
          <select
            value={form.type}
            onChange={(event) => update('type', event.target.value as Account['type'])}
          >
            {accountTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Provider
          <input
            list="account-providers"
            value={form.provider}
            onChange={(event) => update('provider', event.target.value)}
          />
          <datalist id="account-providers">
            {providers.map((provider) => (
              <option key={provider} value={provider} />
            ))}
          </datalist>
        </label>
        <label>
          Phone <span className="optional">(mobile money only)</span>
          <input
            placeholder={form.type === 'Mobile money' ? '+25078xxxxxxx' : 'Optional'}
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Last four <span className="optional">(card only)</span>
          <input
            inputMode="numeric"
            maxLength={4}
            value={form.lastFour}
            onChange={(event) =>
              update('lastFour', event.target.value.replace(/\D/g, '').slice(0, 4))
            }
          />
        </label>
        <label>
          Opening balance <span className="optional">(not current)</span>
          <input
            type="number"
            step="0.01"
            value={form.openingBalance}
            onChange={(event) => update('openingBalance', event.target.value)}
          />
        </label>
      </div>
      <div className="form-grid account-form-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => update('isDefault', event.target.checked)}
          />{' '}
          Default account
        </label>
        <label>
          Color
          <input
            type="color"
            value={form.color}
            onChange={(event) => update('color', event.target.value)}
          />
        </label>
      </div>
    </>
  );
}

export function AccountsPage(_props: PageProps) {
  const { currency } = useCurrency();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyAccount());
  const [editing, setEditing] = useState<Account | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await api<{ accounts: Account[] }>('/accounts');
      setAccounts(data.accounts || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadAccounts();
  }, []);
  const total = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
    [accounts],
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyAccount());
    setError('');
    setSuccess('');
    setModalOpen(true);
  };
  const openEdit = (account: Account) => {
    setEditing(account);
    setModalOpen(true);
    setForm({
      name: account.name,
      type: account.type,
      provider: account.provider,
      phone: account.phone || '',
      lastFour: account.lastFour || '',
      openingBalance: String(account.openingBalance ?? 0),
      isDefault: Boolean(account.isDefault),
      color: account.color || '#8e80e4',
    });
    setError('');
    setSuccess('');
  };
  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (
      form.type === 'Mobile money' &&
      (!/^\+?[\d\s]+$/.test(form.phone.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15)
    ) {
      setError('Mobile money requires a phone number with 7–15 digits.');
      return;
    }
    if (form.type === 'Card' && !/^\d{4}$/.test(form.lastFour)) {
      setError('Cards require exactly four digits for the last four field.');
      return;
    }
    if (!form.name.trim()) {
      setError('Account name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = accountPayload(form);
      if (editing)
        await api(`/accounts/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/accounts', { method: 'POST', body: JSON.stringify(payload) });
      await loadAccounts();
      setSuccess(editing ? 'Account updated.' : 'Account added.');
      setEditing(null);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save account.');
    } finally {
      setSaving(false);
    }
  };
  const deleteAccount = async (account: Account) => {
    if (
      !window.confirm(
        `Delete ${account.name}? This is only possible when it is not linked to expenses, transfers, or bills.`,
      )
    )
      return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api(`/accounts/${account.id}`, { method: 'DELETE' });
      await loadAccounts();
      setSuccess('Account deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page money-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MONEY</p>
          <h1>Accounts</h1>
          <p className="muted">Keep a clear, manual view of where your money sits.</p>
        </div>
        <button className="primary-button" type="button" onClick={openNew}>
          Add account <span>＋</span>
        </button>
      </div>
      <Message error={error} success={success} />
      <div className="stats-grid money-stats">
        <div className="stat-card purple">
          <div className="stat-top">
            <span>Total balance</span>
            <b>Σ</b>
          </div>
          <strong>{formatMoney(total, currency)}</strong>
          <small>Opening balances plus recorded activity</small>
        </div>
        <div className="stat-card green">
          <div className="stat-top">
            <span>Accounts</span>
            <b>{accounts.length}</b>
          </div>
          <strong>{accounts.filter((account) => Boolean(account.isDefault)).length}</strong>
          <small>
            default account
            {accounts.filter((account) => Boolean(account.isDefault)).length === 1 ? '' : 's'}
          </small>
        </div>
      </div>
      <div className="money-note">
        Balances are manual: expenses and transfers change them, but there is no live bank or card
        synchronization. A negative card balance means the amount owed. All values use the selected
        display currency; there is no FX conversion.
      </div>
      {loading ? (
        <div className="panel empty">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="panel empty">
          No accounts yet. Add one to start recording money activity.
        </div>
      ) : (
        <div className="account-grid">
          {accounts.map((account) => (
            <article
              className="panel account-card"
              key={account.id}
              style={{ borderTopColor: account.color || '#8e80e4' }}
            >
              <div className="account-card-top">
                <div>
                  <p className="eyebrow">{account.type}</p>
                  <h2>{account.name}</h2>
                </div>
                {Boolean(account.isDefault) && <span className="status-pill success">Default</span>}
              </div>
              <p className="account-provider">
                {account.provider || 'Other'}{' '}
                {account.phone && <span>· {maskPhone(account.phone)}</span>}
                {account.lastFour && <span> · •••• {account.lastFour}</span>}
              </p>
              <strong
                className={`account-balance ${Number(account.balance) < 0 ? 'negative' : ''}`}
              >
                {formatMoney(Number(account.balance || 0), currency)}
              </strong>
              <div className="row-actions">
                <button type="button" onClick={() => openEdit(account)}>
                  Edit
                </button>
                <button type="button" disabled={saving} onClick={() => void deleteAccount(account)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {modalOpen && (
        <Modal title={editing ? 'Edit account' : 'Add account'} onClose={() => setModalOpen(false)}>
          <Message error={error} />
          <form onSubmit={saveAccount}>
            <AccountFormFields form={form} setForm={setForm} />
            <p className="modal-help">
              Never enter a full card number, CVV, PIN, or other secret credential.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const emptyTransfer = (accountId = ''): TransferForm => ({
  direction: 'send',
  accountId,
  toAccountId: '',
  amount: '',
  fee: '0',
  recipient: '',
  phone: '',
  reference: '',
  date: todayDate(),
  status: 'pending',
  notes: '',
});

function transferLabel(transfer: Transfer) {
  if (transfer.direction === 'internal')
    return `${transfer.accountName} → ${transfer.toAccountName || 'account'}`;
  return transfer.direction === 'send'
    ? `${transfer.accountName} → ${transfer.recipient || 'recipient'}`
    : `${transfer.recipient || 'sender'} → ${transfer.accountName}`;
}

export function TransfersPage(_props: PageProps) {
  const { currency } = useCurrency();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TransferForm>(emptyTransfer());
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [transferData, accountData] = await Promise.all([
        api<{ transfers: Transfer[] }>('/transfers'),
        api<{ accounts: Account[] }>('/accounts'),
      ]);
      setTransfers(transferData.transfers || []);
      setAccounts(accountData.accounts || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load transfers.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const refreshAccounts = async () => {
    const data = await api<{ accounts: Account[] }>('/accounts');
    setAccounts(data.accounts || []);
  };
  const openNew = () => {
    const defaultAccount = accounts.find((account) => Boolean(account.isDefault));
    setForm(emptyTransfer(defaultAccount?.id || accounts[0]?.id || ''));
    setError('');
    setSuccess('');
    setModalOpen(true);
  };
  const saveTransfer = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(form.amount);
    const fee = Number(form.fee || 0);
    if (!form.accountId) {
      setError('Choose a source account.');
      return;
    }
    if (!(amount > 0)) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (fee < 0 || Number.isNaN(fee)) {
      setError('Fee cannot be negative.');
      return;
    }
    if (
      form.direction === 'internal' &&
      (!form.toAccountId || form.toAccountId === form.accountId)
    ) {
      setError('Internal transfers need a distinct target account.');
      return;
    }
    setSaving(true);
    try {
      await api('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          direction: form.direction,
          accountId: form.accountId,
          toAccountId: form.direction === 'internal' ? form.toAccountId : null,
          amount,
          fee,
          recipient: form.recipient.trim(),
          phone: form.phone.trim(),
          reference: form.reference.trim(),
          date: form.date,
          status: form.status,
          notes: form.notes.trim(),
        }),
      });
      await load();
      await refreshAccounts();
      setModalOpen(false);
      setSuccess('Transfer record added. No money was sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record transfer.');
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (transfer: Transfer, status: 'completed' | 'failed') => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api(`/transfers/${transfer.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      await load();
      await refreshAccounts();
      setSuccess(`Transfer marked ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update transfer.');
    } finally {
      setSaving(false);
    }
  };
  const deleteTransfer = async (transfer: Transfer) => {
    if (
      !window.confirm(
        'Delete this transfer record? Completed activity and its fee will be reversed.',
      )
    )
      return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api(`/transfers/${transfer.id}`, { method: 'DELETE' });
      await load();
      await refreshAccounts();
      setSuccess('Transfer deleted and balances refreshed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete transfer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page money-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MONEY</p>
          <h1>Transfers</h1>
          <p className="muted">Record movement manually; this never sends money.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={openNew}
          disabled={!accounts.length}
        >
          Record transfer <span>＋</span>
        </button>
      </div>
      <Message error={error} success={success} />
      <div className="money-note">
        Principal is not a budget expense. A fee becomes an ordinary expense only once a transfer is
        completed, and internal transfers keep the total balance unchanged apart from that fee.
      </div>
      {loading ? (
        <div className="panel empty">Loading transfers…</div>
      ) : transfers.length === 0 ? (
        <div className="panel empty">No transfer records yet.</div>
      ) : (
        <div className="panel transfer-list">
          {transfers.map((transfer) => (
            <article className="transfer-row" key={transfer.id}>
              <div className="transfer-main">
                <div className="transfer-heading">
                  <strong>{transferLabel(transfer)}</strong>
                  <span
                    className={`status-pill ${transfer.status === 'completed' ? 'success' : transfer.status === 'failed' ? 'danger' : 'warning'}`}
                  >
                    {transfer.status}
                  </span>
                </div>
                <span>
                  {transfer.direction} · {transfer.date}
                  {transfer.reference ? ` · Ref ${transfer.reference}` : ''}
                </span>
                <span>
                  {transfer.phone
                    ? `Phone ${maskPhone(transfer.phone)}`
                    : transfer.notes || 'Manual record'}
                </span>
                {transfer.notes && <span>{transfer.notes}</span>}
              </div>
              <div className="transfer-amount">
                <strong>{formatMoney(Number(transfer.amount), currency)}</strong>
                <small>fee {formatMoney(Number(transfer.fee || 0), currency)}</small>
              </div>
              <div className="row-actions">
                {transfer.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(transfer, 'completed')}
                    >
                      Mark completed
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(transfer, 'failed')}
                    >
                      Mark failed
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteTransfer(transfer)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {modalOpen && (
        <Modal title="Record transfer" onClose={() => setModalOpen(false)}>
          <Message error={error} />
          <form onSubmit={saveTransfer}>
            <div className="form-grid">
              <label>
                Direction
                <select
                  value={form.direction}
                  onChange={(event) =>
                    setForm({ ...form, direction: event.target.value as Transfer['direction'] })
                  }
                >
                  <option value="send">Send</option>
                  <option value="receive">Receive</option>
                  <option value="internal">Internal</option>
                </select>
              </label>
              <label>
                {form.direction === 'receive' ? 'Receiving account' : 'Source account'}
                <select
                  required
                  value={form.accountId}
                  onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                >
                  <option value="">Choose account</option>
                  {accounts.map((account) => (
                    <option value={account.id} key={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {form.direction === 'internal' && (
              <label>
                Target account
                <select
                  required
                  value={form.toAccountId}
                  onChange={(event) => setForm({ ...form, toAccountId: event.target.value })}
                >
                  <option value="">Choose target</option>
                  {accounts
                    .filter((account) => account.id !== form.accountId)
                    .map((account) => (
                      <option value={account.id} key={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="form-grid">
              <label>
                Amount
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </label>
              <label>
                Fee
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fee}
                  onChange={(event) => setForm({ ...form, fee: event.target.value })}
                />
              </label>
            </div>
            {form.direction !== 'internal' && (
              <div className="form-grid">
                <label>
                  {form.direction === 'receive' ? 'Sender' : 'Recipient'}{' '}
                  <span className="optional">(optional)</span>
                  <input
                    value={form.recipient}
                    onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                  />
                </label>
                <label>
                  Phone <span className="optional">(optional)</span>
                  <input
                    placeholder="+25078xxxxxxx"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="form-grid">
              <label>
                Date
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as Transfer['status'] })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Reference <span className="optional">(optional)</span>
                <input
                  value={form.reference}
                  onChange={(event) => setForm({ ...form, reference: event.target.value })}
                />
              </label>
              <label>
                Notes <span className="optional">(optional)</span>
                <input
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Record transfer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const emptyBill = (account?: Account): BillForm => ({
  title: '',
  amount: '',
  categoryId: '',
  accountId: account?.id || '',
  frequency: 'monthly',
  nextDate: todayDate(),
  paymentMethod: account ? accountTypePaymentMethod(account.type) : 'Card',
  notes: '',
});

function dueLabel(nextDate: string) {
  const due = new Date(`${nextDate}T00:00:00`);
  const today = new Date(`${todayDate()}T00:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0)
    return {
      text: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`,
      className: 'danger',
    };
  if (days <= 7)
    return {
      text: days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`,
      className: 'warning',
    };
  return null;
}

export function BillsPage(_props: PageProps) {
  const { currency } = useCurrency();
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BillForm>(emptyBill());
  const [editing, setEditing] = useState<Bill | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [billData, categoryData, accountData] = await Promise.all([
        api<{ bills: Bill[] }>('/bills'),
        api<{ categories: Category[] }>('/categories'),
        api<{ accounts: Account[] }>('/accounts'),
      ]);
      setBills(billData.bills || []);
      setCategories(categoryData.categories || []);
      setAccounts(accountData.accounts || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bills.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const openNew = () => {
    const account = accounts.find((item) => Boolean(item.isDefault));
    setEditing(null);
    setForm(emptyBill(account));
    setError('');
    setSuccess('');
    setModalOpen(true);
  };
  const openEdit = (bill: Bill) => {
    setEditing(bill);
    setForm({
      title: bill.title,
      amount: String(bill.amount),
      categoryId: bill.categoryId,
      accountId: bill.accountId || '',
      frequency: bill.frequency,
      nextDate: bill.nextDate,
      paymentMethod: bill.paymentMethod,
      notes: bill.notes || '',
    });
    setError('');
    setSuccess('');
    setModalOpen(true);
  };
  const saveBill = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(form.amount);
    if (!form.title.trim() || !(amount > 0) || !form.categoryId || !form.nextDate) {
      setError('Title, positive amount, category, and next date are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        amount,
        categoryId: form.categoryId,
        accountId: form.accountId || null,
        frequency: form.frequency,
        nextDate: form.nextDate,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim(),
      };
      if (editing)
        await api(`/bills/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/bills', { method: 'POST', body: JSON.stringify(payload) });
      await load();
      setModalOpen(false);
      setSuccess(editing ? 'Bill updated.' : 'Bill added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bill.');
    } finally {
      setSaving(false);
    }
  };
  const deleteBill = async (bill: Bill) => {
    if (!window.confirm(`Delete recurring bill “${bill.title}”?`)) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api(`/bills/${bill.id}`, { method: 'DELETE' });
      await load();
      setSuccess('Bill deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete bill.');
    } finally {
      setSaving(false);
    }
  };
  const recordBill = async (bill: Bill) => {
    if (
      !window.confirm(
        `Record one ${bill.frequency} expense for ${bill.title} dated ${bill.nextDate}? The next date will advance once.`,
      )
    )
      return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api(`/bills/${bill.id}/record`, { method: 'POST', body: JSON.stringify({}) });
      await load();
      setSuccess(`Recorded ${bill.title} for ${bill.nextDate}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record bill expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page money-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MONEY</p>
          <h1>Bills</h1>
          <p className="muted">Simple in-app reminders for recurring expenses.</p>
        </div>
        <button className="primary-button" type="button" onClick={openNew}>
          Add bill <span>＋</span>
        </button>
      </div>
      <Message error={error} success={success} />
      <div className="money-note">
        Bills are manual recurring reminders. Recording an expense does not make a real payment or
        send scheduled emails; use the button once per occurrence.
      </div>
      {loading ? (
        <div className="panel empty">Loading bills…</div>
      ) : bills.length === 0 ? (
        <div className="panel empty">
          No recurring bills yet. Add one to track upcoming expenses.
        </div>
      ) : (
        <div className="panel bill-list">
          {bills.map((bill) => {
            const due = dueLabel(bill.nextDate);
            return (
              <article className="bill-row" key={bill.id}>
                <div className="bill-main">
                  <div className="transfer-heading">
                    <strong>{bill.title}</strong>
                    {due && <span className={`status-pill ${due.className}`}>{due.text}</span>}
                  </div>
                  <span>
                    {bill.categoryName ||
                      categories.find((category) => category.id === bill.categoryId)?.name ||
                      'Category'}{' '}
                    · {bill.frequency} · next {bill.nextDate}
                  </span>
                  <span>
                    {bill.accountName || bill.paymentMethod || 'No saved account'}
                    {bill.notes ? ` · ${bill.notes}` : ''}
                  </span>
                </div>
                <div className="bill-amount">
                  <strong>{formatMoney(Number(bill.amount), currency)}</strong>
                  <small>{bill.paymentMethod}</small>
                </div>
                <div className="row-actions">
                  <button type="button" disabled={saving} onClick={() => void recordBill(bill)}>
                    Record expense
                  </button>
                  <button type="button" disabled={saving} onClick={() => openEdit(bill)}>
                    Edit
                  </button>
                  <button type="button" disabled={saving} onClick={() => void deleteBill(bill)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {modalOpen && (
        <Modal title={editing ? 'Edit bill' : 'Add bill'} onClose={() => setModalOpen(false)}>
          <Message error={error} />
          <form onSubmit={saveBill}>
            <div className="form-grid">
              <label>
                Title
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <label>
                Amount
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Category
                <select
                  required
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Frequency
                <select
                  value={form.frequency}
                  onChange={(event) =>
                    setForm({ ...form, frequency: event.target.value as Bill['frequency'] })
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Next due date
                <input
                  required
                  type="date"
                  value={form.nextDate}
                  onChange={(event) => setForm({ ...form, nextDate: event.target.value })}
                />
              </label>
              <label>
                Saved account <span className="optional">(optional)</span>
                <select
                  value={form.accountId}
                  onChange={(event) => {
                    const accountId = event.target.value;
                    const account = accounts.find((item) => item.id === accountId);
                    setForm({
                      ...form,
                      accountId,
                      paymentMethod: account
                        ? accountTypePaymentMethod(account.type)
                        : form.paymentMethod,
                    });
                  }}
                >
                  <option value="">No account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Payment method
              <select
                value={form.paymentMethod}
                onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}
              >
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label>
              Notes <span className="optional">(optional)</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add bill'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
