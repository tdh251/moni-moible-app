import type { Connection } from './repository.ts';
import type { Snapshot } from '../types/finance.ts';
import type {
  ThirdPartyCase,
  ThirdPartyEntry,
  ThirdPartyEntryInput,
  ThirdPartySettlement,
  ThirdPartySettlementRequest,
  ThirdPartyStatus,
} from '../types/third-party.ts';
import {
  ensure,
  safeAdd,
  validateLedger,
} from '../services/accounting/ledger.ts';
import {
  isThirdPartyPersonal,
  previewThirdPartySettlement,
  readThirdPartySettlement,
  settlementRequestKey,
  thirdPartyBalances,
  thirdPartySettlementEntries,
  validateThirdPartyRequest,
} from '../services/third-party.ts';
import { transactionTagIds } from '../services/tags.ts';

export async function insertThirdPartyCase(
  db: Connection,
  item: ThirdPartyCase,
) {
  await db.runAsync(
    'INSERT INTO third_party_cases (id,title,person,description,expected_amount,started_at,due_at,note,tag_ids_json,status,completed_at,created_at,updated_at,revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    item.id,
    item.title,
    item.person,
    item.description,
    item.expected_amount,
    item.started_at,
    item.due_at,
    item.note,
    item.tag_ids_json,
    item.status,
    item.completed_at,
    item.created_at,
    item.updated_at,
    item.revision,
  );
}
export async function insertThirdPartyEntry(
  db: Connection,
  entry: ThirdPartyEntry,
) {
  await db.runAsync(
    'INSERT INTO third_party_entries (id,case_id,kind,amount,account_id,category_id,related_entry_id,settlement_id,tag_ids_json,note,occurred_at,created_at,updated_at,sequence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    entry.id,
    entry.case_id,
    entry.kind,
    entry.amount,
    entry.account_id,
    entry.category_id,
    entry.related_entry_id,
    entry.settlement_id,
    entry.tag_ids_json,
    entry.note,
    entry.occurred_at,
    entry.created_at,
    entry.updated_at,
    entry.sequence,
  );
}
export async function insertThirdPartySettlement(
  db: Connection,
  record: ThirdPartySettlement,
) {
  await db.runAsync(
    'INSERT INTO third_party_settlements (id,case_id,request_json,created_at,undone_at) VALUES (?,?,?,?,?)',
    record.id,
    record.case_id,
    record.request_json,
    record.created_at,
    record.undone_at,
  );
}
function currentCase(
  data: Snapshot,
  id: string,
  revision: number,
  locked = true,
) {
  ensure(data.onboarded, 'Vui lòng thiết lập tài khoản.');
  const item = data.thirdPartyCases?.find((row) => row.id === id);
  ensure(item, 'Hồ sơ thu chi hộ không còn tồn tại.');
  ensure(
    item.revision === revision,
    'Hồ sơ vừa thay đổi. Hãy mở lại màn hình để cập nhật số tiền mới nhất.',
  );
  if (locked)
    ensure(
      item.status !== 'completed',
      'Hãy mở lại hồ sơ đã hoàn tất trước khi chỉnh sửa.',
    );
  return item;
}
function touch(
  item: ThirdPartyCase,
  patch: Partial<ThirdPartyCase> = {},
): ThirdPartyCase {
  return {
    ...item,
    ...patch,
    revision: safeAdd(item.revision, 1),
    updated_at: new Date().toISOString(),
  };
}
async function updateCase(db: Connection, item: ThirdPartyCase) {
  await db.runAsync(
    'UPDATE third_party_cases SET title=?,person=?,description=?,expected_amount=?,started_at=?,due_at=?,note=?,tag_ids_json=?,status=?,completed_at=?,updated_at=?,revision=? WHERE id=?',
    item.title,
    item.person,
    item.description,
    item.expected_amount,
    item.started_at,
    item.due_at,
    item.note,
    item.tag_ids_json,
    item.status,
    item.completed_at,
    item.updated_at,
    item.revision,
    item.id,
  );
}
function withCase(data: Snapshot, item: ThirdPartyCase): Snapshot {
  return {
    ...data,
    thirdPartyCases: [
      ...(data.thirdPartyCases ?? []).filter((row) => row.id !== item.id),
      item,
    ],
  };
}
function activeTags(
  data: Snapshot,
  value: { tag_ids_json: string },
  old?: { tag_ids_json: string },
) {
  const previous = new Set(old ? transactionTagIds(old) : []);
  const tags = new Map((data.tags ?? []).map((tag) => [tag.id, tag]));
  ensure(
    transactionTagIds(value).every((id) => {
      const tag = tags.get(id);
      return tag && (!tag.is_archived || previous.has(id));
    }),
    'Tag đã lưu trữ không thể thêm vào hồ sơ hoặc bút toán mới.',
  );
}
function activeEntryRefs(
  data: Snapshot,
  entry: ThirdPartyEntryInput,
  old?: ThirdPartyEntry,
) {
  activeTags(data, entry, old);
  if (isThirdPartyPersonal(entry.kind)) {
    const category = data.categories.find((c) => c.id === entry.category_id);
    ensure(
      category && (!category.is_archived || old?.category_id === category.id),
      'Chọn danh mục đang hoạt động để quyết toán.',
    );
  } else {
    const account = data.accounts.find((a) => a.id === entry.account_id);
    ensure(
      account && (!account.is_archived || old?.account_id === account.id),
      'Chọn tài khoản đang hoạt động cho dòng tiền thu chi hộ.',
    );
  }
}
function nextSequence(data: Snapshot) {
  return safeAdd(
    (data.thirdPartyEntries ?? []).reduce(
      (max, entry) => Math.max(max, entry.sequence),
      0,
    ),
    1,
  );
}

export async function saveThirdPartyCase(
  db: Connection,
  data: Snapshot,
  input: ThirdPartyCase,
  editing: boolean,
) {
  ensure(data.onboarded, 'Vui lòng thiết lập tài khoản.');
  const old = data.thirdPartyCases?.find((row) => row.id === input.id);
  ensure(editing === !!old, 'Hồ sơ đã thay đổi. Hãy mở lại màn hình.');
  if (old) currentCase(data, old.id, input.revision);
  else
    ensure(
      input.status === 'pending' &&
        input.completed_at === null &&
        input.revision === 0,
      'Hồ sơ mới phải ở trạng thái Mới tạo.',
    );
  activeTags(data, input, old);
  const metadata = {
    title: input.title.trim(),
    person: input.person.trim(),
    description: input.description,
    expected_amount: input.expected_amount,
    started_at: input.started_at,
    due_at: input.due_at,
    note: input.note,
    tag_ids_json: JSON.stringify(transactionTagIds(input)),
  };
  const saved: ThirdPartyCase = old
    ? touch(old, metadata)
    : { ...input, ...metadata };
  validateLedger(withCase(data, saved));
  if (old) await updateCase(db, saved);
  else await insertThirdPartyCase(db, saved);
}

export async function saveThirdPartyEntry(
  db: Connection,
  data: Snapshot,
  input: ThirdPartyEntryInput,
  editing: boolean,
  revision: number,
) {
  const old = data.thirdPartyEntries?.find((row) => row.id === input.id);
  // A repeated create with the same ID is idempotent; conflicting reuse is rejected.
  if (!editing && old) {
    ensure(
      Object.keys(input)
        .filter((key) => key !== 'created_at' && key !== 'updated_at')
        .every(
          (key) =>
            old[key as keyof ThirdPartyEntry] ===
            input[key as keyof ThirdPartyEntryInput],
        ),
      'ID bút toán đã được sử dụng cho dữ liệu khác.',
    );
    return;
  }
  ensure(editing === !!old, 'Bút toán không còn tồn tại.');
  const item = currentCase(data, input.case_id, revision);
  ensure(
    !old || old.case_id === input.case_id,
    'Không thể chuyển bút toán sang hồ sơ khác.',
  );
  ensure(
    input.settlement_id === null && (!old || old.settlement_id === null),
    'Hãy hoàn tác cả lần quyết toán thay vì sửa riêng một phần.',
  );
  activeEntryRefs(data, input, old);
  const saved: ThirdPartyEntry = {
    ...input,
    sequence: old?.sequence ?? nextSequence(data),
    created_at: old?.created_at ?? input.created_at,
    updated_at: new Date().toISOString(),
    tag_ids_json: JSON.stringify(transactionTagIds(input)),
  };
  const changed = touch(item, {
    status: item.status === 'pending' ? 'in_progress' : item.status,
  });
  const next = {
    ...withCase(data, changed),
    thirdPartyEntries: [
      ...(data.thirdPartyEntries ?? []).filter((e) => e.id !== saved.id),
      saved,
    ],
  };
  validateLedger(next);
  if (old)
    await db.runAsync(
      'UPDATE third_party_entries SET kind=?,amount=?,account_id=?,category_id=?,related_entry_id=?,tag_ids_json=?,note=?,occurred_at=?,updated_at=? WHERE id=?',
      saved.kind,
      saved.amount,
      saved.account_id,
      saved.category_id,
      saved.related_entry_id,
      saved.tag_ids_json,
      saved.note,
      saved.occurred_at,
      saved.updated_at,
      saved.id,
    );
  else await insertThirdPartyEntry(db, saved);
  await updateCase(db, changed);
}

export async function setThirdPartyStatus(
  db: Connection,
  data: Snapshot,
  id: string,
  status: ThirdPartyStatus | 'reopen',
  revision: number,
) {
  const item = currentCase(data, id, revision, false);
  let target: ThirdPartyStatus;
  if (status === 'reopen') {
    ensure(
      item.status === 'completed' || item.status === 'cancelled',
      'Chỉ mở lại hồ sơ đã hoàn tất hoặc đã hủy.',
    );
    target = 'in_progress';
  } else {
    ensure(
      item.status !== 'completed',
      'Hãy mở lại hồ sơ trước khi đổi trạng thái.',
    );
    ensure(
      status !== 'pending' &&
        (item.status !== 'cancelled' || status === 'completed'),
      'Hãy mở lại hồ sơ đã hủy trước khi thực hiện tiếp.',
    );
    if (status === 'completed')
      ensure(
        item.status === 'fulfilled' || item.status === 'cancelled',
        'Đánh dấu đã thực hiện hoặc hủy nghiệp vụ trước khi hoàn tất.',
      );
    target = status;
  }
  const saved = touch(item, {
    status: target,
    completed_at: target === 'completed' ? new Date().toISOString() : null,
  });
  validateLedger(withCase(data, saved));
  await updateCase(db, saved);
}

export async function deleteThirdPartyCase(
  db: Connection,
  data: Snapshot,
  id: string,
  revision: number,
) {
  currentCase(data, id, revision, false);
  ensure(
    !data.thirdPartyEntries?.some((e) => e.case_id === id) &&
      !data.thirdPartySettlements?.some((s) => s.case_id === id),
    'Hồ sơ đã có lịch sử tài chính. Hãy hủy nghiệp vụ để giữ nguyên lịch sử và công nợ.',
  );
  await db.runAsync('DELETE FROM third_party_cases WHERE id=?', id);
}
export async function deleteThirdPartyEntry(
  db: Connection,
  data: Snapshot,
  id: string,
  revision: number,
) {
  const entry = data.thirdPartyEntries?.find((e) => e.id === id);
  ensure(entry, 'Bút toán không còn tồn tại.');
  const item = currentCase(data, entry.case_id, revision);
  ensure(
    entry.settlement_id === null,
    'Hãy hoàn tác cả lần quyết toán thay vì xóa riêng một phần.',
  );
  const changed = touch(item);
  validateLedger({
    ...withCase(data, changed),
    thirdPartyEntries: data.thirdPartyEntries?.filter((e) => e.id !== id),
  });
  await db.runAsync('DELETE FROM third_party_entries WHERE id=?', id);
  await updateCase(db, changed);
}

export async function settleThirdPartyCase(
  db: Connection,
  data: Snapshot,
  request: ThirdPartySettlementRequest,
  revision: number,
) {
  validateThirdPartyRequest(request);
  const old = data.thirdPartySettlements?.find((row) => row.id === request.id);
  if (old) {
    ensure(
      settlementRequestKey(readThirdPartySettlement(old)) ===
        settlementRequestKey(request),
      'Mã quyết toán đã được dùng cho nội dung khác.',
    );
    return;
  }
  const item = currentCase(data, request.case_id, revision);
  const balance = thirdPartyBalances(data).get(item.id)!;
  const preview = previewThirdPartySettlement(
    balance.difference,
    request.cash_amount,
    request.personal_amount,
  );
  if (request.complete_case) {
    ensure(
      item.status === 'fulfilled' || item.status === 'cancelled',
      'Đánh dấu công việc đã thực hiện hoặc đã hủy trước khi hoàn tất.',
    );
    ensure(
      preview.difference === 0,
      'Chưa thể hoàn tất vì vẫn còn tiền cần xử lý.',
    );
  }
  const now = new Date().toISOString();
  const record: ThirdPartySettlement = {
    id: request.id,
    case_id: request.case_id,
    request_json: JSON.stringify({
      ...JSON.parse(settlementRequestKey(request)),
      direction: balance.financialStatus,
    }),
    created_at: now,
    undone_at: null,
  };
  const start = nextSequence(data);
  const entries = thirdPartySettlementEntries(record).map((entry, index) => ({
    ...entry,
    sequence: safeAdd(start, index),
  }));
  for (const entry of entries) activeEntryRefs(data, entry);
  const changed = touch(item, {
    status: request.complete_case
      ? 'completed'
      : item.status === 'pending'
        ? 'in_progress'
        : item.status,
    completed_at: request.complete_case ? now : null,
  });
  const next = {
    ...withCase(data, changed),
    thirdPartyEntries: [...(data.thirdPartyEntries ?? []), ...entries],
    thirdPartySettlements: [...(data.thirdPartySettlements ?? []), record],
  };
  validateLedger(next);
  await insertThirdPartySettlement(db, record);
  for (const entry of entries) await insertThirdPartyEntry(db, entry);
  await updateCase(db, changed);
}
export async function undoThirdPartySettlement(
  db: Connection,
  data: Snapshot,
  id: string,
  revision: number,
) {
  const record = data.thirdPartySettlements?.find((row) => row.id === id);
  ensure(record, 'Lần quyết toán không còn tồn tại.');
  if (record.undone_at !== null) return;
  const item = currentCase(data, record.case_id, revision);
  const changed = touch(item);
  const undone = { ...record, undone_at: new Date().toISOString() };
  validateLedger({
    ...withCase(data, changed),
    thirdPartyEntries: data.thirdPartyEntries?.filter(
      (e) => e.settlement_id !== id,
    ),
    thirdPartySettlements: data.thirdPartySettlements?.map((s) =>
      s.id === id ? undone : s,
    ),
  });
  await db.runAsync(
    'DELETE FROM third_party_entries WHERE settlement_id=?',
    id,
  );
  await db.runAsync(
    'UPDATE third_party_settlements SET undone_at=? WHERE id=?',
    undone.undone_at,
    id,
  );
  await updateCase(db, changed);
}
