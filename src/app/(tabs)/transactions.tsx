import { useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Choices,
  EmptyState,
  Field,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  TransactionRow,
  s,
} from '../../components/ui';
import { PeriodFilter } from '../../components/PeriodFilter';
import { Dropdown } from '../../components/ui/Dropdown';
import { AmountRangeFilter } from '../../features/transactions/AmountRangeFilter';
import { useFinance } from '../../hooks/finance';
import { initialFilters, usePreferences } from '../../stores/preferences';
import { filterTransactions } from '../../services/accounting/ledger';
import { typeNames } from '../../utils/format';
import type { Transaction, TransactionType } from '../../types/finance';
export default function History() {
  const { data } = useFinance();
  const filters = usePreferences((v) => v.historyFilters);
  const set = usePreferences((v) => v.setFilters);
  const [expanded, setExpanded] = useState(false);
  const transactions = useMemo(
    () => filterTransactions(data, filters),
    [data, filters],
  );
  const sections = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const day = new Date(t.occurred_at).toLocaleDateString('vi-VN');
      groups.set(day, [...(groups.get(day) ?? []), t]);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [transactions]);
  return (
    <ScreenContainer
      title="Giao dịch"
      subtitle="Nhìn lại dòng tiền của bạn."
      scroll={false}
    >
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 20 }}>
            <PrimaryButton
              label="Ghi giao dịch"
              icon="add-outline"
              onPress={() => router.push('/transaction/new')}
            />
            <Field
              label="Tìm giao dịch"
              value={filters.search}
              onChangeText={(search) => set('historyFilters', { search })}
              placeholder="Tiêu đề hoặc ghi chú"
            />
            <PeriodFilter
              value={filters}
              onChange={(patch) => set('historyFilters', patch)}
            />
            <Choices
              value={filters.type}
              options={[
                { value: '', label: 'Tất cả' },
                ...(Object.keys(typeNames) as TransactionType[]).map(
                  (value) => ({ value, label: typeNames[value] }),
                ),
              ]}
              onChange={(type) => set('historyFilters', { type })}
            />
            <View>
              <Text style={s.label}>Tài khoản</Text>
              <Dropdown
                multiple
                label="Tài khoản"
                placeholder="Tất cả tài khoản"
                options={data.accounts.map((a) => ({
                  value: a.id,
                  label: a.name + (a.is_archived ? ' · lưu trữ' : ''),
                  icon: a.type === 'cash' ? 'wallet-outline' : 'card-outline',
                }))}
                value={
                  filters.accounts ?? (filters.account ? [filters.account] : [])
                }
                onChange={(accounts) =>
                  set('historyFilters', { accounts, account: '' })
                }
              />
            </View>
            <SecondaryButton
              label={expanded ? 'Thu gọn bộ lọc' : 'Lọc danh mục & số tiền'}
              icon="options-outline"
              onPress={() => setExpanded(!expanded)}
            />
            {expanded && (
              <>
                <View>
                  <Text style={s.label}>Danh mục</Text>
                  <Dropdown
                    multiple
                    label="Danh mục"
                    placeholder="Chọn danh mục"
                    options={data.categories.map((c) => ({
                      value: c.id,
                      label: c.name + (c.is_archived ? ' · lưu trữ' : ''),
                      icon: c.icon,
                    }))}
                    value={
                      filters.categories ??
                      (filters.category ? [filters.category] : [])
                    }
                    onChange={(categories) =>
                      set('historyFilters', { categories, category: '' })
                    }
                  />
                </View>
                <AmountRangeFilter
                  key={
                    String(filters.minAmount) + ':' + String(filters.maxAmount)
                  }
                  filters={filters}
                  onApply={(value) => set('historyFilters', value)}
                />
                <SecondaryButton
                  label="Xóa bộ lọc"
                  onPress={() => set('historyFilters', initialFilters())}
                />
              </>
            )}
            <Text style={s.muted}>
              {transactions.length} giao dịch trong kỳ
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[s.label, { marginTop: 18 }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TransactionRow transaction={item} ledger={data} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có giao dịch phù hợp"
            description="Thử đổi kỳ, tài khoản hoặc bộ lọc. Bạn cũng có thể ghi giao dịch mới."
          />
        }
        contentContainerStyle={{ paddingBottom: 35 }}
      />
    </ScreenContainer>
  );
}
