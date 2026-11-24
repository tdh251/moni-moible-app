import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { AppState, Pressable, SectionList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Amount,
  AppCard,
  Choices,
  EmptyState,
  SearchField,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import {
  purchaseBalances,
  totalPurchaseOutstanding,
} from '../../services/purchases';
import { safeAdd } from '../../services/accounting/money';
import type { Purchase } from '../../types/finance';
import {
  HeroCard,
  MoneyRow,
  StatusBadge,
} from '../../components/ui/primitives';
import { colors, layout } from '../../theme';

export function PurchaseList() {
  const { data } = useFinance();
  const [status, setStatus] = useState<'pending' | 'settled' | 'all'>(
    'pending',
  );
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      const refresh = () => setNow(Date.now());
      refresh();
      const timer = setInterval(refresh, 60_000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, []),
  );
  const query = useDeferredValue(search.trim().toLocaleLowerCase('vi-VN'));
  const balances = useMemo(() => purchaseBalances(data), [data]);
  const total = useMemo(() => totalPurchaseOutstanding(data), [data]);
  const sections = useMemo(() => {
    const people = new Map<
      string,
      { title: string; remaining: number; data: Purchase[] }
    >();
    for (const purchase of data.purchases ?? []) {
      const remaining = balances.get(purchase.id) ?? 0;
      if (
        (status === 'pending' && remaining === 0) ||
        (status === 'settled' && remaining > 0)
      )
        continue;
      if (
        query &&
        !`${purchase.person} ${purchase.title} ${purchase.note}`
          .toLocaleLowerCase('vi-VN')
          .includes(query)
      )
        continue;
      const key = purchase.person.trim().toLocaleLowerCase('vi-VN');
      const group = people.get(key) ?? {
        title: purchase.person,
        remaining: 0,
        data: [],
      };
      group.remaining = safeAdd(group.remaining, remaining);
      group.data.push(purchase);
      people.set(key, group);
    }
    return [...people.values()].sort(
      (a, b) =>
        b.remaining - a.remaining || a.title.localeCompare(b.title, 'vi'),
    );
  }, [data.purchases, balances, query, status]);
  return (
    <SectionList
      style={{ flex: 1 }}
      sections={sections}
      keyExtractor={(item) => item.id}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: layout.floatingContentPadding }}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <HeroCard
            label="Tiền mua hộ chờ hoàn"
            value={total}
            subtitle="Tất cả các kỳ · Không tính vào thu chi cá nhân"
          />
          <Choices
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pending', label: 'Chờ hoàn' },
              { value: 'settled', label: 'Đã hoàn' },
              { value: 'all', label: 'Tất cả' },
            ]}
          />
          <SearchField
            label="Tìm khoản mua hộ"
            value={search}
            onChangeText={setSearch}
            placeholder="Tên người, nội dung, ghi chú"
          />
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={[s.between, { marginTop: 24, marginBottom: 8, gap: 12 }]}>
          <Text style={[s.heading, { flex: 1 }]}>{section.title}</Text>
          <Amount value={section.remaining} />
        </View>
      )}
      renderItem={({ item }) => {
        const remaining = balances.get(item.id) ?? 0;
        const overdue =
          remaining > 0 &&
          !!item.due_at &&
          new Date(item.due_at).getTime() < now;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mua hộ ${item.person}: ${item.title}`}
            onPress={() =>
              router.push({
                pathname: '/purchases/[id]',
                params: { id: item.id },
              })
            }
            style={{ marginBottom: 10 }}
          >
            <AppCard>
              <Text style={s.text}>{item.title}</Text>
              <StatusBadge
                label={
                  remaining === 0
                    ? 'Đã hoàn đủ'
                    : remaining < item.amount
                      ? 'Đã hoàn một phần'
                      : 'Chưa hoàn'
                }
                tone={remaining ? 'brand' : 'neutral'}
              />
              <MoneyRow
                label="Còn cần thu"
                value={remaining}
                tone={remaining ? colors.primary : colors.muted}
              />
              <Text style={s.muted}>
                {new Date(item.occurred_at).toLocaleDateString('vi-VN')} · Đã
                ứng <Amount value={item.amount} style={{ fontSize: 13 }} />
              </Text>
              {item.due_at && (
                <Text style={[s.muted, overdue && { color: colors.expense }]}>
                  {overdue ? 'Quá hạn' : 'Hạn hoàn'}:{' '}
                  {new Date(item.due_at).toLocaleDateString('vi-VN')}
                </Text>
              )}
            </AppCard>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon="bag-handle-outline"
          title="Chưa có khoản mua hộ phù hợp"
          description="Ghi một khoản mua hộ mới hoặc đổi trạng thái, từ khóa tìm kiếm."
        />
      }
    />
  );
}
