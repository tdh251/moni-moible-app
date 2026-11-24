import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppCard, Icon, ScreenContainer, s } from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import type { DebtKind, DebtSide } from '../../services/debts';
import { colors } from '../../theme';

const options: {
  kind: DebtKind;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    kind: 'lend',
    title: 'Cho vay',
    description: 'Bạn đưa tiền cho người khác và cần thu lại.',
    icon: 'arrow-up-outline',
  },
  {
    kind: 'purchase',
    title: 'Mua hộ',
    description: 'Bạn ứng tiền mua hộ và đang chờ hoàn lại.',
    icon: 'bag-handle-outline',
  },
  {
    kind: 'borrow',
    title: 'Đi vay',
    description: 'Bạn nhận tiền vay và cần hoàn trả.',
    icon: 'arrow-down-outline',
  },
];

export default function NewDebt() {
  const { side } = useLocalSearchParams<{ side?: string }>();
  const { busy } = useFinance();
  const groups: DebtSide[] =
    side === 'payable' ? ['payable', 'receivable'] : ['receivable', 'payable'];
  return (
    <ScreenContainer
      title="Thêm công nợ"
      subtitle="Bạn muốn ghi nhận khoản nào?"
      back
    >
      {groups.map((group) => (
        <View key={group} style={{ gap: 12 }}>
          <Text style={s.heading}>
            {group === 'receivable' ? 'Cần thu' : 'Cần trả'}
          </Text>
          {options
            .filter(
              (option) =>
                (option.kind === 'borrow' ? 'payable' : 'receivable') === group,
            )
            .map((option) => (
              <Pressable
                key={option.kind}
                accessibilityRole="button"
                accessibilityLabel={option.title}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() =>
                  option.kind === 'purchase'
                    ? router.replace('/purchases/new')
                    : router.replace({
                        pathname: '/loans/new',
                        params: { direction: option.kind },
                      })
                }
                style={({ pressed }) => ({
                  opacity: busy || pressed ? 0.6 : 1,
                })}
              >
                <AppCard>
                  <View style={[s.row, { gap: 14 }]}>
                    <Icon
                      name={option.icon}
                      color={
                        group === 'receivable' ? colors.primary : colors.expense
                      }
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.heading}>{option.title}</Text>
                      <Text style={s.muted}>{option.description}</Text>
                    </View>
                    <Icon name="chevron-forward-outline" />
                  </View>
                </AppCard>
              </Pressable>
            ))}
        </View>
      ))}
    </ScreenContainer>
  );
}
