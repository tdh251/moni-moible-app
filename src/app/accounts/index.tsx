import { FlatList, View } from 'react-native';
import { router, Redirect } from 'expo-router';
import { AppCard, ScreenContainer, s } from '../../components/ui';
import {
  AccountRow,
  HeroCard,
  SectionHeader,
} from '../../components/ui/primitives';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useFinance } from '../../hooks/finance';
import {
  accountBalances,
  totalBalance,
} from '../../services/accounting/ledger';
export default function Accounts() {
  const { data, busy } = useFinance();
  const balances = accountBalances(data);
  if (!data.onboarded) return <Redirect href="/onboarding" />;
  return (
    <ScreenContainer
      title="Tài khoản"
      back
      scroll={false}
      floatingAction={
        <FloatingAddButton
          label="Thêm tài khoản ngân hàng"
          hint="Mở màn hình thêm tài khoản ngân hàng"
          disabled={busy}
          onPress={() => router.push('/accounts/new')}
        />
      }
    >
      <FlatList
        data={data.accounts}
        keyExtractor={(a) => a.id}
        initialNumToRender={12}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <HeroCard
              label="Tổng số dư tài khoản"
              value={totalBalance(data.accounts, balances)}
              subtitle={`${data.accounts.length} tài khoản · VND`}
            />
            <SectionHeader title="Tài khoản của bạn" />
          </View>
        }
        renderItem={({ item: a }) => (
          <AppCard style={{ paddingVertical: 0, marginBottom: 8 }}>
            <AccountRow
              name={a.name}
              type={a.type}
              value={balances[a.id]}
              archived={!!a.is_archived}
              onPress={() =>
                router.push({
                  pathname: '/accounts/[id]',
                  params: { id: a.id },
                })
              }
            />
          </AppCard>
        )}
      />
    </ScreenContainer>
  );
}
