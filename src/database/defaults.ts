import type { Category } from '../types/finance.ts';
const expense = [
  ['Ăn uống', 'restaurant-outline'],
  ['Siêu thị', 'basket-outline'],
  ['Gia dụng', 'home-outline'],
  ['Di chuyển', 'bus-outline'],
  ['Mua sắm', 'bag-outline'],
  ['Giải trí', 'game-controller-outline'],
  ['Sức khỏe', 'medkit-outline'],
  ['Hóa đơn', 'receipt-outline'],
  ['Khác', 'ellipsis-horizontal-outline'],
];
const income = [
  ['Lương', 'briefcase-outline'],
  ['Thưởng', 'gift-outline'],
  ['Thu nhập khác', 'wallet-outline'],
];
const colors = [
  '#287D68',
  '#B76553',
  '#729B84',
  '#D4A457',
  '#648DAB',
  '#9B7FA7',
  '#C4868D',
  '#7C9470',
  '#829187',
];
export const defaultCategories: Category[] = [
  ...expense.map(([name, icon], i): Category => ({
    id: `default-expense-${i}`,
    name,
    icon,
    color: colors[i],
    type: 'expense',
    sort_order: i,
    is_archived: 0,
  })),
  ...income.map(([name, icon], i): Category => ({
    id: `default-income-${i}`,
    name,
    icon,
    color: colors[i],
    type: 'income',
    sort_order: i,
    is_archived: 0,
  })),
];
