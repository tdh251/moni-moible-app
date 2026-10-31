import { transactionCategoryTags } from '../../services/categories/tags';
import { TransactionCategoriesPicker } from './TransactionCategoriesPicker';
import {
  prepareTransactionCategories,
  type CategoryAllocationDraft,
} from '../../services/accounting/split';
import { useState } from 'react';
import { Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AccountPicker,
  Amount,
  AmountInput,
  AppCard,
  Choices,
  ConfirmationDialog,
  Field,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance, showError } from '../../hooks/finance';
import { BalanceExclusionCheckbox } from './BalanceExclusionCheckbox';
import { TransactionCategoryPicker } from '../categories/TransactionCategoryPicker';
import {
  accountBalances,
  ensure,
  parseAmount,
  safeAdd,
} from '../../services/accounting/ledger';
import { typeNames } from '../../utils/format';
import type { Transaction, TransactionType } from '../../types/finance';
import {
  calculateReceipt,
  parseAdjustments,
} from '../../services/accounting/receipt';
import {
  ReceiptAdjustments,
  parseAdjustmentDrafts,
  previewReceipt,
  type AdjustmentDraft,
} from './ReceiptAdjustments';

interface ItemDraft {
  id: string;
  name: string;
  amount: string;
  category: string;
}
export function TransactionForm({
  existing,
  initialType = 'expense',
  initialAccount,
}: {
  existing?: Transaction;
  initialType?: TransactionType;
  initialAccount?: string;
}) {
  const { data, mutate, busy } = useFinance();
  const [excludeFromBalance, setExcludeFromBalance] = useState(
    existing?.exclude_from_balance === 1,
  );
  const [draftId] = useState(() => existing?.id ?? randomUUID());
  const accounts = data.accounts.filter((a) => !a.is_archived);
  const [type, setType] = useState<TransactionType>(
    existing?.type ?? initialType,
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [source, setSource] = useState(
    existing?.source_account_id ?? initialAccount ?? accounts[0]?.id ?? '',
  );
  const [destination, setDestination] = useState(
    existing?.destination_account_id ??
      (initialType === 'transfer'
        ? accounts[1]?.id
        : (initialAccount ?? accounts[0]?.id)) ??
      '',
  );
  const [date, setDate] = useState(
    () => new Date(existing?.occurred_at ?? Date.now()),
  );
  const [dateMode, setDateMode] = useState<'date' | 'time' | null>(null);
  const [note, setNote] = useState(existing?.note ?? '');
  const storedItems = data.items.filter(
    (i) => i.transaction_id === existing?.id,
  );
  const [mode, setMode] = useState<'categories' | 'items'>(
    existing?.category_split !== 1 && storedItems.length > 0
      ? 'items'
      : 'categories',
  );
  const itemized = mode === 'items';
  const [allocations, setAllocations] = useState<CategoryAllocationDraft[]>(
    () => {
      const tags = existing ? transactionCategoryTags(existing) : [];
      if (tags.length)
        return tags.map((category) => ({
          id: randomUUID(),
          category,
          amount: '',
        }));
      if (existing?.category_split === 1)
        return storedItems.map((i) => ({
          id: i.id,
          category: i.category_id,
          amount: String(i.amount),
        }));
      const category =
        existing?.category_id ??
        data.categories.find((c) => !c.is_archived && c.type === type)?.id;
      return category ? [{ id: randomUUID(), category, amount: '' }] : [];
    },
  );
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>(() =>
    parseAdjustments(existing?.adjustments_json).map((a) => ({
      id: a.id,
      name: a.name,
      mode: a.kind === 'fixed' ? 'fixed' : 'percent',
      percent: a.kind === 'fixed' ? '' : String(a.rate_bps / 100),
      amount: a.kind === 'fixed' ? String(a.amount_vnd) : '',
    })),
  );
  const [items, setItems] = useState<ItemDraft[]>(
    (existing?.category_split === 1 ? [] : storedItems).map((i) => ({
      id: i.id,
      name: i.name,
      amount: String(i.amount),
      category: i.category_id,
    })),
  );
  const categories = data.categories.filter(
    (c) =>
      !c.is_archived && c.type === (type === 'income' ? 'income' : 'expense'),
  );
  const activeCategory = (id: string) =>
    categories.some((c) => c.id === id) ? id : '';
  const balances = accountBalances(data);
  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const preview = previewReceipt(items, adjustments);
  const switchMode = async (next: 'categories' | 'items') => {
    if (next === mode || busy) return;
    if (itemized) {
      try {
        ensure(
          items.length > 0,
          'Thêm ít nhất một mục chi trước khi chuyển chế độ.',
        );
        const receipt = calculateReceipt(
          items.map((i) => ({ amount: parseAmount(i.amount) })),
          parseAdjustmentDrafts(adjustments),
        );
        if (
          !(await ConfirmationDialog(
            'Chuyển về ghi giao dịch?',
            'Tổng sau điều chỉnh và các danh mục được giữ lại. Các dòng hóa đơn sẽ không được lưu trong chế độ này. Bản nháp hóa đơn vẫn được giữ tại màn hình này.',
          ))
        )
          return;
        const groups = new Map<string, CategoryAllocationDraft>();
        items.forEach((item, index) => {
          const old = groups.get(item.category);
          groups.set(item.category, {
            id: old?.id ?? item.id,
            category: item.category,
            amount: String(
              safeAdd(Number(old?.amount ?? 0), receipt.itemAmounts[index]),
            ),
          });
        });
        setAllocations([...groups.values()]);
        setAmount(String(receipt.total));
      } catch (e) {
        showError(e);
        return;
      }
    } else if (!items.length) {
      try {
        const selected = prepareTransactionCategories(
          draftId,
          'expense',
          amount,
          allocations,
          data.categories,
        );
        setItems([
          {
            id: randomUUID(),
            name: title,
            amount,
            category: selected.category_id,
          },
        ]);
      } catch {
        setItems([
          {
            id: randomUUID(),
            name: title,
            amount,
            category: allocations[0]?.category ?? categories[0]?.id ?? '',
          },
        ]);
      }
    }
    setMode(next);
  };
  const save = async () => {
    try {
      const id = draftId;
      const now = new Date().toISOString();
      const receipt = type === 'expense' && itemized;
      const selected =
        type !== 'transfer' && !receipt
          ? prepareTransactionCategories(
              id,
              type,
              amount,
              allocations,
              data.categories,
            )
          : null;
      ensure(
        !receipt || items.length > 0,
        'Hóa đơn phải có ít nhất một mục chi.',
      );
      const parsedItems = selected
        ? selected.items
        : receipt
          ? items.map((i, index) => ({
              id: i.id,
              transaction_id: id,
              name: i.name.trim(),
              amount: parseAmount(i.amount),
              category_id: activeCategory(i.category),
              sort_order: index,
            }))
          : [];
      const total = receipt
        ? calculateReceipt(parsedItems, parseAdjustmentDrafts(adjustments))
            .total
        : parseAmount(amount);
      const draft = {
        id,
        type,
        category_split: selected?.category_split ?? (0 as const),
        category_ids_json: selected?.category_ids_json ?? '[]',
        title: title.trim(),
        amount: total,
        exclude_from_balance: excludeFromBalance ? (1 as const) : (0 as const),
        source_account_id: type === 'income' ? null : source,
        destination_account_id: type === 'expense' ? null : destination,
        category_id: selected?.category_id ?? null,
        note: note.trim(),
        occurred_at: date.toISOString(),
        created_at: existing?.created_at ?? now,
        updated_at: now,
        items: parsedItems,
        adjustments_json: JSON.stringify(
          receipt ? parseAdjustmentDrafts(adjustments) : [],
        ),
      };
      if (await mutate((repo) => repo.saveTransaction(draft, !!existing)))
        router.back();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <ScreenContainer
      title={existing ? 'Sửa giao dịch' : 'Ghi giao dịch'}
      back
      subtitle="Mỗi khoản nhỏ đều được ghi nhớ."
    >
      {existing ? (
        <Text style={s.heading}>{typeNames[type]}</Text>
      ) : (
        <Choices
          value={type}
          onChange={(next) => {
            setType(next);
            setMode('categories');
            const category = data.categories.find(
              (c) => !c.is_archived && c.type === next,
            )?.id;
            setAllocations(
              category ? [{ id: randomUUID(), category, amount: '' }] : [],
            );
            setItems([]);
            setAdjustments([]);
          }}
          options={(Object.keys(typeNames) as TransactionType[]).map((t) => ({
            value: t,
            label: typeNames[t],
          }))}
        />
      )}
      <AppCard>
        <Field
          label={
            type === 'transfer'
              ? 'Mô tả (không bắt buộc)'
              : 'Tiêu đề (không bắt buộc)'
          }
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          placeholder={
            type === 'expense'
              ? 'Ví dụ: Đi siêu thị'
              : type === 'income'
                ? 'Ví dụ: Lương tháng này'
                : 'Chuyển nội bộ'
          }
        />
        {type !== 'transfer' && (
          <Text style={s.muted}>
            {itemized
              ? 'Để trống: dùng tên danh mục có tổng tiền lớn nhất trong giao dịch.'
              : 'Để trống: dùng tên danh mục đầu tiên đã chọn.'}
          </Text>
        )}
        {type === 'expense' && (
          <Choices
            value={mode}
            options={[
              { value: 'categories', label: 'Ghi giao dịch' },
              { value: 'items', label: 'Hóa đơn nhiều mục' },
            ]}
            onChange={(next) => void switchMode(next)}
          />
        )}
        {!(type === 'expense' && itemized) && (
          <AmountInput value={amount} onChangeText={setAmount} />
        )}
        {type !== 'income' && (
          <>
            <AccountPicker
              variant="dropdown"
              accounts={accounts}
              value={source}
              onChange={setSource}
              label="Tài khoản nguồn"
            />
            <Text style={s.muted}>
              Số dư hiện tại:{' '}
              <Amount value={balances[source] ?? 0} style={{ fontSize: 13 }} />
            </Text>
          </>
        )}
        {type !== 'expense' && (
          <AccountPicker
            variant="dropdown"
            accounts={
              type === 'transfer'
                ? accounts.filter((a) => a.id !== source)
                : accounts
            }
            value={destination}
            onChange={setDestination}
            label="Tài khoản nhận"
          />
        )}
        {type !== 'transfer' && !itemized && (
          <TransactionCategoriesPicker
            type={type}
            value={allocations}
            onChange={setAllocations}
          />
        )}
      </AppCard>
      {type === 'expense' && itemized && (
        <>
          <Text style={s.heading}>Các mục trong hóa đơn</Text>
          {items.map((item, index) => (
            <AppCard key={item.id}>
              <Field
                label={`Tên mục ${index + 1}`}
                value={item.name}
                onChangeText={(name) => updateItem(item.id, { name })}
                maxLength={200}
              />
              <AmountInput
                value={item.amount}
                onChangeText={(value) => updateItem(item.id, { amount: value })}
              />
              <TransactionCategoryPicker
                type="expense"
                value={activeCategory(item.category)}
                onChange={(value) => updateItem(item.id, { category: value })}
              />
              <SecondaryButton
                label="Bỏ mục này"
                danger
                onPress={() =>
                  setItems((list) => list.filter((i) => i.id !== item.id))
                }
              />
            </AppCard>
          ))}
          <SecondaryButton
            label="Thêm mục chi"
            icon="add-outline"
            onPress={() =>
              setItems((list) => [
                ...list,
                {
                  id: randomUUID(),
                  name: '',
                  amount: '',
                  category: categories[0]?.id ?? '',
                },
              ])
            }
          />
          <ReceiptAdjustments
            drafts={adjustments}
            onChange={setAdjustments}
            summary={preview.summary}
            error={preview.error}
          />
        </>
      )}
      <BalanceExclusionCheckbox
        value={excludeFromBalance}
        onChange={setExcludeFromBalance}
        disabled={busy}
      />
      <AppCard>
        <Text style={s.label}>Ngày và giờ · múi giờ thiết bị</Text>
        <SecondaryButton
          label={date.toLocaleDateString('vi-VN')}
          icon="calendar-outline"
          onPress={() => setDateMode('date')}
        />
        <SecondaryButton
          label={date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          icon="time-outline"
          onPress={() => setDateMode('time')}
        />
        <Field
          label="Ghi chú (không bắt buộc)"
          multiline
          value={note}
          onChangeText={setNote}
          maxLength={4000}
        />
      </AppCard>
      {dateMode && (
        <DateTimePicker
          value={date}
          mode={dateMode}
          onDismiss={() => setDateMode(null)}
          onValueChange={(_, selected) => {
            setDateMode(null);
            setDate(selected);
          }}
        />
      )}
      <PrimaryButton
        label={busy ? 'Đang lưu…' : 'Lưu giao dịch'}
        disabled={busy}
        onPress={() => void save()}
      />
    </ScreenContainer>
  );
}
