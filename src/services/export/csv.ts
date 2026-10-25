import type { Ledger } from '../../types/finance.ts';
import { calculateReceipt, parseAdjustments } from '../accounting/receipt.ts';
// Prefix spreadsheet formula starters, including after whitespace/control characters.
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function transactionsCsv(data: Ledger): string {
  const account = (id: string | null) =>
    data.accounts.find((a) => a.id === id)?.name ?? '';
  const category = (id: string | null) =>
    data.categories.find((c) => c.id === id)?.name ?? '';
  const names = {
    income: 'Thu',
    expense: 'Chi',
    transfer: 'Chuyển nội bộ',
  };
  const rows: (string | number)[][] = [
    [
      'ID',
      'Loại',
      'Tiêu đề',
      'Số tiền VND',
      'Từ tài khoản',
      'Đến tài khoản',
      'Danh mục',
      'Thời gian UTC',
      'Ghi chú',
      'Tên mục',
      'Số tiền mục VND',
      'Danh mục mục chi',
      'Điều chỉnh (%)',
      'Số tiền phân bổ VND',
    ],
  ];
  for (const t of data.transactions) {
    rows.push([
      t.id,
      names[t.type],
      t.title,
      t.amount,
      account(t.source_account_id),
      account(t.destination_account_id),
      category(t.category_id),
      t.occurred_at,
      t.note,
      '',
      '',
      '',
      '',
      '',
    ]);
    const items = data.items.filter((i) => i.transaction_id === t.id);
    const receipt = items.length
      ? calculateReceipt(items, parseAdjustments(t.adjustments_json))
      : null;
    for (const [index, i] of items.entries())
      rows.push([
        t.id,
        'Mục chi',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        i.name,
        i.amount,
        category(i.category_id),
        '',
        receipt!.itemAmounts[index],
      ]);
    for (const line of receipt?.lines ?? [])
      rows.push([
        t.id,
        'Điều chỉnh',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        line.name,
        line.amount,
        '',
        line.kind === 'fixed' ? '' : line.rate_bps / 100,
        '',
      ]);
  }
  const excluded = new Map(
    data.transactions.map((t) => [t.id, t.exclude_from_balance === 1]),
  );
  return (
    '\uFEFF' +
    rows
      .map((row, index) =>
        [
          ...row,
          index === 0
            ? 'Không tính vào số dư'
            : row[1] === 'Mục chi' || row[1] === 'Điều chỉnh'
              ? ''
              : excluded.get(String(row[0]))
                ? 'Có'
                : 'Không',
        ]
          .map(csvCell)
          .join(','),
      )
      .join('\r\n')
  );
}
