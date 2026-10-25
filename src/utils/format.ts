import type { Period, TransactionType } from '../types/finance';
export const formatVnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);
export const typeNames: Record<TransactionType, string> = {
  income: 'Thu',
  expense: 'Chi',
  transfer: 'Chuyển nội bộ',
};
export const periodNames: Record<Period, string> = {
  day: 'Ngày',
  month: 'Tháng',
  quarter: 'Quý',
  year: 'Năm',
};
export function periodLabel(date: string, period: Period) {
  const d = new Date(date);
  if (period === 'day') return d.toLocaleDateString('vi-VN');
  if (period === 'year') return `Năm ${d.getFullYear()}`;
  if (period === 'quarter')
    return `Quý ${Math.floor(d.getMonth() / 3) + 1} · ${d.getFullYear()}`;
  return `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`;
}
