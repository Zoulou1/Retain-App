export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  date: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  accountId: string | null;
  accountName: string;
  merchant: string;
  location: string;
  invoiceNumber: string;
  receiptName: string;
  hasReceipt: boolean;
  receiptData: string;
  transferId: string | null;
};

export type ExpenseForm = {
  title: string;
  amount: string;
  categoryId: string;
  date: string;
  paymentMethod: string;
  notes: string;
  accountId: string;
  merchant: string;
  location: string;
  invoiceNumber: string;
  receiptName: string;
  receiptData: string;
};

export type DashboardData = {
  month: string;
  spent: number;
  budget: number;
  remaining: number;
  highest: { title: string; amount: number } | null;
  byCategory: { name: string; color: string; total: number }[];
  recent: Expense[];
  bills: import('./money').Bill[];
};

export type AdminInsights = {
  totalUsers: number;
  totalExpenses: number;
  totalValue: number;
  currentMonthCount: number;
  spendingByCategory: { name: string; color: string; count: number; total: number }[];
  topCategories: { name: string; color: string; count: number; total: number }[];
  bottomCategories: { name: string; color: string; count: number; total: number }[];
  recentExpenses: {
    title: string;
    amount: number;
    date: string;
    userName: string;
    categoryName: string;
  }[];
  recentUsers: { name: string; email: string; role: UserRole; createdAt: string }[];
};
