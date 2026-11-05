import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import {
  AppCard,
  Choices,
  EmptyState,
  ScreenContainer,
  s,
  Amount,
} from '../../components/ui';
import { useScrollAddButton } from '../../hooks/useScrollAddButton';
import { useFinance } from '../../hooks/finance';
import {
  loanBalances,
  loanMonthlyPayment,
  totalLoanOutstanding,
} from '../../services/loans';
import { LoanCounterpartyGroup } from '../../features/loans/LoanCounterpartyGroup';
import type { Loan } from '../../types/finance';

type LoanEntry = Loan & {
  remaining: number;
  monthly: ReturnType<typeof loanMonthlyPayment>;
};
type LoanGroup = { key: string; name: string; loans: LoanEntry[]; remaining: number };

export default function Loans() {
  const { data, reminderWarning } = useFinance();
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('borrow');
  const lending = direction === 'lend';
  const matchingLoans = useMemo(
    () => (data.loans ?? []).filter((loan) => (loan.direction ?? 'borrow') === direction),
    [data.loans, direction],
  );
  const { addButtonVisible, handleScroll } = useScrollAddButton();
  const balances = useMemo(() => loanBalances(data), [data]);
  const groups = useMemo(() => {
    const byCounterparty = new Map<string, LoanGroup>();
    for (const loan of matchingLoans) {
      const entry: LoanEntry = {
        ...loan,
        remaining: balances.get(loan.id) ?? 0,
        monthly: loanMonthlyPayment(loan),
      };
      if (
        status !== '' &&
        (status === 'open' ? entry.remaining <= 0 : entry.remaining !== 0)
      )
        continue;
      const name = loan.lender.trim();
      const key = name.toLocaleLowerCase('vi-VN');
      const existing = byCounterparty.get(key);
      if (existing) {
        existing.loans.push(entry);
        existing.remaining += entry.remaining;
      } else {
        byCounterparty.set(key, { key, name, loans: [entry], remaining: entry.remaining });
      }
    }
    return [...byCounterparty.values()]
      .map((group) => ({
        ...group,
        loans: group.loans.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [matchingLoans, balances, status]);

  return (
    <ScreenContainer title="Khoản vay" scroll={false}>
      <FlatList
        data={groups}
        keyExtractor={(group) => group.key}
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
        renderItem={({ item }) => (
          <LoanCounterpartyGroup
            group={item}
            lending={lending}
            accounts={data.accounts}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={lending ? 'Chưa có khoản cho vay phù hợp' : 'Chưa có khoản vay phù hợp'}
            description={
              lending
                ? 'Thêm khoản cho vay để theo dõi người vay và số tiền cần thu hồi.'
                : 'Thêm khoản vay để theo dõi chủ nợ và số tiền còn nợ.'
            }
            icon="people-outline"
          />
        }
      />
      <FloatingAddButton
        visible={addButtonVisible}
        label={lending ? 'Thêm cho vay' : 'Thêm vay'}
        hint={lending ? 'Thêm khoản cho vay mới' : 'Thêm khoản vay mới'}
        onPress={() =>
          router.push({ pathname: '/loans/new', params: { direction } })
        }
      />
    </ScreenContainer>
  );
}
