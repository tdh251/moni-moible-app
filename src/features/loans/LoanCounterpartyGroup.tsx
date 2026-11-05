import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Amount, AppCard, s } from '../../components/ui';
import { colors } from '../../theme';
import type { Account, Loan } from '../../types/finance';
import type { loanMonthlyPayment } from '../../services/loans';

type LoanEntry = Loan & {
  remaining: number;
  monthly: ReturnType<typeof loanMonthlyPayment>;
};
type LoanGroup = {
  key: string;
  name: string;
  remaining: number;
  loans: LoanEntry[];
};

export function LoanCounterpartyGroup({
  group,
  lending,
  accounts,
}: {
  group: LoanGroup;
  lending: boolean;
  accounts: Account[];
}) {
  return (
    <AppCard>
      <View style={s.between}>
        <Text style={[s.heading, { flex: 1 }]}>{group.name}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.muted}>{lending ? 'Cần thu hồi' : 'Còn nợ'}</Text>
          <Amount value={group.remaining} />
        </View>
      </View>
      {group.loans.map((loan) => (
        <Pressable
          key={loan.id}
          accessibilityRole="button"
          accessibilityLabel={`${lending ? 'Khoản cho vay' : 'Khoản vay'} ${new Date(loan.occurred_at).toLocaleDateString('vi-VN')}, còn ${loan.remaining} đồng`}
          onPress={() =>
            router.push({ pathname: '/loans/[id]', params: { id: loan.id } })
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          <View
            style={{
              gap: 6,
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={s.between}>
              <Text style={[s.text, { flex: 1 }]}>
                {new Date(loan.occurred_at).toLocaleDateString('vi-VN')}
              </Text>
              <Text
                style={[
                  s.muted,
                  { color: loan.remaining > 0 ? colors.danger : colors.primary },
                ]}
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
            <Text style={s.muted}>
              {accounts.find((account) => account.id === loan.account_id)?.name}
              {' · '}
              {loan.due_at
                ? `Đến hạn ${new Date(loan.due_at).toLocaleDateString('vi-VN')}`
                : 'Không kỳ hạn'}
            </Text>
            {loan.monthly && (
              <View style={s.between}>
                <Text style={s.muted}>Trung bình/tháng</Text>
                <Amount value={loan.monthly.amount} />
              </View>
            )}
            <View style={s.between}>
              <Text style={s.muted}>{lending ? 'Cần thu hồi' : 'Còn nợ'}</Text>
              <Amount value={loan.remaining} />
            </View>
          </View>
        </Pressable>
      ))}
    </AppCard>
  );
}
