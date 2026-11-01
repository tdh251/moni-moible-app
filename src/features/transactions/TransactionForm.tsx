import { FormActions } from '../../components/ui/FormActions';
import { transactionTagIds } from '../../services/tags';
import { TagPicker } from '../tags/TagPicker';
import {
  itemCategoryIds,
  transactionCategoryTags,
} from '../../services/categories/tags';
import { TransactionCategoriesPicker } from './TransactionCategoriesPicker';
import {
  prepareTransactionCategories,
  type CategoryAllocationDraft,
} from '../../services/accounting/split';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
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
  Icon,
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
  categoryIds: string[];
  tagIds: string[];
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
  const [tagIds, setTagIds] = useState<string[]>(() =>
    existing ? transactionTagIds(existing) : [],
  );
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
      if (existing && storedItems.length && existing.category_split !== 1)
        return [];
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
      categoryIds: itemCategoryIds(i),
      tagIds: transactionTagIds(i),
    })),
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const activeItem =
    items.find((item) => item.id === selectedItemId) ?? items[0];
  const removeItem = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedItemId(items[index + 1]?.id ?? items[index - 1]?.id ?? null);
  };
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
      // Incomplete receipt drafts can be left without validating or discarding them.
      if (!preview.summary) {
        setMode(next);
        return;
      }
      try {
        const receipt = preview.summary;
        if (
          !(await ConfirmationDialog(
            'Chuyển về ghi giao dịch?',
            'Tổng sau điều chỉnh được giữ lại và dùng danh mục của mục chi đầu tiên. Các dòng hóa đơn sẽ không được lưu trong chế độ này. Bản nháp hóa đơn vẫn được giữ tại màn hình này.',
          ))
        )
          return;
        const category = items[0].categoryIds[0];
        setAllocations(
          category ? [{ id: items[0].id, category, amount: '' }] : [],
        );
        setTagIds([
          ...new Set([...tagIds, ...items.flatMap((item) => item.tagIds)]),
        ]);
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
            categoryIds: [selected.category_id],
            tagIds: [],
          },
        ]);
      } catch {
        setItems([
          {
            id: randomUUID(),
            name: title,
            amount,
            category: allocations[0]?.category ?? categories[0]?.id ?? '',
            categoryIds: [allocations[0]?.category ?? categories[0]?.id ?? ''],
            tagIds: [],
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
              category_id: activeCategory(i.categoryIds[0] ?? ''),
              category_ids_json: '[]',
              tag_ids_json: JSON.stringify(i.tagIds),
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
        tag_ids_json: JSON.stringify(tagIds),
        category_ids_json: '[]',
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
          placeholder="Trống"
        />
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
      </AppCard>
      <AppCard>
        {type !== 'income' && (
          <>
            <AccountPicker
              variant="dropdown"
              accounts={accounts}
              value={source}
              onChange={setSource}
              label="Tài khoản"
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
        <View style={{ gap: 0 }}>
          {type === 'expense' && itemized ? (
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Số tiền (VND)</Text>
              {preview.summary ? (
                <Amount value={preview.summary.total} />
              ) : (
                <Text style={s.muted}>Thêm các mục hóa đơn để tính tổng.</Text>
              )}
            </View>
          ) : (
            <AmountInput
              value={amount}
              onChangeText={setAmount}
              showHint={false}
            />
          )}
          <BalanceExclusionCheckbox
            value={excludeFromBalance}
            onChange={setExcludeFromBalance}
            disabled={busy}
            embedded
          />
        </View>
      </AppCard>
      {type !== 'transfer' && !itemized && (
        <AppCard>
          <TransactionCategoriesPicker
            type={type}
            value={allocations}
            onChange={setAllocations}
          />
        </AppCard>
      )}
      {type === 'expense' && itemized && (
        <>
          <Text style={s.heading}>Các mục trong hóa đơn</Text>
          {items.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8 }}
            >
              {items.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityLabel={item.name.trim() || `Mục ${index + 1}`}
                  accessibilityState={{
                    selected: item.id === activeItem?.id,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSelectedItemId(item.id);
                  }}
                  style={[
                    s.pill,
                    {
                      minHeight: 44,
                      minWidth: 80,
                      maxWidth: 180,
                      justifyContent: 'center',
                    },
                    item.id === activeItem?.id && s.selected,
                  ]}
                >
                  <Text style={s.text} numberOfLines={1}>
                    {item.name.trim() || `Mục ${index + 1}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {items.map((item, index) =>
            item.id !== activeItem?.id ? null : (
              <AppCard key={item.id}>
                <View style={s.between}>
                  <Text style={[s.heading, { flex: 1 }]} numberOfLines={2}>
                    {item.name.trim() || `Mục ${index + 1}`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ mục ${index + 1}${item.name ? `: ${item.name}` : ''}`}
                    disabled={busy}
                    accessibilityState={{ disabled: busy }}
                    onPress={() => removeItem(item.id)}
                    style={({ pressed }) => ({
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: busy ? 0.45 : pressed ? 0.7 : 1,
                    })}
                  >
                    <Icon name="close-outline" size={24} />
                  </Pressable>
                </View>
                <Field
                  label="Tên mục"
                  value={item.name}
                  onChangeText={(name) => updateItem(item.id, { name })}
                  maxLength={200}
                />
                <AmountInput
                  showHint={false}
                  value={item.amount}
                  onChangeText={(value) =>
                    updateItem(item.id, { amount: value })
                  }
                />
                <TransactionCategoriesPicker
                  type="expense"
                  value={item.categoryIds.map((category) => ({
                    id: category,
                    category,
                    amount: '',
                  }))}
                  onChange={(rows) =>
                    updateItem(item.id, {
                      category: rows[0]?.category ?? '',
                      categoryIds: rows.map((row) => row.category),
                    })
                  }
                />
                <TagPicker
                  label="Tags mục chi"
                  value={item.tagIds}
                  onChange={(tagIds) => updateItem(item.id, { tagIds })}
                />
              </AppCard>
            ),
          )}
          <SecondaryButton
            label="Thêm mục chi"
            icon="add-outline"
            disabled={busy}
            onPress={() => {
              const id = randomUUID();
              setItems((list) => [
                ...list,
                {
                  id,
                  name: '',
                  amount: '',
                  category: categories[0]?.id ?? '',
                  categoryIds: categories[0] ? [categories[0].id] : [],
                  tagIds: [],
                },
              ]);
              setSelectedItemId(id);
            }}
          />
          <ReceiptAdjustments
            drafts={adjustments}
            onChange={setAdjustments}
            summary={preview.summary}
            error={preview.error}
          />
        </>
      )}
      <AppCard>
        <TagPicker
          label={type === 'expense' && itemized ? 'Tags hóa đơn' : undefined}
          value={tagIds}
          onChange={setTagIds}
        />
      </AppCard>
      <AppCard>
        <View style={s.selectGroup}>
          <Text style={s.fieldLabel}>Ngày và giờ · múi giờ thiết bị</Text>
          <SecondaryButton
            label={date.toLocaleDateString('vi-VN')}
            icon="calendar-outline"
            disabled={busy}
            onPress={() => setDateMode('date')}
          />
          <SecondaryButton
            label={date.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            icon="time-outline"
            disabled={busy}
            onPress={() => setDateMode('time')}
          />
        </View>
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
      <FormActions
        busy={busy}
        onCancel={() => router.back()}
        onSave={() => void save()}
      />
    </ScreenContainer>
  );
}
