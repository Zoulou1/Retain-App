import { Link } from 'react-router-dom';
import { useCurrency } from './CurrencyContext';
import { formatMoney, todayDate } from './money';
import type { DashboardData } from './types';

export default function DashboardAlerts({ data }: { data: DashboardData }) {
  const { currency } = useCurrency();
  const percent = data.budget > 0 ? (data.spent / data.budget) * 100 : 0;
  const today = todayDate();
  const dueSoon = (data.bills || []).filter((bill) => {
    const days =
      (new Date(`${bill.nextDate}T12:00:00Z`).getTime() -
        new Date(`${today}T12:00:00Z`).getTime()) /
      86400000;
    return days <= 7;
  });
  const largeExpense = data.highest && data.budget > 0 && data.highest.amount >= data.budget * 0.3;
  let notice = '';
  if (percent > 100)
    notice = `You are over budget by ${formatMoney(data.spent - data.budget, currency)}.`;
  else if (percent >= 100) notice = 'Your monthly budget is fully spent.';
  else if (percent >= 80)
    notice = 'You have used at least 80% of your budget. Keep an eye on upcoming costs.';
  else if (percent >= 50) notice = 'You have used at least half of your monthly budget.';

  if (!notice && !largeExpense && !dueSoon.length) return null;
  return (
    <section className="panel alert-panel" aria-label="Budget alerts and bill reminders">
      <div className="panel-heading">
        <h2>Check-in reminders</h2>
        <span className="quiet">In-app notices</span>
      </div>
      {notice && (
        <p className={`budget-notice ${percent >= 100 ? 'over' : ''}`} role="status">
          {notice}
        </p>
      )}
      {largeExpense && data.highest && (
        <p className="budget-notice">
          Large expense: {data.highest.title} uses at least 30% of your monthly budget (
          {formatMoney(data.highest.amount, currency)}).
        </p>
      )}
      {dueSoon.slice(0, 4).map((bill) => (
        <div className="bill-reminder" key={bill.id}>
          <span>
            <strong>{bill.title}</strong>
            <small>
              {bill.nextDate < today ? 'Overdue' : 'Due soon'} · {bill.nextDate}
            </small>
          </span>
          <b>{formatMoney(bill.amount, currency)}</b>
        </div>
      ))}
      {dueSoon.length > 0 && (
        <Link className="text-link" to="/app/bills">
          Manage recurring bills →
        </Link>
      )}
    </section>
  );
}
