import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  PrimaryButton,
  ScreenContainer,
  TextButton,
  s,
} from '../../components/ui';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { useFinance } from '../../hooks/finance';
import { purchaseOutstanding } from '../../services/purchases';
import { colors } from '../../theme';
import {
  HeroCard,
  MoneyRow,
  StatusBadge,
} from '../../components/ui/primitives';

export default function PurchaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const purchase = data.purchases?.find((row) => row.id === id);
  if (!purchase)
    return (
      <ScreenContainer title="Mua hộ" back>
        <EmptyState
          title="Không tìm thấy khoản mua hộ"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  const refunds = (data.purchaseRefunds ?? []).filter(
    (row) => row.purchase_id === id,
  );
  const remaining = purchaseOutstanding(purchase, refunds);
  const accountName = (account: string) =>
    data.accounts.find((row) => row.id === account)?.name ?? '';
  const remove = async () => {
    if (
      await ConfirmationDialog(
        'Xóa khoản mua hộ?',
        'Khoản mua hộ và mọi lần hoàn tiền liên quan sẽ bị xóa. Số dư các ví được tính lại.',
      )
    )
      if (await mutate((repo) => repo.deletePurchase(id))) router.back();
  };
  return (
    <ScreenContainer
      title="Chi tiết mua hộ"
      subtitle={purchase.person}
      back
      backDisabled={busy}
      rightAction={
        <ActionMenu
          label="Thao tác khoản mua hộ"
          disabled={busy}
          actions={[
            {
              label: 'Sửa khoản mua hộ',
              icon: 'create-outline',
              onPress: () =>
                router.push({
                  pathname: '/purchases/edit/[id]',
                  params: { id },
                }),
            },
            {
              label: 'Xóa khoản mua hộ',
              icon: 'trash-outline',
              danger: true,
              onPress: () => void remove(),
            },
          ]}
        />
      }
      footer={
        remaining > 0 ? (
          <PrimaryButton
            label="Ghi nhận hoàn tiền"
            icon="arrow-down-outline"
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: '/purchases/refund/[id]',
                params: { id },
              })
            }
          />
        ) : undefined
      }
    >
      <HeroCard
        label="Mua hộ còn chờ hoàn"
        value={remaining}
        subtitle={purchase.title}
        rightAction={
          <StatusBadge
            label={
              remaining === 0
                ? 'Đã hoàn đủ'
                : remaining < purchase.amount
                  ? 'Hoàn một phần'
                  : 'Chưa hoàn'
            }
            tone={remaining === 0 ? 'positive' : 'warning'}
          />
        }
      >
        <MoneyRow
          label="Đã ứng mua hộ"
          value={purchase.amount}
          tone={colors.onDark}
          labelTone={colors.onDarkMuted}
        />
        <MoneyRow
          label="Đã nhận hoàn"
          value={purchase.amount - remaining}
          tone={colors.onDark}
          labelTone={colors.onDarkMuted}
        />
        <Text style={[s.muted, { color: colors.onDarkMuted }]}>
          Mua hộ {purchase.person} · Không tính thu chi cá nhân
        </Text>
      </HeroCard>
      <AppCard>
        <Text style={s.label}>
          Thanh toán từ {accountName(purchase.account_id)}
        </Text>
        <Text style={s.muted}>
          {new Date(purchase.occurred_at).toLocaleString('vi-VN')}
        </Text>
        {purchase.due_at && (
          <Text style={s.muted}>
            Hạn hoàn tiền:{' '}
            {new Date(purchase.due_at).toLocaleDateString('vi-VN')}
          </Text>
        )}
        {!!purchase.note && <Text style={s.text}>{purchase.note}</Text>}
      </AppCard>
      <Text style={s.heading}>Lịch sử hoàn tiền · {refunds.length}</Text>
      {refunds.length ? (
        refunds.map((refund) => (
          <AppCard key={refund.id}>
            <View style={s.between}>
              <Amount value={refund.amount} style={{ color: colors.income }} />
              <TextButton
                label="Xóa"
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    if (
                      await ConfirmationDialog(
                        'Xóa lần hoàn tiền?',
                        'Số tiền này sẽ trở lại khoản chờ hoàn và được trừ khỏi số dư ví nhận.',
                      )
                    )
                      await mutate((repo) =>
                        repo.deletePurchaseRefund(refund.id),
                      );
                  })();
                }}
              />
            </View>
            <Text style={s.text}>
              Nhận vào {accountName(refund.account_id)}
            </Text>
            <Text style={s.muted}>
              {new Date(refund.occurred_at).toLocaleString('vi-VN')}
            </Text>
            {!!refund.note && <Text style={s.text}>{refund.note}</Text>}
          </AppCard>
        ))
      ) : (
        <EmptyState
          title="Chưa nhận hoàn tiền"
          description="Khi thực nhận tiền, ghi nhận tại đây để cập nhật ví và số tiền còn chờ hoàn."
        />
      )}
    </ScreenContainer>
  );
}
