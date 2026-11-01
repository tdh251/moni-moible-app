import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useScrollAddButton } from '../../hooks/useScrollAddButton';
import { TransactionFiltersModal } from '../../features/transactions/TransactionFiltersModal';
import { useMemo, useState } from 'react';
import { Keyboard, SectionList, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  EmptyState,
  Field,
  ScreenContainer,
  SecondaryButton,
  TransactionRow,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { PeriodFilter } from '../../components/PeriodFilter';
import { usePreferences } from '../../stores/preferences';
import { filterTransactions } from '../../services/accounting/ledger';
import type { Transaction } from '../../types/finance';
export default function History() {
  const { data } = useFinance();
  const filters = usePreferences((v) => v.historyFilters);
  const set = usePreferences((v) => v.setFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const { addButtonVisible, handleScroll } = useScrollAddButton();
  const account = filters.account || filters.accounts?.[0] || '';
  const transactions = useMemo(
    () => filterTransactions(data, { ...filters, account, accounts: [] }),
    [data, filters, account],
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 20 }}>
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
            <View style={s.between}>
              <Text style={[s.muted, { flex: 1 }]}>
                {transactions.length} giao dịch trong kỳ
              </Text>
              <SecondaryButton
                label="Lọc"
                icon="options-outline"
                onPress={() => {
                  Keyboard.dismiss();
                  setFilterOpen(true);
                }}
              />
            </View>
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
        contentContainerStyle={{ paddingBottom: 96 }}
      />
      <FloatingAddButton
        visible={addButtonVisible}
        label="Thêm giao dịch"
        hint="Mở màn hình thêm giao dịch mới"
        onPress={() => router.push('/transaction/new')}
      />
      {filterOpen && (
        <TransactionFiltersModal
          initialValue={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(next) => {
            set('historyFilters', next);
            setFilterOpen(false);
          }}
        />
      )}
    </ScreenContainer>
  );
}
