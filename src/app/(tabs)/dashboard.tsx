import { AppState, Pressable, SectionList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  createTransactionListIndex,
  recentTransactionSections,
} from '../../services/transaction-list';
import {
  AppCard,
  EmptyState,
  Icon,
  IconButton,
  PrimaryButton,
  ScreenContainer,
  TransactionRow,
  s,
} from '../../components/ui';
import { colors, layout } from '../../theme';
import { APP_NAME } from '../../constants/app';
import {
  AccountRow,
  HeroCard,
  MoneyRow,
  SectionHeader,
  SummaryCard,
} from '../../components/ui/primitives';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { totalLoanOutstanding } from '../../services/loans';
import { useFinance } from '../../hooks/finance';
import { usePreferences, initialFilters } from '../../stores/preferences';
import {
  accountBalances,
  statistics,
  totalBalance,
  shiftPeriod,
} from '../../services/accounting/ledger';
import { periodLabel } from '../../utils/format';
import { totalPurchaseOutstanding } from '../../services/purchases';
import {
  personalReportTransactions,
  thirdPartyTotals,
} from '../../services/third-party';
export default function Dashboard() {
  const { data } = useFinance();
  const { stack } = useResponsiveLayout();
  const balances = useMemo(() => accountBalances(data), [data]);
  const thirdParty = useMemo(() => thirdPartyTotals(data), [data]);
  const transactionIndex = useMemo(
    () => createTransactionListIndex(data),
    [data],
  );
  const [date, setDate] = useState(new Date().toISOString());
  const summary = useMemo(
    () => statistics(data, { ...initialFilters(), date }),
    [data, date],
  );
  const hidden = usePreferences((v) => v.hidden);
  const [peeking, setPeeking] = useState(false);
  const [recentDay, setRecentDay] = useState(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  });
  const recentSections = useMemo(
    () =>
      recentTransactionSections(
        personalReportTransactions(data),
        new Date(recentDay),
      ),
    [data, recentDay],
  );
  // Tabs remain mounted: stop the temporary reveal on blur or interruption too.
  useFocusEffect(
    useCallback(() => {
      let midnightTimer: ReturnType<typeof setTimeout> | undefined;
      const clearMidnightTimer = () => {
        if (midnightTimer !== undefined) clearTimeout(midnightTimer);
      };
      const refreshDay = () => {
        clearMidnightTimer();
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        setRecentDay(today.getTime());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        midnightTimer = setTimeout(
          refreshDay,
          tomorrow.getTime() - now.getTime() + 100,
        );
      };
      refreshDay();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refreshDay();
        else {
          clearMidnightTimer();
          setPeeking(false);
        }
      });
      return () => {
        subscription.remove();
        clearMidnightTimer();
        setPeeking(false);
      };
    }, []),
  );
  return (
    <ScreenContainer
      tabScreen
      title={APP_NAME}
      subtitle="Tài chính của bạn, rõ ràng mỗi ngày."
      scroll={false}
    >
      <SectionList
        sections={recentSections}
        keyExtractor={(transaction) => transaction.id}
        extraData={transactionIndex}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: layout.sectionGap }}>
            <HeroCard
              label="Tổng số dư"
              value={totalBalance(data.accounts, balances)}
              reveal={peeking}
              subtitle={
                hidden
                  ? 'Tất cả tài khoản · Nhấn giữ mắt để xem số dư'
                  : 'Tất cả tài khoản · VND'
              }
              rightAction={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Nhấn giữ để xem tất cả số dư"
                  accessibilityHint="Thả tay để ẩn lại tổng số dư và số dư từng tài khoản."
                  accessibilityState={{ disabled: !hidden }}
                  disabled={!hidden}
                  delayLongPress={250}
                  onLongPress={() => setPeeking(true)}
                  onPressOut={() => setPeeking(false)}
                  onTouchCancel={() => setPeeking(false)}
                  style={({ pressed }) => ({
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon
                    name={
                      hidden && !peeking ? 'eye-off-outline' : 'eye-outline'
                    }
                    color={colors.onDark}
                    size={20}
                  />
                </Pressable>
              }
            />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Ghi giao dịch"
                  icon="add-outline"
                  onPress={() => router.push('/transaction/new')}
                />
              </View>
              <View style={{ backgroundColor: colors.light, borderRadius: 14 }}>
                <IconButton
                  label="Chuyển tiền giữa tài khoản"
                  icon="swap-horizontal-outline"
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/new',
                      params: { type: 'transfer' },
                    })
                  }
                />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <SectionHeader
                title="Tài khoản"
                action="Quản lý"
                onPress={() => router.push('/accounts')}
              />
              <AppCard style={{ paddingVertical: 4, gap: 0 }}>
                {data.accounts
                  .filter((a) => !a.is_archived)
                  .map((a) => (
                    <AccountRow
                      key={a.id}
                      name={a.name}
                      type={a.type}
                      value={balances[a.id]}
                      reveal={peeking}
                      onPress={() =>
                        router.push({
                          pathname: '/accounts/[id]',
                          params: { id: a.id },
                        })
                      }
                    />
                  ))}
              </AppCard>
            </View>
            <View style={{ gap: 12 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <IconButton
                  label="Tháng trước"
                  icon="chevron-back-outline"
                  onPress={() => setDate(shiftPeriod(date, 'month', -1))}
                />
                <Text style={[s.heading, { flex: 1, textAlign: 'center' }]}>
                  {periodLabel(date, 'month')}
                </Text>
                <IconButton
                  label="Tháng sau"
                  icon="chevron-forward-outline"
                  onPress={() => setDate(shiftPeriod(date, 'month', 1))}
                />
              </View>
              <View
                style={{ flexDirection: stack ? 'column' : 'row', gap: 12 }}
              >
                <SummaryCard
                  label="Thu nhập"
                  value={summary.income}
                  kind="income"
                  style={{ flex: stack ? undefined : 1 }}
                />
                <SummaryCard
                  label="Chi tiêu"
                  value={summary.expense}
                  kind="expense"
                  style={{ flex: stack ? undefined : 1 }}
                />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <SectionHeader
                title="Công nợ"
                action="Chi tiết"
                onPress={() => router.push('/(tabs)/loans')}
              />
              <AppCard>
                <MoneyRow
                  label="Đi vay còn nợ"
                  value={totalLoanOutstanding(data, 'borrow')}
                  tone={colors.expense}
                />
                <MoneyRow
                  label="Cho vay cần thu"
                  value={totalLoanOutstanding(data, 'lend')}
                  tone={colors.primary}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xem tiền mua hộ"
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/loans',
                      params: { side: 'receivable', kind: 'purchase' },
                    })
                  }
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <MoneyRow
                    label="Mua hộ chờ hoàn →"
                    value={totalPurchaseOutstanding(data)}
                  />
                </Pressable>
                <View style={s.divider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xem thu chi hộ"
                  onPress={() => router.push('/third-party')}
                  style={{ gap: 8, minHeight: 48 }}
                >
                  <View style={s.between}>
                    <Text style={s.heading}>Thu chi hộ</Text>
                    <Icon name="chevron-forward-outline" size={17} />
                  </View>
                  <MoneyRow label="Cần thu lại" value={thirdParty.receivable} />
                  <MoneyRow label="Đang giữ hộ" value={thirdParty.holding} />
                  <Text style={s.muted}>
                    {thirdParty.open} hồ sơ cần theo dõi
                  </Text>
                </Pressable>
              </AppCard>
            </View>
            <SectionHeader
              title="Giao dịch gần đây"
              subtitle="3 ngày gần nhất"
              action="Xem tất cả"
              onPress={() => router.push('/(tabs)/transactions')}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[s.label, { paddingTop: 16, paddingBottom: 4 }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TransactionRow transaction={item} index={transactionIndex} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có giao dịch trong 3 ngày gần nhất"
            description="Ghi giao dịch mới hoặc chọn Xem tất cả để xem lịch sử."
          />
        }
      />
    </ScreenContainer>
  );
}
