import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'NGN' | 'CAD' | 'AUD' | 'ZAR' | 'RWF';

export const currencyOptions: { code: CurrencyCode; label: string }[] = [
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'NGN', label: 'NGN (₦)' },
  { code: 'CAD', label: 'CAD ($)' },
  { code: 'AUD', label: 'AUD ($)' },
  { code: 'ZAR', label: 'ZAR (R)' },
  { code: 'RWF', label: 'RWF (FRw)' },
];

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('retain_currency') as CurrencyCode | null;
    return currencyOptions.some((item) => item.code === saved) ? saved! : 'GBP';
  });

  useEffect(() => {
    localStorage.setItem('retain_currency', currency);
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('useCurrency must be used inside CurrencyProvider');
  return value;
}
