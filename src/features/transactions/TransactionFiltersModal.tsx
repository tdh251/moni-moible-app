import { useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import {
  AccountPicker,
  Choices,
  Field,
  PrimaryButton,
  SecondaryButton,
  s,
} from '../../components/ui';
import { Dropdown } from '../../components/ui/Dropdown';
import { TagPicker } from '../tags/TagPicker';
import { useFinance, showError } from '../../hooks/finance';
import { initialFilters } from '../../stores/preferences';
import { ensure, parseAmount } from '../../services/accounting/money';
import {
  categoryPath,
  categoryTree,
} from '../../services/categories/hierarchy';
import { typeNames } from '../../utils/format';
import type { Filters, TransactionType } from '../../types/finance';

export function TransactionFiltersModal({
  initialValue,
  onApply,
  onClose,
}: {
  initialValue: Filters;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}) {
  const { data } = useFinance();
  const { stack } = useResponsiveLayout();
  const [draft, setDraft] = useState<Filters>(() => ({
    ...initialValue,
    account: initialValue.account || initialValue.accounts?.[0] || '',
    accounts: [],
  }));
  const [minimum, setMinimum] = useState(
    initialValue.minAmount === undefined ? '' : String(initialValue.minAmount),
  );
  const [maximum, setMaximum] = useState(
    initialValue.maxAmount === undefined ? '' : String(initialValue.maxAmount),
  );
  const patch = (value: Partial<Filters>) =>
    setDraft((current) => ({ ...current, ...value }));
  const close = () => {
    Keyboard.dismiss();
    onClose();
  };
  const reset = () => {
    setDraft({
      ...initialFilters(),
      search: initialValue.search,
      date: initialValue.date,
      period: initialValue.period,
    });
    setMinimum('');
    setMaximum('');
  };
  const apply = () => {
    try {
      const minAmount = minimum.trim() ? parseAmount(minimum, true) : undefined;
      const maxAmount = maximum.trim() ? parseAmount(maximum, true) : undefined;
      ensure(
        minAmount === undefined ||
          maxAmount === undefined ||
          minAmount <= maxAmount,
        'Số tiền từ phải nhỏ hơn hoặc bằng số tiền đến.',
      );
      Keyboard.dismiss();
      onApply({ ...draft, accounts: [], minAmount, maxAmount });
    } catch (error) {
      showError(error);
    }
  };
  return (
    <BottomSheet
      title="Lọc giao dịch"
      onClose={close}
      footer={
        <View
          style={{ flexDirection: stack ? 'column-reverse' : 'row', gap: 8 }}
        >
          <View style={{ flex: stack ? undefined : 1 }}>
            <SecondaryButton label="Hủy" onPress={close} />
          </View>
          <View style={{ flex: stack ? undefined : 1 }}>
            <PrimaryButton
              label="Áp dụng"
              icon="checkmark-outline"
              onPress={apply}
            />
          </View>
        </View>
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 12, gap: 16 }}
      >
        <View style={{ gap: 6 }}>
          <Text style={s.label}>Loại giao dịch</Text>
          <Choices
            value={draft.type}
            options={[
              { value: '', label: 'Tất cả' },
              ...(Object.keys(typeNames) as TransactionType[]).map((value) => ({
                value,
                label: typeNames[value],
              })),
            ]}
            onChange={(type) => patch({ type })}
          />
        </View>
        <AccountPicker
          all
          variant="chips"
          accounts={data.accounts}
          value={draft.account}
          onChange={(account) => patch({ account, accounts: [] })}
        />
        <View style={{ gap: 6 }}>
          <Text style={s.label}>Danh mục</Text>
          <Dropdown
            multiple
            searchable
            label="Danh mục"
            placeholder="Tất cả danh mục"
            options={categoryTree(data.categories).map(({ category }) => ({
              value: category.id,
              label:
                categoryPath(data.categories, category.id) +
                (category.is_archived ? ' · lưu trữ' : ''),
              icon: category.icon,
            }))}
            value={
              draft.categories?.length
                ? draft.categories
                : draft.category
                  ? [draft.category]
                  : []
            }
            onChange={(categories) => patch({ categories, category: '' })}
          />
        </View>
        <TagPicker
          filter
          value={draft.tags ?? []}
          onChange={(tags) => patch({ tags })}
        />
        <View style={{ gap: 10 }}>
          <Text style={s.label}>Khoảng tiền (VND)</Text>
          <View style={{ flexDirection: stack ? 'column' : 'row', gap: 12 }}>
            <View style={{ flex: stack ? undefined : 1 }}>
              <Field
                label="Từ"
                keyboardType="number-pad"
                maxLength={16}
                placeholder="Không giới hạn"
                value={minimum}
                onChangeText={setMinimum}
              />
            </View>
            <View style={{ flex: stack ? undefined : 1 }}>
              <Field
                label="Đến"
                keyboardType="number-pad"
                maxLength={16}
                placeholder="Không giới hạn"
                value={maximum}
                onChangeText={setMaximum}
              />
            </View>
          </View>
          <Text style={s.muted}>
            Lọc theo tổng tiền giao dịch, gồm cả hai đầu khoảng.
          </Text>
        </View>
        <SecondaryButton
          label="Xóa bộ lọc"
          danger
          icon="refresh-outline"
          onPress={reset}
        />
      </ScrollView>
    </BottomSheet>
  );
}
