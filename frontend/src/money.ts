import type { CurrencyCode } from './CurrencyContext';

export const todayDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function currencySymbol(currency: CurrencyCode) {
  if (currency === 'RWF') return 'FRw';
  return (
    new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value || currency
  );
}

export type Account = {
  id: string;
  name: string;
  type: 'Card' | 'Cash' | 'Mobile money' | 'Bank' | 'Wallet';
  provider: string;
  phone: string;
  lastFour: string;
  openingBalance: number;
  balance: number;
  isDefault: number;
  color: string;
};

export type Transfer = {
  id: string;
  direction: 'send' | 'receive' | 'internal';
  accountId: string;
  toAccountId: string | null;
  accountName: string;
  toAccountName: string | null;
  amount: number;
  fee: number;
  recipient: string;
  phone: string;
  reference: string;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  notes: string;
};

export type Bill = {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  accountId: string | null;
  accountName: string | null;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
  paymentMethod: string;
  notes: string;
};
