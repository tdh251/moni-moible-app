import { transactionCategoryTags } from '../categories/tags.ts';
import { categoryPath } from '../categories/hierarchy.ts';
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
  const category = (id: string | null) => categoryPath(data.categories, id);
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
      'Danh mục phân bổ',
      'Điều chỉnh (%)',
      'Số tiền phân bổ VND',
    ],
  ];
  for (const t of data.transactions) {
    const tags = transactionCategoryTags(t);
    rows.push([
      t.id,
      names[t.type],
      t.title,
      t.amount,
      account(t.source_account_id),
      account(t.destination_account_id),
      tags.length ? tags.map(category).join(' | ') : category(t.category_id),
      t.occurred_at,
      t.note,
      '',
      '',
      '',
      '',
      '',
    ]);
    if (tags.length) continue;
    const items = data.items.filter((i) => i.transaction_id === t.id);
    const receipt = items.length
      ? calculateReceipt(items, parseAdjustments(t.adjustments_json))
      : null;
    for (const [index, i] of items.entries())
      rows.push([
        t.id,
        t.category_split === 1 ? 'Phân bổ danh mục' : 'Mục chi',
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
            : row[1] === 'Mục chi' ||
                row[1] === 'Phân bổ danh mục' ||
                row[1] === 'Điều chỉnh'
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
