import { AppState, Pressable, SectionList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  createTransactionListIndex,
  recentTransactionSections,
} from '../../services/transaction-list';
import {
  Amount,
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
import { useFinance } from '../../hooks/finance';
import { usePreferences, initialFilters } from '../../stores/preferences';
import {
  accountBalances,
  statistics,
  totalBalance,
  shiftPeriod,
} from '../../services/accounting/ledger';
import { periodLabel } from '../../utils/format';
export default function Dashboard() {
  const { data } = useFinance();
  const balances = useMemo(() => accountBalances(data), [data]);
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
    () => recentTransactionSections(data.transactions, new Date(recentDay)),
    [data.transactions, recentDay],
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
      subtitle="Chào bạn, hôm nay mình chi tiêu thế nào?"
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
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: layout.sectionGap }}>
            <AppCard
              style={{
                backgroundColor: colors.balance,
                borderColor: colors.balance,
                padding: 24,
              }}
            >
              <View style={s.between}>
                <Text style={{ color: colors.light, fontSize: 14 }}>
                  TỔNG SỐ DƯ
                </Text>
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
                    minWidth: 48,
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon
                    name={
                      hidden && !peeking ? 'eye-off-outline' : 'eye-outline'
                    }
                    color={colors.light}
                  />
                </Pressable>
              </View>
              <Amount
                value={totalBalance(data.accounts, balances)}
                reveal={peeking}
                style={{ color: 'white', fontSize: 32, lineHeight: 44 }}
              />
              <Text style={{ color: '#AFCABB', fontSize: 12 }}>
                Tất cả tài khoản · VND
                {hidden ? ' · Nhấn giữ mắt để xem số dư' : ''}
              </Text>
            </AppCard>
            <PrimaryButton
              label="Ghi giao d?ch"
              icon="add-outline"
              onPress={() => router.push('/transaction/new')}
            />
            <View style={s.between}>
              <Text style={s.heading}>Tài khoản của bạn</Text>
              <Pressable
                accessibilityRole="button"
                style={s.textAction}
                onPress={() => router.push('/accounts')}
              >
                <Text style={s.textActionLabel}>Quản lý →</Text>
              </Pressable>
            </View>
            {data.accounts
              .filter((a) => !a.is_archived)
              .map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/accounts/[id]',
                      params: { id: a.id },
                    })
                  }
                >
                  <AppCard>
                    <View style={s.between}>
                      <View style={s.row}>
                        <Icon
                          name={
                            a.type === 'cash'
                              ? 'wallet-outline'
                              : 'card-outline'
                          }
                        />
                        <Text style={s.text}>{a.name}</Text>
                      </View>
                      <Amount value={balances[a.id]} reveal={peeking} />
                    </View>
                  </AppCard>
                </Pressable>
              ))}
            <View style={s.between}>
              <IconButton
                label="Tháng trước"
                icon="chevron-back-outline"
                onPress={() => setDate(shiftPeriod(date, 'month', -1))}
              />
              <Text style={s.heading}>{periodLabel(date, 'month')}</Text>
              <IconButton
                label="Tháng sau"
                icon="chevron-forward-outline"
                onPress={() => setDate(shiftPeriod(date, 'month', 1))}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <AppCard style={{ flex: 1, padding: 15 }}>
                <Text style={s.muted}>↓ Thu nhập</Text>
                <Amount
                  value={summary.income}
                  style={{ color: colors.income }}
                />
              </AppCard>
              <AppCard style={{ flex: 1, padding: 15 }}>
                <Text style={s.muted}>↑ Chi tiêu</Text>
                <Amount
                  value={summary.expense}
                  style={{ color: colors.expense }}
                />
              </AppCard>
            </View>
            <View style={s.between}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.heading}>Giao dịch gần đây</Text>
                <Text style={s.muted}>3 ngày gần nhất</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={s.textAction}
                onPress={() => router.push('/(tabs)/transactions')}
              >
                <Text style={s.textActionLabel}>Xem tất cả →</Text>
              </Pressable>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              marginTop: layout.sectionGap,
              backgroundColor: colors.card,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 0,
            }}
          >
            <Text style={s.fieldLabel}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.card, paddingHorizontal: 20 }}>
            <TransactionRow transaction={item} index={transactionIndex} />
          </View>
        )}
        renderSectionFooter={() => (
          <View
            style={{
              height: 12,
              backgroundColor: colors.card,
              borderBottomLeftRadius: 22,
              borderBottomRightRadius: 22,
            }}
          />
        )}
        ListEmptyComponent={
          <AppCard style={{ marginTop: layout.sectionGap }}>
            <EmptyState
              title="Chưa có giao dịch trong 3 ngày gần nhất"
              description="Ghi giao dịch mới bằng các nút ở trên hoặc chọn Xem tất cả để xem lịch sử."
            />
          </AppCard>
        }
      />
    </ScreenContainer>
  );
}
