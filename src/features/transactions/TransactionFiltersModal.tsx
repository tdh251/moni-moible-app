import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AccountPicker,
  Choices,
  Field,
  Icon,
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
import { colors } from '../../theme';

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
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng bộ lọc"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          pointerEvents="box-none"
        >
          <SafeAreaView
            style={{ flex: 1, padding: 12, justifyContent: 'flex-end' }}
            pointerEvents="box-none"
          >
            <View
              accessibilityViewIsModal
              style={{
                width: '100%',
                maxWidth: 720,
                maxHeight: '95%',
                alignSelf: 'center',
                backgroundColor: colors.card,
                borderRadius: 24,
                overflow: 'hidden',
              }}
            >
              <View
                style={[
                  s.between,
                  {
                    paddingLeft: 20,
                    paddingRight: 8,
                    paddingTop: 8,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text accessibilityRole="header" style={s.heading}>
                  Lọc giao dịch
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng bộ lọc"
                  style={{
                    padding: 12,
                    minHeight: 48,
                    minWidth: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={close}
                >
                  <Icon name="close-outline" />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, gap: 20 }}
              >
                <View style={{ gap: 6 }}>
                  <Text style={s.label}>Loại giao dịch</Text>
                  <Choices
                    value={draft.type}
                    options={[
                      { value: '', label: 'Tất cả' },
                      ...(Object.keys(typeNames) as TransactionType[]).map(
                        (value) => ({ value, label: typeNames[value] }),
                      ),
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
                    label="Danh mục"
                    placeholder="Tất cả danh mục"
                    options={categoryTree(data.categories).map(
                      ({ category }) => ({
                        value: category.id,
                        label:
                          categoryPath(data.categories, category.id) +
                          (category.is_archived ? ' · lưu trữ' : ''),
                        icon: category.icon,
                      }),
                    )}
                    value={
                      draft.categories?.length
                        ? draft.categories
                        : draft.category
                          ? [draft.category]
                          : []
                    }
                    onChange={(categories) =>
                      patch({ categories, category: '' })
                    }
                  />
                </View>
                <TagPicker
                  filter
                  value={draft.tags ?? []}
                  onChange={(tags) => patch({ tags })}
                />
                <View style={{ gap: 10 }}>
                  <Text style={s.label}>Khoảng tiền (VND)</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Từ"
                        keyboardType="number-pad"
                        maxLength={16}
                        placeholder="Không giới hạn"
                        value={minimum}
                        onChangeText={setMinimum}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
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
                  icon="refresh-outline"
                  onPress={reset}
                />
              </ScrollView>
              <View
                style={[
                  s.row,
                  {
                    padding: 16,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <SecondaryButton label="Hủy" onPress={close} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Áp dụng"
                    icon="checkmark-outline"
                    onPress={apply}
                  />
                </View>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
