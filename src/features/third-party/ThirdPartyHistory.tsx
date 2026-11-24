import { useDeferredValue, useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { AccountPicker, EmptyState, SearchField } from '../../components/ui';
import { PeriodFilter } from '../../components/PeriodFilter';
import { useFinance } from '../../hooks/finance';
import { filterThirdPartyEntries } from '../../services/third-party-list';
import type { Filters } from '../../types/finance';
import { ThirdPartyEntryRow } from './ThirdPartyEntryRow';
import { layout } from '../../theme';

export function ThirdPartyHistory({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const { data } = useFinance();
  const deferredFilters = useDeferredValue(filters);
  const entries = useMemo(
    () => filterThirdPartyEntries(data, deferredFilters),
    [data, deferredFilters],
  );
  const cases = useMemo(
    () => new Map((data.thirdPartyCases ?? []).map((c) => [c.id, c])),
    [data.thirdPartyCases],
  );
  const accounts = useMemo(
    () => new Map(data.accounts.map((a) => [a.id, a.name])),
    [data.accounts],
  );
  return (
    <FlatList
      style={{ flex: 1 }}
      data={entries}
      keyExtractor={(entry) => entry.id}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: layout.floatingContentPadding }}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <SearchField
            label="Tìm bút toán thu chi hộ"
            value={filters.search}
            onChangeText={(search) => onChange({ search })}
            placeholder="Người, hồ sơ, nội dung"
          />
          <PeriodFilter value={filters} onChange={onChange} />
          <AccountPicker
            all
            variant="dropdown"
            accounts={data.accounts}
            value={filters.account}
            onChange={(account) => onChange({ account, accounts: [] })}
          />
        </View>
      }
      renderItem={({ item }) => (
        <ThirdPartyEntryRow
          entry={item}
          accountName={accounts.get(item.account_id ?? '')}
          title={`${cases.get(item.case_id)?.title ?? ''} · ${cases.get(item.case_id)?.person ?? ''}`}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          title="Chưa có bút toán thu chi hộ trong kỳ"
          description="Thử đổi kỳ hoặc mở Công nợ → Thu chi hộ để tạo hồ sơ."
        />
      }
    />
  );
}
