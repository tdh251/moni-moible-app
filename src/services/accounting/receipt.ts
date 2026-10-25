import type { ReceiptAdjustment } from '../../types/finance.ts';
import { ensure, money, safeAdd } from './money.ts';

export function parseAdjustmentAmount(value: string): number {
  ensure(
    /^[+-]?\d+$/.test(value.trim()),
    'Nhập số tiền VND nguyên, có thể dùng dấu - hoặc +, không dùng dấu phân cách.',
  );
  const amount = Number(value.trim());
  ensure(
    Number.isSafeInteger(amount),
    'Số tiền điều chỉnh vượt giới hạn an toàn.',
  );
  return amount;
}
export function adjustmentLabel(row: ReceiptAdjustment): string {
  return row.kind === 'fixed'
    ? `${row.name} (VND)`
    : `${row.name} (${row.rate_bps > 0 ? '+' : ''}${(row.rate_bps / 100).toLocaleString('vi-VN')}%)`;
}

export function parsePercent(value: string): number {
  const raw = value.trim();
  ensure(
    /^[+-]?\d{1,3}([.,]\d{1,2})?$/.test(raw),
    'Nhập phần trăm từ -100 đến +100, tối đa 2 số thập phân.',
  );
  const [whole, fraction = ''] = raw
    .replace(/^[+-]/, '')
    .replace(',', '.')
    .split('.');
  const result =
    (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) *
    (raw.startsWith('-') ? -1 : 1);
  ensure(
    Math.abs(result) <= 10000,
    'Mỗi điều chỉnh phải nằm trong khoảng -100% đến +100%.',
  );
  return result;
}
export function validateAdjustments(value: unknown): ReceiptAdjustment[] {
  ensure(
    Array.isArray(value) && value.length <= 20,
    'Hóa đơn có tối đa 20 dòng điều chỉnh.',
  );
  const seen = new Set<string>();
  return value.map((row: unknown): ReceiptAdjustment => {
    ensure(
      row !== null && typeof row === 'object' && 'id' in row && 'name' in row,
      'Dòng điều chỉnh không hợp lệ.',
    );
    ensure(
      typeof row.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(row.id) &&
        !seen.has(row.id),
      'ID điều chỉnh trùng hoặc không hợp lệ.',
    );
    ensure(
      typeof row.name === 'string' &&
        row.name.trim().length > 0 &&
        row.name.length <= 100,
      'Nhập tên điều chỉnh từ 1 đến 100 ký tự.',
    );
    seen.add(row.id);
    const kind = 'kind' in row ? row.kind : 'percent';
    ensure(
      kind === 'percent' || kind === 'fixed',
      'Loại điều chỉnh không hợp lệ.',
    );
    if (kind === 'fixed') {
      ensure(
        'amount_vnd' in row &&
          typeof row.amount_vnd === 'number' &&
          Number.isSafeInteger(row.amount_vnd) &&
          !('rate_bps' in row),
        'Số tiền điều chỉnh phải là số nguyên VND hợp lệ, không kèm tỷ lệ %.',
      );
      return {
        id: row.id,
        name: row.name.trim(),
        kind: 'fixed',
        amount_vnd: row.amount_vnd,
      };
    }
    ensure(
      'rate_bps' in row &&
        typeof row.rate_bps === 'number' &&
        Number.isSafeInteger(row.rate_bps) &&
        Math.abs(row.rate_bps) <= 10000 &&
        !('amount_vnd' in row),
      'Phần trăm điều chỉnh không hợp lệ.',
    );
    return {
      id: row.id,
      name: row.name.trim(),
      rate_bps: row.rate_bps,
      ...('kind' in row ? { kind: 'percent' as const } : {}),
    };
  });
}
export function parseAdjustments(raw?: string): ReceiptAdjustment[] {
  if (raw === undefined) return [];
  ensure(
    typeof raw === 'string' && raw.length <= 20000,
    'Dữ liệu điều chỉnh không hợp lệ.',
  );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    ensure(false, 'Dữ liệu điều chỉnh không phải JSON hợp lệ.');
  }
  return validateAdjustments(value);
}
export function calculateReceipt(
  items: readonly { amount: number }[],
  adjustments: ReceiptAdjustment[],
) {
  ensure(items.length > 0, 'Hóa đơn phải có ít nhất một mục chi.');
  const subtotal = items.reduce((sum, item) => {
    money(item.amount);
    return safeAdd(sum, item.amount);
  }, 0);
  const lines = validateAdjustments(adjustments).map((row) => {
    if (row.kind === 'fixed') return { ...row, amount: row.amount_vnd };
    // Integer basis points; round each line to the nearest VND, halves away from zero.
    const absolute = Number(
      (BigInt(subtotal) * BigInt(Math.abs(row.rate_bps)) + 5000n) / 10000n,
    );
    return { ...row, amount: absolute * (row.rate_bps < 0 ? -1 : 1) };
  });
  const total = lines.reduce(
    (sum, line) => safeAdd(sum, line.amount),
    subtotal,
  );
  money(total);
  // Largest-remainder allocation keeps category totals exactly equal to the final bill.
  const shares = items.map((item, index) => {
    const product = BigInt(total) * BigInt(item.amount);
    return {
      index,
      amount: Number(product / BigInt(subtotal)),
      remainder: product % BigInt(subtotal),
    };
  });
  const remainder =
    total - shares.reduce((sum, share) => safeAdd(sum, share.amount), 0);
  const ranked = [...shares].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; i < remainder; i++) ranked[i].amount++;
  return {
    subtotal,
    lines,
    total,
    itemAmounts: shares.map((share) => share.amount),
  };
}
