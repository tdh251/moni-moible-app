export class FinanceError extends Error {}
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FinanceError(message);
}
export function money(value: number, zero = false): void {
  ensure(
    Number.isSafeInteger(value) && value >= (zero ? 0 : 1),
    'Số tiền phải là số nguyên VND hợp lệ' +
      (zero ? ', từ 0 trở lên.' : ', lớn hơn 0.'),
  );
}
export function parseAmount(value: string, zero = false): number {
  const raw = value.trim();
  ensure(
    /^\d+$/.test(raw),
    'Chỉ nhập chữ số, không dùng dấu âm, dấu chấm hoặc dấu phẩy.',
  );
  const result = Number(raw);
  money(result, zero);
  return result;
}
export function safeAdd(a: number, b: number): number {
  const result = a + b;
  ensure(Number.isSafeInteger(result), 'Tổng số tiền vượt giới hạn an toàn.');
  return result;
}
