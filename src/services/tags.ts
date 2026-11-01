import type { Tag, Transaction } from '../types/finance.ts';
import { ensure, FinanceError } from './accounting/money.ts';

export const tagNameKey = (name: string) =>
  name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');

export function transactionTagIds(
  transaction: Pick<Transaction, 'tag_ids_json'>,
): string[] {
  const raw = transaction.tag_ids_json;
  if (raw === undefined) return [];
  ensure(
    typeof raw === 'string' && raw.length <= 20000,
    'Danh sách tag không hợp lệ.',
  );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new FinanceError('Danh sách tag không phải JSON hợp lệ.');
  }
  ensure(
    Array.isArray(value) &&
      value.length <= 100 &&
      value.every(
        (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id),
      ) &&
      new Set(value).size === value.length,
    'Tag bị trùng hoặc không hợp lệ.',
  );
  return value;
}

export function validateTags(tags: Tag[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const tag of tags) {
    const key = typeof tag.name === 'string' ? tagNameKey(tag.name) : '';
    ensure(
      typeof tag.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(tag.id) &&
        !['__proto__', 'constructor', 'prototype'].includes(tag.id) &&
        !ids.has(tag.id) &&
        key.length > 0 &&
        tag.name.length <= 50 &&
        !names.has(key) &&
        typeof tag.color === 'string' &&
        /^#[0-9a-fA-F]{6}$/.test(tag.color) &&
        (tag.is_archived === 0 || tag.is_archived === 1),
      'Tag không hợp lệ hoặc tên tag đã tồn tại. Tên tag tối đa 50 ký tự.',
    );
    ids.add(tag.id);
    names.add(key);
  }
}
