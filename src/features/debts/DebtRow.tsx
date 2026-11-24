import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppCard, Icon, s } from '../../components/ui';
import { debtKindLabels, type DebtEntry } from '../../services/debts';
import { MoneyRow, StatusBadge } from '../../components/ui/primitives';
import { colors } from '../../theme';

export function DebtRow({
  entry,
  accountName,
  now,
}: {
  entry: DebtEntry;
  accountName: string;
  now: number;
}) {
  const collecting = entry.side === 'receivable';
  const settled = entry.remaining === 0;
  const overdue = !settled && !!entry.dueAt && Date.parse(entry.dueAt) < now;
  const tint = collecting ? colors.primary : colors.expense;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${debtKindLabels[entry.kind]} · ${entry.person} · ${entry.title}`}
      onPress={() =>
        router.push({
          pathname:
            entry.kind === 'purchase' ? '/purchases/[id]' : '/loans/[id]',
          params: { id: entry.id },
        })
      }
      style={({ pressed }) => ({
        marginBottom: 10,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <AppCard>
        <View style={[s.between, { gap: 12 }]}>
          <View style={[s.row, { flex: 1 }]}>
            <Icon
              name={
                entry.kind === 'purchase'
                  ? 'bag-handle-outline'
                  : 'swap-horizontal-outline'
              }
              color={tint}
              size={18}
            />
            <Text style={[s.muted, { color: tint }]}>
              {debtKindLabels[entry.kind]}
            </Text>
          </View>
          <StatusBadge
            tone={
              settled
                ? 'neutral'
                : overdue
                  ? 'danger'
                  : collecting
                    ? 'brand'
                    : 'warning'
            }
            label={
              settled
                ? 'Đã xong'
                : overdue
                  ? 'Quá hạn'
                  : collecting
                    ? 'Chờ thu'
                    : 'Chưa trả hết'
            }
          />
        </View>
        <Text style={s.heading}>{entry.title}</Text>
        <MoneyRow
          label={collecting ? 'Còn cần thu' : 'Còn cần trả'}
          value={entry.remaining}
          tone={settled ? colors.muted : tint}
          strong
        />
        <Text style={s.muted}>
          {new Date(entry.occurredAt).toLocaleDateString('vi-VN')} ·{' '}
          {accountName}
        </Text>
        {entry.dueAt && (
          <Text style={[s.muted, overdue && { color: colors.danger }]}>
            {entry.kind === 'purchase' ? 'Hạn hoàn' : 'Đến hạn'}:{' '}
            {new Date(entry.dueAt).toLocaleDateString('vi-VN')}
          </Text>
        )}
        {entry.monthly && !settled && (
          <MoneyRow label="Trung bình/tháng" value={entry.monthly.amount} />
        )}
      </AppCard>
    </Pressable>
  );
}
