import { Pressable, Text, View } from 'react-native';
import { router, Redirect } from 'expo-router';
import {
  Amount,
  AppCard,
  Icon,
  PrimaryButton,
  ScreenContainer,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import {
  accountBalances,
  totalBalance,
} from '../../services/accounting/ledger';
import { colors } from '../../theme';
export default function Accounts() {
  const { data } = useFinance();
  const balances = accountBalances(data);
  if (!data.onboarded) return <Redirect href="/onboarding" />;
  return (
    <ScreenContainer
      title="Tài khoản"
      subtitle="Tiền của bạn, trong một góc nhìn."
      back
    >
      <AppCard
        style={{ backgroundColor: colors.balance, borderColor: colors.balance }}
      >
        <Text style={{ color: colors.light }}>Tổng số dư</Text>
        <Amount
          value={totalBalance(data.accounts, balances)}
          style={{ color: 'white', fontSize: 28, lineHeight: 40 }}
        />
      </AppCard>
      {data.accounts.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/accounts/[id]', params: { id: a.id } })
          }
        >
          <AppCard>
            <View style={s.row}>
              <Icon
                name={a.type === 'cash' ? 'wallet-outline' : 'card-outline'}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.heading}>{a.name}</Text>
                <Text style={s.muted}>
                  {a.is_archived
                    ? 'Đã lưu trữ'
                    : a.type === 'cash'
                      ? 'Tiền mặt'
                      : 'Ngân hàng'}
                </Text>
              </View>
              <Icon name="chevron-forward-outline" size={18} />
            </View>
            <Amount value={balances[a.id]} style={{ fontSize: 22 }} />
          </AppCard>
        </Pressable>
      ))}
      <PrimaryButton
        label="Thêm tài khoản ngân hàng"
        icon="add-outline"
        onPress={() => router.push('/accounts/new')}
      />
    </ScreenContainer>
  );
}
