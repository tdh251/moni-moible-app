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
  CategoryPicker,
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
import {
  accountBalances,
  ensure,
  parseAmount,
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
  const [category, setCategory] = useState(
    existing?.category_id ??
      data.categories.find((c) => !c.is_archived && c.type === type)?.id ??
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
  const [itemized, setItemized] = useState(storedItems.length > 0);
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
    storedItems.map((i) => ({
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
  const balances = accountBalances(data);
  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const preview = previewReceipt(items, adjustments);
  const switchMode = async (next: boolean) => {
    if (next === itemized) return;
    if (!next) {
      try {
        ensure(
          items.length > 0,
          'Thêm ít nhất một mục chi trước khi chuyển về đơn giản.',
        );
        const total = calculateReceipt(
          items.map((i) => ({ amount: parseAmount(i.amount) })),
          parseAdjustmentDrafts(adjustments),
        ).total;
        if (
          !(await ConfirmationDialog(
            'Chuyển sang chi đơn giản?',
            'Tổng sau điều chỉnh được giữ lại. Chi đơn giản không lưu các dòng điều chỉnh; hãy chọn một danh mục cho tổng này. Bản nháp mục chi và điều chỉnh vẫn được giữ tại màn hình này.',
          ))
        )
          return;
        setAmount(String(total));
        setCategory(items[0].category);
      } catch (e) {
        showError(e);
        return;
      }
    } else if (!items.length)
      setItems([{ id: randomUUID(), name: title, amount, category }]);
    setItemized(next);
  };
  const save = async () => {
    try {
      const id = draftId;
      const now = new Date().toISOString();
      const receipt = type === 'expense' && itemized;
      ensure(
        !receipt || items.length > 0,
        'Hóa đơn phải có ít nhất một mục chi.',
      );
      const parsedItems = receipt
        ? items.map((i, index) => ({
            id: i.id,
            transaction_id: id,
            name: i.name.trim(),
            amount: parseAmount(i.amount),
            category_id: i.category,
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
        title: title.trim(),
        amount: total,
        exclude_from_balance: excludeFromBalance ? (1 as const) : (0 as const),
        source_account_id: type === 'income' ? null : source,
        destination_account_id: type === 'expense' ? null : destination,
        category_id: type === 'transfer' || receipt ? null : category,
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
            setCategory(
              data.categories.find((c) => !c.is_archived && c.type === next)
                ?.id ?? '',
            );
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
            {itemized && type === 'expense'
              ? 'Để trống: dùng tên danh mục có tổng tiền lớn nhất trong hóa đơn.'
              : 'Để trống: dùng tên danh mục đã chọn.'}
          </Text>
        )}
        {type === 'expense' && (
          <Choices
            value={itemized ? 'items' : 'simple'}
            options={[
              { value: 'simple', label: 'Chi đơn giản' },
              { value: 'items', label: 'Hóa đơn nhiều mục' },
            ]}
            onChange={(v) => void switchMode(v === 'items')}
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
        {type !== 'transfer' && !(type === 'expense' && itemized) && (
          <CategoryPicker
            variant="dropdown"
            categories={categories}
            value={category}
            onChange={setCategory}
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
              <CategoryPicker
                variant="dropdown"
                categories={categories}
                value={item.category}
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
