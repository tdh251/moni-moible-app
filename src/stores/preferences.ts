import { create } from 'zustand';
import type { Filters } from '../types/finance';
export const initialFilters = (): Filters => ({
  period: 'month',
  date: new Date().toISOString(),
  account: '',
  category: '',
  accounts: [],
  categories: [],
  minAmount: undefined,
  maxAmount: undefined,
  type: '',
  search: '',
});
interface Preferences {
  hidden: boolean;
  biometric: boolean;
  historyFilters: Filters;
  reportFilters: Filters;
  setPreferences: (
    value: Partial<Pick<Preferences, 'hidden' | 'biometric'>>,
  ) => void;
  setFilters: (
    key: 'historyFilters' | 'reportFilters',
    value: Partial<Filters>,
  ) => void;
}
export const usePreferences = create<Preferences>((set) => ({
  hidden: false,
  biometric: false,
  historyFilters: initialFilters(),
  reportFilters: initialFilters(),
  setPreferences: (value) => set(value),
  setFilters: (key, value) =>
    set((state) => ({ [key]: { ...state[key], ...value } })),
}));
