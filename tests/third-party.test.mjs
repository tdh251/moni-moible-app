import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FinanceRepository, makeAccount } from '../src/database/repository.ts';
import {
  accountBalances,
  statistics,
  filterTransactions,
} from '../src/services/accounting/ledger.ts';
import {
  thirdPartyBalance,
  thirdPartyBalances,
  thirdPartyTotals,
  thirdPartyCashFlows,
  thirdPartyReportTransactions,
} from '../src/services/third-party.ts';
import { validateBackup } from '../src/services/backup/validation.ts';
import { transactionsCsv } from '../src/services/export/csv.ts';
import {
  filterThirdPartyCases,
  filterThirdPartyEntries,
} from '../src/services/third-party-list.ts';

const instant = '2026-01-10T05:00:00.000Z';
const filters = {
  period: 'year',
  date: instant,
  account: '',
  category: '',
  type: '',
  search: '',
};
let sequence = 0;
const id = () => `third-${++sequence}`;
function connect(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  const connection = {
    getAllAsync: async (sql, ...params) =>
      db
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row })),
    runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    execAsync: async (sql) => {
      db.exec(sql);
    },
  };
  const atomic = async (job) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await job(connection);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return { db, repo: new FinanceRepository(atomic) };
}
async function fixture(t, cash = 5000000, bank = 0, path) {
  const f = connect(path);
  t.after(() => f.db.close());
  await f.repo.initialize();
  await f.repo.onboard([
    makeAccount('cash', 'Tiền mặt', 'cash', cash),
    makeAccount('bank', 'Ngân hàng', 'bank', bank),
  ]);
  return f;
}
function caseRecord(patch = {}) {
  return {
    id: id(),
    title: 'Mua đồ hộ',
    person: 'Minh',
    description: '',
    expected_amount: null,
    started_at: '2026-01-01T00:00:00.000Z',
    due_at: null,
    note: '',
    tag_ids_json: '[]',
    status: 'pending',
    completed_at: null,
    created_at: instant,
    updated_at: instant,
    revision: 0,
    ...patch,
  };
}
async function newCase(repo, patch) {
  const item = caseRecord(patch);
  await repo.saveThirdPartyCase(item);
  return item.id;
}
async function current(repo, caseId) {
  return (await repo.snapshot()).thirdPartyCases.find((c) => c.id === caseId);
}
async function entry(repo, caseId, kind, amount, patch = {}) {
  const personal = kind.startsWith('settlement_');
  const input = {
    id: id(),
    case_id: caseId,
    kind,
    amount,
    account_id: personal ? null : 'cash',
    category_id: personal
      ? `default-${kind === 'settlement_income' ? 'income' : 'expense'}-0`
      : null,
    related_entry_id: null,
    settlement_id: null,
    tag_ids_json: '[]',
    note: '',
    occurred_at: instant,
    created_at: instant,
    updated_at: instant,
    ...patch,
  };
  await repo.saveThirdPartyEntry(
    input,
    false,
    (await current(repo, caseId)).revision,
  );
  return (await repo.snapshot()).thirdPartyEntries.find(
    (e) => e.id === input.id,
  );
}
async function settle(repo, caseId, cash, personal, patch = {}) {
  const balance = thirdPartyBalances(await repo.snapshot()).get(caseId);
  const request = {
    id: id(),
    case_id: caseId,
    cash_amount: cash,
    personal_amount: personal,
    account_id: cash ? 'cash' : null,
    category_id: personal
      ? `default-${balance.difference > 0 ? 'income' : 'expense'}-0`
      : null,
    tag_ids_json: '[]',
    note: '',
    occurred_at: instant,
    complete_case: false,
    ...patch,
  };
  await repo.settleThirdPartyCase(
    request,
    (await current(repo, caseId)).revision,
  );
  return request;
}
async function status(repo, caseId, value) {
  await repo.setThirdPartyStatus(
    caseId,
    value,
    (await current(repo, caseId)).revision,
  );
}
async function verify(repo, caseId, expected) {
  const data = await repo.snapshot();
  const balance = thirdPartyBalances(data).get(caseId);
  const summary = statistics(data, filters);
  assert.equal(accountBalances(data).cash, expected.cash);
  assert.equal(summary.income, expected.income ?? 0);
  assert.equal(summary.expense, expected.expense ?? 0);
  assert.equal(balance.holdingAmount, expected.holding ?? 0);
  assert.equal(balance.receivableAmount, expected.receivable ?? 0);
  assert.equal(
    balance.financialStatus,
    expected.holding
      ? 'holding'
      : expected.receivable
        ? 'receivable'
        : 'balanced',
  );
  assert.equal(
    balance.cashFlowImpact,
    balance.difference + balance.personalIncome - balance.personalExpense,
  );
  return data;
}

const scenarios = [
  [
    '01 nhận trước và thanh toán đủ',
    [
      ['receive', 500000],
      ['payment', 500000],
    ],
    null,
    { cash: 5000000 },
  ],
  [
    '02 ứng trước và thu lại đủ',
    [
      ['payment', 500000],
      ['reimbursement', 500000],
    ],
    null,
    { cash: 5000000 },
  ],
  [
    '03 nhận thiếu rồi thu bù',
    [
      ['receive', 400000],
      ['payment', 450000],
      ['reimbursement', 50000],
    ],
    null,
    { cash: 5000000 },
  ],
  [
    '04 trả lại toàn bộ tiền thừa',
    [
      ['receive', 500000],
      ['payment', 450000],
      ['refund', 50000],
    ],
    null,
    { cash: 5000000 },
  ],
  [
    '05 giữ tiền thừa không cộng số dư hai lần',
    [
      ['receive', 500000],
      ['payment', 450000],
    ],
    [0, 50000],
    { cash: 5050000, income: 50000 },
  ],
  [
    '06 tự chịu không trừ số dư hai lần',
    [
      ['receive', 400000],
      ['payment', 450000],
    ],
    [0, 50000],
    { cash: 4950000, expense: 50000 },
  ],
  [
    '07 trả 70 và giữ 30',
    [
      ['receive', 500000],
      ['payment', 400000],
    ],
    [70000, 30000],
    { cash: 5030000, income: 30000 },
  ],
  [
    '08 thu 70 và tự chịu 30',
    [
      ['receive', 400000],
      ['payment', 500000],
    ],
    [70000, 30000],
    { cash: 4970000, expense: 30000 },
  ],
  [
    '09 quyết toán từng phần',
    [['payment', 500000]],
    [200000, 50000],
    { cash: 4700000, expense: 50000, receivable: 250000 },
  ],
  [
    '10 nhận và thanh toán nhiều lần',
    [
      ['receive', 200000],
      ['receive', 300000],
      ['payment', 150000],
      ['payment', 250000],
    ],
    null,
    { cash: 5100000, holding: 100000 },
  ],
];
for (const [name, rows, settlement, expected] of scenarios)
  test(`third party ${name}`, async (t) => {
    const { repo } = await fixture(t);
    const caseId = await newCase(repo, { expected_amount: 999999 });
    await verify(repo, caseId, { cash: 5000000 });
    for (const [kind, amount] of rows) await entry(repo, caseId, kind, amount);
    if (settlement) await settle(repo, caseId, ...settlement);
    await verify(repo, caseId, expected);
    assert.notEqual((await current(repo, caseId)).status, 'completed');
    if (expected.receivable) {
      await status(repo, caseId, 'fulfilled');
      const before = await repo.snapshot();
      await assert.rejects(status(repo, caseId, 'completed'));
      assert.deepEqual(await repo.snapshot(), before);
    }
  });

test('third party 11 multiple accounts preserve each balance', async (t) => {
  const { repo } = await fixture(t, 1000000, 5000000);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000, { account_id: 'bank' });
  await entry(repo, c, 'payment', 450000);
  await entry(repo, c, 'refund', 50000, { account_id: 'bank' });
  const data = await verify(repo, c, { cash: 550000 });
  assert.deepEqual(accountBalances(data), { cash: 550000, bank: 5450000 });
});
test('third party 12 merchant refund is linked and bounded per payment', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  const original = await entry(repo, c, 'payment', 500000);
  await entry(repo, c, 'payment_refund', 200000, {
    related_entry_id: original.id,
  });
  await entry(repo, c, 'payment_refund', 300000, {
    related_entry_id: original.id,
  });
  const before = await repo.snapshot();
  await assert.rejects(
    entry(repo, c, 'payment_refund', 1, { related_entry_id: original.id }),
  );
  await assert.rejects(
    repo.deleteThirdPartyEntry(original.id, (await current(repo, c)).revision),
  );
  assert.deepEqual(await repo.snapshot(), before);
  await entry(repo, c, 'refund', 500000);
  await verify(repo, c, { cash: 5000000 });
});
test('third party 13 cancelled cases keep unresolved obligations', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  await status(repo, c, 'cancelled');
  const data = await verify(repo, c, { cash: 5500000, holding: 500000 });
  assert.deepEqual(thirdPartyTotals(data), {
    holding: 500000,
    receivable: 0,
    open: 1,
    completed: 0,
  });
  await assert.rejects(
    repo.deleteThirdPartyCase(c, (await current(repo, c)).revision),
  );
  await settle(repo, c, 500000, 0, { complete_case: true });
  await verify(repo, c, { cash: 5000000 });
});
test('third party 14 edits replace old effects and 15 deletes reverse them', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  const paid = await entry(repo, c, 'payment', 450000);
  await repo.saveThirdPartyEntry(
    { ...paid, amount: 400000 },
    true,
    (await current(repo, c)).revision,
  );
  await verify(repo, c, { cash: 5100000, holding: 100000 });
  await repo.deleteThirdPartyEntry(paid.id, (await current(repo, c)).revision);
  await verify(repo, c, { cash: 5500000, holding: 500000 });
});
for (const income of [true, false])
  test(`third party ${income ? '16 income' : '17 expense'} settlement undo preserves cash and reopens financial balance`, async (t) => {
    const { repo } = await fixture(t);
    const c = await newCase(repo);
    await entry(repo, c, 'receive', income ? 500000 : 400000);
    await entry(repo, c, 'payment', 450000);
    await status(repo, c, 'fulfilled');
    const request = await settle(repo, c, 0, 50000, { complete_case: true });
    await assert.rejects(
      repo.undoThirdPartySettlement(
        request.id,
        (await current(repo, c)).revision,
      ),
    );
    await status(repo, c, 'reopen');
    await repo.undoThirdPartySettlement(
      request.id,
      (await current(repo, c)).revision,
    );
    await verify(
      repo,
      c,
      income
        ? { cash: 5050000, holding: 50000 }
        : { cash: 4950000, receivable: 50000 },
    );
    assert.equal((await current(repo, c)).status, 'in_progress');
  });
test('third party 18 excess settlement is atomic and 19 cases never offset one another', async (t) => {
  const { repo } = await fixture(t);
  const a = await newCase(repo),
    b = await newCase(repo);
  await entry(repo, a, 'receive', 300000);
  await entry(repo, b, 'payment', 500000);
  const before = await repo.snapshot();
  await assert.rejects(settle(repo, a, 0, 400000));
  assert.deepEqual(await repo.snapshot(), before);
  assert.deepEqual(thirdPartyTotals(before), {
    holding: 300000,
    receivable: 500000,
    open: 2,
    completed: 0,
  });
});
test('third party 20 report recognition follows settlement date with categories and tags', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  await repo.saveTag({
    id: 'tag-trip',
    name: 'Du lịch',
    color: '#287D68',
    is_archived: 0,
  });
  await entry(repo, c, 'receive', 500000);
  await entry(repo, c, 'payment', 450000);
  await settle(repo, c, 0, 50000, {
    occurred_at: '2026-02-01T05:00:00.000Z',
    tag_ids_json: '["tag-trip"]',
  });
  const data = await verify(repo, c, { cash: 5050000, income: 50000 });
  assert.equal(statistics(data, { ...filters, period: 'month' }).income, 0);
  const feb = {
    ...filters,
    period: 'month',
    date: '2026-02-10T05:00:00.000Z',
    tags: ['tag-trip'],
    category: 'default-income-0',
  };
  const summary = statistics(data, feb);
  assert.equal(summary.income, 50000);
  assert.equal(summary.categories['default-income-0'], 50000);
  assert.deepEqual(summary.tags['tag-trip'], {
    income: 50000,
    expense: 0,
    count: 1,
  });
  assert.equal(filterTransactions(data, feb).length, 1);
  assert.equal(data.transactions.length, 0);
  assert.equal(thirdPartyCashFlows(data).length, 2);
  assert.equal(thirdPartyReportTransactions(data).length, 1);
  const csv = transactionsCsv(data);
  assert.match(csv, /Thu chi hộ/);
  assert.match(csv, /Giữ lại tiền thừa/);
  assert.match(csv, /Du lịch/);
  await repo.deleteTag('tag-trip');
  await repo.deleteCategory('default-income-0');
  const archived = await repo.snapshot();
  assert.equal(
    archived.tags.find((tag) => tag.id === 'tag-trip').is_archived,
    1,
  );
  assert.equal(
    archived.categories.find((category) => category.id === 'default-income-0')
      .is_archived,
    1,
  );
  assert.equal(statistics(archived, feb).income, 50000);
});
test('third party 21 dependent settlement blocks historical edits until undone', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  const received = await entry(repo, c, 'receive', 500000);
  await entry(repo, c, 'payment', 450000);
  const request = await settle(repo, c, 0, 50000);
  const before = await repo.snapshot();
  await assert.rejects(
    repo.saveThirdPartyEntry(
      { ...received, amount: 400000 },
      true,
      (await current(repo, c)).revision,
    ),
  );
  assert.deepEqual(await repo.snapshot(), before);
  await repo.undoThirdPartySettlement(
    request.id,
    (await current(repo, c)).revision,
  );
  await repo.saveThirdPartyEntry(
    { ...received, amount: 400000 },
    true,
    (await current(repo, c)).revision,
  );
  await verify(repo, c, { cash: 4950000, receivable: 50000 });
});
test('third party 22 multi-step settlement failure rolls back cash, reports and journal', async (t) => {
  const { repo, db } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  await entry(repo, c, 'payment', 400000);
  const before = await repo.snapshot();
  db.exec(
    "CREATE TRIGGER settlement_failure BEFORE INSERT ON third_party_entries WHEN NEW.kind='settlement_income' BEGIN SELECT RAISE(ABORT,'simulated disk error'); END",
  );
  await assert.rejects(settle(repo, c, 70000, 30000), /simulated disk error/);
  assert.deepEqual(await repo.snapshot(), before);
});
test('third party 23 duplicate and concurrent commands cannot repeat payments, including after undo', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  const received = await entry(repo, c, 'receive', 500000);
  await repo.saveThirdPartyEntry(received, false, 0);
  const request = await settle(repo, c, 100000, 0);
  const after = await repo.snapshot();
  await Promise.all([
    repo.settleThirdPartyCase(request, 0),
    repo.settleThirdPartyCase(request, 0),
  ]);
  assert.deepEqual(await repo.snapshot(), after);
  await assert.rejects(
    repo.settleThirdPartyCase({ ...request, cash_amount: 200000 }, 0),
  );
  const revision = (await current(repo, c)).revision;
  const commands = [1, 2].map(() => ({
    ...request,
    id: id(),
    cash_amount: 100000,
  }));
  const results = await Promise.allSettled(
    commands.map((command) => repo.settleThirdPartyCase(command, revision)),
  );
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  await repo.undoThirdPartySettlement(
    request.id,
    (await current(repo, c)).revision,
  );
  const undone = await repo.snapshot();
  await repo.settleThirdPartyCase(request, 0);
  assert.deepEqual(await repo.snapshot(), undone);
});
test('third party 24 migration adds empty tables and preserves existing finance and backup compatibility', async (t) => {
  const { repo, db } = await fixture(t);
  await repo.saveTag({
    id: 'old-tag',
    name: 'Dữ liệu cũ',
    color: '#287D68',
    is_archived: 0,
  });
  for (const [type, amount] of [
    ['income', 200000],
    ['expense', 100000],
    ['transfer', 50000],
  ]) {
    await repo.saveTransaction(
      {
        id: id(),
        type,
        title: 'Giao dịch cũ',
        amount,
        source_account_id: type === 'income' ? null : 'cash',
        destination_account_id: type === 'expense' ? null : 'bank',
        category_id: type === 'transfer' ? null : `default-${type}-0`,
        note: '',
        occurred_at: instant,
        created_at: instant,
        updated_at: instant,
        items: [],
        tag_ids_json: '["old-tag"]',
      },
      false,
    );
  }
  await repo.addLoan({
    id: id(),
    lender: 'Người cho vay cũ',
    amount: 100000,
    account_id: 'cash',
    note: '',
    occurred_at: instant,
    created_at: instant,
  });
  await repo.savePurchase({
    id: id(),
    title: 'Mua hộ cũ',
    person: 'Lan',
    amount: 50000,
    account_id: 'cash',
    note: '',
    due_at: null,
    occurred_at: instant,
    created_at: instant,
    updated_at: instant,
  });
  const before = await repo.snapshot();
  const oldBalances = accountBalances(before),
    oldReports = statistics(before, filters);
  const old = await repo.backup();
  old.version = 21;
  delete old.data.thirdPartyCases;
  delete old.data.thirdPartyEntries;
  delete old.data.thirdPartySettlements;
  db.exec(
    'DROP TABLE third_party_entries; DROP TABLE third_party_settlements; DROP TABLE third_party_cases; PRAGMA user_version=21',
  );
  await repo.initialize();
  await repo.initialize();
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 22);
  assert.deepEqual(await repo.snapshot(), before);
  assert.deepEqual(accountBalances(await repo.snapshot()), oldBalances);
  assert.deepEqual(statistics(await repo.snapshot(), filters), oldReports);
  await repo.restore(old);
  assert.deepEqual(await repo.snapshot(), before);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  await entry(repo, c, 'payment', 450000);
  await settle(repo, c, 20000, 30000);
  const backup = await repo.backup();
  const snapshot = await repo.snapshot();
  assert.equal(backup.version, 22);
  assert.throws(() => validateBackup({ ...backup, version: 21 }));
  await repo.restore(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(await repo.snapshot(), snapshot);
  for (const mutate of [
    (b) => (b.data.thirdPartyEntries[0].amount = -1),
    (b) => (b.data.thirdPartyEntries[0].account_id = 'missing'),
    (b) => (b.data.thirdPartyCases[0].status = 'completed'),
    (b) => (b.data.thirdPartySettlements[0].request_json = 'null'),
    (b) => b.data.thirdPartyEntries.pop(),
  ]) {
    const bad = structuredClone(backup);
    mutate(bad);
    await assert.rejects(async () => repo.restore(bad));
    assert.deepEqual(await repo.snapshot(), snapshot);
  }
});

test('third party validates direction, dates, archived accounts, orphan refunds and integer money', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  for (const amount of [0, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(entry(repo, c, 'receive', amount));
  for (const kind of [
    'refund',
    'reimbursement',
    'settlement_income',
    'settlement_expense',
  ])
    await assert.rejects(entry(repo, c, kind, 1));
  await assert.rejects(
    entry(repo, c, 'payment_refund', 1, { related_entry_id: 'missing' }),
  );
  await assert.rejects(
    entry(repo, c, 'receive', 1, { occurred_at: '2025-01-01T00:00:00.000Z' }),
  );
  await repo.archiveAccount('bank', true);
  await assert.rejects(entry(repo, c, 'receive', 1, { account_id: 'bank' }));
  const foreign = await newCase(repo);
  const paid = await entry(repo, foreign, 'payment', 100);
  await assert.rejects(
    entry(repo, c, 'payment_refund', 100, { related_entry_id: paid.id }),
  );
  await verify(repo, c, { cash: 4999900 });
});
test('third party respects chronological wallet balances and rejects overspending or deleting spent funding', async (t) => {
  const { repo } = await fixture(t, 0);
  const c = await newCase(repo);
  const received = await entry(repo, c, 'receive', 500000);
  const paid = await entry(repo, c, 'payment', 450000);
  await assert.rejects(
    repo.deleteThirdPartyEntry(received.id, (await current(repo, c)).revision),
  );
  await assert.rejects(
    repo.saveThirdPartyEntry(
      { ...paid, occurred_at: '2026-01-09T05:00:00.000Z' },
      true,
      (await current(repo, c)).revision,
    ),
  );
  await assert.rejects(entry(repo, c, 'payment', 50001));
  assert.equal(accountBalances(await repo.snapshot()).cash, 50000);
});
test('third party persists through SQLite close/reopen and preserves zero-cash completed cases', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'moni-third-party-'));
  let second;
  t.after(() => {
    second?.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const path = join(dir, 'finance.sqlite');
  const first = connect(path);
  await first.repo.initialize();
  await first.repo.onboard([makeAccount('cash', 'Tiền mặt', 'cash', 5000000)]);
  const c = await newCase(first.repo);
  await status(first.repo, c, 'fulfilled');
  await status(first.repo, c, 'completed');
  const before = await first.repo.snapshot();
  first.db.close();
  second = connect(path);
  await second.repo.initialize();
  assert.deepEqual(await second.repo.snapshot(), before);
  assert.deepEqual(thirdPartyTotals(before), {
    holding: 0,
    receivable: 0,
    open: 0,
    completed: 1,
  });
});

test('third party formula unit: all seven kinds preserve the accounting identity without cross-case netting', () => {
  const rows = [
    ['receive', 500000],
    ['payment', 800000],
    ['payment_refund', 100000],
    ['reimbursement', 100000],
    ['settlement_expense', 100000],
  ];
  const balance = thirdPartyBalance(
    rows.map(([kind, amount]) => ({ kind, amount })),
  );
  assert.equal(balance.difference, 0);
  assert.equal(balance.cashFlowImpact, -100000);
  assert.equal(balance.personalExpense, 100000);
  const income = thirdPartyBalance(
    [
      ['receive', 500000],
      ['payment', 350000],
      ['refund', 50000],
      ['settlement_income', 100000],
    ].map(([kind, amount]) => ({ kind, amount })),
  );
  assert.equal(income.difference, 0);
  assert.equal(income.cashFlowImpact, 100000);
  assert.equal(income.personalIncome, 100000);
});
test('third party standalone personal entries can be edited and removed without changing cash', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  await entry(repo, c, 'payment', 450000);
  const income = await entry(repo, c, 'settlement_income', 50000);
  await verify(repo, c, { cash: 5050000, income: 50000 });
  await repo.saveThirdPartyEntry(
    { ...income, amount: 20000 },
    true,
    (await current(repo, c)).revision,
  );
  await verify(repo, c, { cash: 5050000, income: 20000, holding: 30000 });
  await repo.deleteThirdPartyEntry(
    income.id,
    (await current(repo, c)).revision,
  );
  await verify(repo, c, { cash: 5050000, holding: 50000 });
});
test('third party case metadata is cash-neutral, validates dates and rejects stale changes', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo, { expected_amount: 1000000 });
  const original = await current(repo, c);
  await repo.saveThirdPartyCase(
    { ...original, title: 'Đã đổi tên', expected_amount: 500000 },
    true,
  );
  await assert.rejects(
    repo.saveThirdPartyCase({ ...original, title: 'Dữ liệu cũ' }, true),
  );
  const currentItem = await current(repo, c);
  await assert.rejects(
    repo.saveThirdPartyCase(
      { ...currentItem, due_at: '2025-01-01T00:00:00.000Z' },
      true,
    ),
  );
  await verify(repo, c, { cash: 5000000 });
  await repo.deleteThirdPartyCase(c, currentItem.revision);
  assert.equal((await repo.snapshot()).thirdPartyCases.length, 0);
});
test('third party list and history filters include cancelled debt and respect people, tags and calendar ranges', async (t) => {
  const { repo } = await fixture(t);
  await repo.saveTag({
    id: 'company',
    name: 'Công ty',
    color: '#287D68',
    is_archived: 0,
  });
  const a = await newCase(repo, {
    title: 'Hoàn ứng',
    person: 'Minh',
    tag_ids_json: '["company"]',
  });
  const b = await newCase(repo, {
    title: 'Tiền giữ hộ',
    person: 'Lan',
    started_at: '2026-02-01T00:00:00.000Z',
  });
  await entry(repo, a, 'payment', 100000, {
    account_id: 'cash',
    tag_ids_json: '["company"]',
  });
  await status(repo, a, 'cancelled');
  const data = await repo.snapshot();
  const base = { search: '', person: '', status: '', financial: '' };
  assert.deepEqual(
    filterThirdPartyCases(data, { ...base, financial: 'unresolved' }).map(
      (c) => c.id,
    ),
    [a],
  );
  assert.deepEqual(
    filterThirdPartyCases(data, { ...base, person: 'Lan' }).map((c) => c.id),
    [b],
  );
  assert.deepEqual(
    filterThirdPartyCases(data, {
      ...base,
      search: '  HOÀN ỨNG  ',
      tags: ['company'],
    }).map((c) => c.id),
    [a],
  );
  assert.deepEqual(
    filterThirdPartyCases(data, { ...base, status: 'cancelled' }).map(
      (c) => c.id,
    ),
    [a],
  );
  assert.deepEqual(
    filterThirdPartyCases(data, {
      ...base,
      range: [
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z'),
      ],
    }).map((c) => c.id),
    [b],
  );
  assert.equal(
    filterThirdPartyEntries(data, {
      ...filters,
      search: 'Minh',
      tags: ['company'],
      account: 'cash',
    }).length,
    1,
  );
  assert.equal(
    filterThirdPartyEntries(data, { ...filters, account: 'bank' }).length,
    0,
  );
  assert.equal(
    filterThirdPartyEntries(data, { ...filters, minAmount: 200000 }).length,
    0,
  );
});
test('third party restore errors roll back and explicit reset clears references in dependency order', async (t) => {
  const { repo, db } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  const paid = await entry(repo, c, 'payment', 400000);
  await entry(repo, c, 'payment_refund', 100000, { related_entry_id: paid.id });
  await settle(repo, c, 100000, 100000);
  const backup = await repo.backup();
  const before = await repo.snapshot();
  await repo.restore(backup);
  assert.deepEqual(await repo.snapshot(), before);
  db.exec(
    "CREATE TRIGGER restore_failure BEFORE INSERT ON third_party_entries WHEN NEW.kind='payment' BEGIN SELECT RAISE(ABORT,'simulated restore failure'); END",
  );
  await assert.rejects(repo.restore(backup), /simulated restore failure/);
  assert.deepEqual(await repo.snapshot(), before);
  db.exec('DROP TRIGGER restore_failure');
  await repo.reset();
  const data = await repo.snapshot();
  assert.deepEqual(data.thirdPartyCases, []);
  assert.deepEqual(data.thirdPartyEntries, []);
  assert.deepEqual(data.thirdPartySettlements, []);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
test('third party backup cannot suppress cash or double-count personal reports using unknown flags', async (t) => {
  const { repo } = await fixture(t);
  const c = await newCase(repo);
  await entry(repo, c, 'receive', 500000);
  await entry(repo, c, 'payment', 450000);
  await settle(repo, c, 0, 50000);
  const backup = await repo.backup();
  for (const row of backup.data.thirdPartyEntries)
    Object.assign(row, {
      exclude_from_balance: 1,
      reportImpact: 1000000,
      source_account_id: 'bank',
    });
  await repo.restore(backup);
  await verify(repo, c, { cash: 5050000, income: 50000 });
});
