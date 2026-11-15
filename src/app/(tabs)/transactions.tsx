import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TransactionDraftList } from '../../features/transactions/TransactionDraftList';
import { layout } from '../../theme';
import { TransactionFiltersModal } from '../../features/transactions/TransactionFiltersModal';
import { useDeferredValue, useMemo, useState } from 'react';
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
import {
  createTransactionListIndex,
  groupTransactionsByDay,
} from '../../services/transaction-list';
export default function History() {
  const { data, busy } = useFinance();
  const filters = usePreferences((v) => v.historyFilters);
  const deferredFilters = useDeferredValue(filters);
  const set = usePreferences((v) => v.setFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<'posted' | 'drafts'>('posted');
  const account =
    deferredFilters.account || deferredFilters.accounts?.[0] || '';
  const transactionIndex = useMemo(
    () => createTransactionListIndex(data),
    [data],
  );
  const transactions = useMemo(
    () =>
      filterTransactions(data, { ...deferredFilters, account, accounts: [] }),
    [data, deferredFilters, account],
  );
  const sections = useMemo(
    () => groupTransactionsByDay(transactions),
    [transactions],
  );
  return (
    <ScreenContainer
      tabScreen
      title="Giao dịch"
      subtitle="Nhìn lại dòng tiền của bạn."
      scroll={false}
      floatingAction={
        <FloatingAddButton
          label="Thêm giao dịch"
          hint="Mở màn hình thêm giao dịch mới"
          disabled={busy}
          onPress={() => router.push('/transaction/new')}
        />
      }
    >
      <SegmentedControl
        value={view}
        options={[
          { value: 'posted', label: 'Đã ghi' },
          {
            value: 'drafts',
            label: `Bản nháp (${data.transactionDrafts?.length ?? 0})`,
          },
        ]}
        onChange={setView}
      />
      {view === 'drafts' ? (
        <>
          <Text style={s.muted}>Bản nháp chưa tính vào số dư và thống kê.</Text>
          <TransactionDraftList bottomPadding={layout.floatingContentPadding} />
        </>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          extraData={transactionIndex}
          sections={sections}
          keyExtractor={(t) => t.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
            <TransactionRow transaction={item} index={transactionIndex} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Chưa có giao dịch phù hợp"
              description="Thử đổi kỳ, tài khoản hoặc bộ lọc. Bạn cũng có thể ghi giao dịch mới."
            />
          }
          contentContainerStyle={s.listContent}
        />
      )}
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
