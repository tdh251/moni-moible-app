import { AppState, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Amount,
  AppCard,
  EmptyState,
  Icon,
  ScreenContainer,
  TransactionRow,
  s,
} from '../../components/ui';
import { colors } from '../../theme';
import { APP_NAME } from '../../constants/app';
import { useFinance } from '../../hooks/finance';
import { usePreferences, initialFilters } from '../../stores/preferences';
import {
  accountBalances,
  statistics,
  totalBalance,
  shiftPeriod,
} from '../../services/accounting/ledger';
import { periodLabel, typeNames } from '../../utils/format';
import type { TransactionType } from '../../types/finance';
export default function Dashboard() {
  const { data } = useFinance();
  const balances = accountBalances(data);
  const [date, setDate] = useState(new Date().toISOString());
  const summary = statistics(data, { ...initialFilters(), date });
  const hidden = usePreferences((v) => v.hidden);
  const [peeking, setPeeking] = useState(false);
  // Tabs remain mounted: stop the temporary reveal on blur or interruption too.
  useFocusEffect(
    useCallback(() => {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') setPeeking(false);
      });
      return () => {
        subscription.remove();
        setPeeking(false);
      };
    }, []),
  );
  return (
    <ScreenContainer
      title={APP_NAME}
      subtitle="Chào bạn, hôm nay mình chi tiêu thế nào?"
    >
      <AppCard
        style={{
          backgroundColor: colors.balance,
          borderColor: colors.balance,
          padding: 24,
        }}
      >
        <View style={s.between}>
          <Text style={{ color: colors.light, fontSize: 14 }}>TỔNG SỐ DƯ</Text>
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
              name={hidden && !peeking ? 'eye-off-outline' : 'eye-outline'}
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
      <View style={s.between}>
        <Text style={s.heading}>Tài khoản của bạn</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/accounts')}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            Quản lý →
          </Text>
        </Pressable>
      </View>
      {data.accounts
        .filter((a) => !a.is_archived)
        .map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/accounts/[id]', params: { id: a.id } })
            }
          >
            <AppCard>
              <View style={s.between}>
                <View style={s.row}>
                  <Icon
                    name={a.type === 'cash' ? 'wallet-outline' : 'card-outline'}
                  />
                  <Text style={s.text}>{a.name}</Text>
                </View>
                <Amount value={balances[a.id]} reveal={peeking} />
              </View>
            </AppCard>
          </Pressable>
        ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['income', 'expense', 'transfer'] as TransactionType[]).map(
          (type, i) => (
            <Pressable
              accessibilityRole="button"
              key={type}
              onPress={() =>
                router.push({ pathname: '/transaction/new', params: { type } })
              }
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 15,
                backgroundColor:
                  type === 'expense' ? colors.expenseLight : colors.light,
                borderRadius: 18,
                gap: 8,
              }}
            >
              <Icon
                color={type === 'expense' ? colors.expense : colors.primary}
                name={
                  [
                    'arrow-down-outline',
                    'arrow-up-outline',
                    'swap-horizontal-outline',
                  ][i]
                }
              />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {typeNames[type]}
              </Text>
            </Pressable>
          ),
        )}
      </View>
      <View style={s.between}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          hitSlop={10}
          onPress={() => setDate(shiftPeriod(date, 'month', -1))}
        >
          <Icon name="chevron-back-outline" />
        </Pressable>
        <Text style={s.heading}>{periodLabel(date, 'month')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          hitSlop={10}
          onPress={() => setDate(shiftPeriod(date, 'month', 1))}
        >
          <Icon name="chevron-forward-outline" />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <AppCard style={{ flex: 1, padding: 15 }}>
          <Text style={s.muted}>↓ Thu nhập</Text>
          <Amount value={summary.income} style={{ color: colors.income }} />
        </AppCard>
        <AppCard style={{ flex: 1, padding: 15 }}>
          <Text style={s.muted}>↑ Chi tiêu</Text>
          <Amount value={summary.expense} style={{ color: colors.expense }} />
        </AppCard>
      </View>
      <View style={s.between}>
        <Text style={s.heading}>Giao dịch gần đây</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/transactions')}
        >
          <Text style={{ color: colors.primary }}>Xem tất cả →</Text>
        </Pressable>
      </View>
      <AppCard>
        {data.transactions.length ? (
          data.transactions
            .slice(0, 5)
            .map((t) => (
              <TransactionRow key={t.id} transaction={t} ledger={data} />
            ))
        ) : (
          <EmptyState
            title="Sổ tiền còn trống"
            description="Ghi lại khoản thu hoặc chi đầu tiên bằng các nút ở trên."
          />
        )}
      </AppCard>
    </ScreenContainer>
  );
}
