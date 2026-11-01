import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useScrollAddButton } from '../../hooks/useScrollAddButton';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Amount,
  AppCard,
  Choices,
  EmptyState,
  Icon,
  ScreenContainer,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import {
  loanBalances,
  totalLoanOutstanding,
  loanMonthlyPayment,
} from '../../services/loans';
export default function Loans() {
  const { data } = useFinance();
  const [status, setStatus] = useState('');
  const { addButtonVisible, handleScroll } = useScrollAddButton();
  const balances = loanBalances(data);
  const loans = (data.loans ?? [])
    .map((loan) => ({
      ...loan,
      remaining: balances.get(loan.id) ?? 0,
      monthly: loanMonthlyPayment(loan),
    }))
    .filter(
      (loan) =>
        status === '' ||
        (status === 'open' ? loan.remaining > 0 : loan.remaining === 0),
    );
  return (
    <ScreenContainer title="Khoản vay" scroll={false}>
      <FlatList
        data={loans}
        keyExtractor={(loan) => loan.id}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 12, paddingBottom: 96 }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <AppCard>
              <Text style={s.muted}>Tổng còn nợ</Text>
              <Amount
                value={totalLoanOutstanding(data)}
                style={{ fontSize: 30, lineHeight: 42 }}
              />
              <Text style={s.muted}>
                {data.loans?.length ?? 0} khoản vay/mượn
              </Text>
            </AppCard>
            <Choices
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'Tất cả' },
                { value: 'open', label: 'Còn nợ' },
                { value: 'paid', label: 'Đã trả' },
              ]}
            />
          </View>
        }
        renderItem={({ item: loan }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/loans/[id]', params: { id: loan.id } })
            }
          >
            <AppCard>
              <View style={s.between}>
                <Text style={[s.text, { flex: 1 }]}>{loan.lender}</Text>
                <Icon name="chevron-forward-outline" />
              </View>
              <Text style={s.muted}>
                {new Date(loan.occurred_at).toLocaleDateString('vi-VN')} ·{' '}
                {data.accounts.find((a) => a.id === loan.account_id)?.name}
              </Text>
              <Text style={s.muted}>
                {loan.due_at
                  ? `Đến hạn: ${new Date(loan.due_at).toLocaleDateString('vi-VN')}`
                  : 'Không kỳ hạn'}
              </Text>
              {loan.monthly && (
                <View style={s.between}>
                  <Text style={s.muted}>Trung bình/tháng</Text>
                  <Amount value={loan.monthly.amount} />
                </View>
              )}
              <View style={s.between}>
                <Text style={s.muted}>
                  {loan.remaining ? 'Còn nợ' : 'Đã trả hết'}
                </Text>
                <Amount value={loan.remaining} />
              </View>
            </AppCard>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có khoản vay/mượn phù hợp"
            description="Thêm khoản vay và chọn tài khoản nhận tiền để bắt đầu theo dõi."
            icon="people-outline"
          />
        }
      />
      <FloatingAddButton
        visible={addButtonVisible}
        label="Thêm vay/mượn"
        hint="Mở màn hình thêm khoản vay/mượn mới"
        onPress={() => router.push('/loans/new')}
      />
    </ScreenContainer>
  );
}
