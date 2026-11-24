import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Amount, Icon, s } from '../../components/ui';
import {
  isThirdPartyPersonal,
  thirdPartyEntryLabels,
} from '../../services/third-party';
import type { ThirdPartyEntry } from '../../types/third-party';
import { colors } from '../../theme';
import { StatusBadge } from '../../components/ui/primitives';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

export function ThirdPartyEntryRow({
  entry,
  accountName,
  title,
  onPress,
}: {
  entry: ThirdPartyEntry;
  accountName?: string;
  title?: string;
  onPress?: () => void;
}) {
  const personal = isThirdPartyPersonal(entry.kind);
  const { stack } = useResponsiveLayout();
  const incoming = [
    'receive',
    'reimbursement',
    'payment_refund',
    'settlement_income',
  ].includes(entry.kind);
  const color = personal
    ? incoming
      ? colors.income
      : colors.expense
    : colors.transfer;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${thirdPartyEntryLabels[entry.kind]}${title ? ` · ${title}` : ''}`}
      onPress={
        onPress ??
        (() =>
          router.push({
            pathname: '/third-party/[id]',
            params: { id: entry.case_id },
          }))
      }
      style={({ pressed }) => ({
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
        gap: 6,
      })}
    >
      <View
        style={[
          s.between,
          {
            flexDirection: stack ? 'column' : 'row',
            alignItems: stack ? 'stretch' : 'center',
          },
        ]}
      >
        <View style={[s.row, { flex: 1 }]}>
          <Icon
            name={
              personal
                ? 'document-text-outline'
                : incoming
                  ? 'arrow-down-outline'
                  : 'arrow-up-outline'
            }
            color={color}
            size={18}
          />
          <Text style={[s.text, { flex: 1 }]}>
            {thirdPartyEntryLabels[entry.kind]}
          </Text>
        </View>
        <Amount
          value={incoming ? entry.amount : -entry.amount}
          style={{ color }}
        />
      </View>
      {!!title && <Text style={s.text}>{title}</Text>}
      <Text style={s.muted}>
        {new Date(entry.occurred_at).toLocaleString('vi-VN')}
        {accountName ? ` · ${accountName}` : ''}
      </Text>
      <StatusBadge
        label={
          personal
            ? 'Thu chi cá nhân · Không đổi số dư'
            : 'Dòng tiền hộ · Không tính thu chi cá nhân'
        }
        tone="neutral"
      />
      {!!entry.note && <Text style={s.muted}>{entry.note}</Text>}
      {!!entry.settlement_id && (
        <Text style={s.muted}>
          Thuộc một lần quyết toán · Nhấn để xem / hoàn tác
        </Text>
      )}
    </Pressable>
  );
}
