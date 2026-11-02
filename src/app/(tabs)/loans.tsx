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
  ScreenContainer,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { colors } from '../../theme';
import {
  loanBalances,
  totalLoanOutstanding,
  loanMonthlyPayment,
} from '../../services/loans';
export default function Loans() {
  const { data, reminderWarning } = useFinance();
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('borrow');
  const lending = direction === 'lend';
  const matchingLoans = (data.loans ?? []).filter(
    (loan) => (loan.direction ?? 'borrow') === direction,
  );
  const { addButtonVisible, handleScroll } = useScrollAddButton();
  const balances = loanBalances(data);
  const loans = matchingLoans
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
            {!!reminderWarning && <Text style={s.text}>{reminderWarning}</Text>}
            <Choices
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'borrow', label: 'Đi vay' },
                { value: 'lend', label: 'Cho vay' },
              ]}
            />
            <AppCard>
              <Text style={s.muted}>
                {lending ? 'Tổng cần thu hồi' : 'Tổng còn nợ'}
              </Text>
              <Amount
                value={totalLoanOutstanding(data, lending ? 'lend' : 'borrow')}
                style={{ fontSize: 30, lineHeight: 42 }}
              />
              <Text style={s.muted}>
                {matchingLoans.length}{' '}
                {lending ? 'khoản cho vay' : 'khoản vay'}
              </Text>
            </AppCard>
            <Choices
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'Tất cả' },
                { value: 'open', label: lending ? 'Chưa thu hết' : 'Còn nợ' },
                { value: 'paid', label: lending ? 'Đã thu hết' : 'Đã trả' },
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
                <View
                  style={{
                    maxWidth: '50%',
                    flexShrink: 1,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor:
                      loan.remaining > 0 ? colors.expenseLight : colors.light,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 18,
                      fontWeight: '600',
                      textAlign: 'center',
                      color:
                        loan.remaining > 0 ? colors.danger : colors.primary,
                    }}
                  >
                    {loan.remaining > 0
                      ? lending
                        ? 'Chưa thu hết'
                        : 'Còn nợ'
                      : lending
                        ? 'Đã thu hết'
                        : 'Đã trả hết'}
                  </Text>
                </View>
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
                  {lending
                    ? loan.remaining
                      ? 'Cần thu hồi'
                      : 'Đã thu hết'
                    : loan.remaining
                      ? 'Còn nợ'
                      : 'Đã trả hết'}
                </Text>
                <Amount value={loan.remaining} />
              </View>
            </AppCard>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title={
              lending
                ? 'Chưa có khoản cho vay phù hợp'
                : 'Chưa có khoản vay phù hợp'
            }
            description={
              lending
                ? 'Thêm khoản cho vay và chọn tài khoản xuất tiền để theo dõi thu hồi.'
                : 'Thêm khoản vay và chọn tài khoản nhận tiền để bắt đầu theo dõi.'
            }
            icon="people-outline"
          />
        }
      />
      <FloatingAddButton
        visible={addButtonVisible}
        label={lending ? 'Thêm cho vay' : 'Thêm vay'}
        hint={
          lending
            ? 'Mở màn hình thêm khoản cho vay mới'
            : 'Mở màn hình thêm khoản vay mới'
        }
        onPress={() =>
          router.push({ pathname: '/loans/new', params: { direction } })
        }
      />
    </ScreenContainer>
  );
}
