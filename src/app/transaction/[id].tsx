import { TagBadges } from '../../features/tags/TagBadges';
import {
  itemCategoryIds,
  transactionCategoryTags,
} from '../../services/categories/tags';
import { categoryPath } from '../../services/categories/hierarchy';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  Icon,
  ScreenContainer,
  TextButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { typeNames } from '../../utils/format';
import { colors } from '../../theme';
import { StatusBadge } from '../../components/ui/primitives';
import { ActionMenu } from '../../components/ui/ActionMenu';
import {
  calculateReceipt,
  parseAdjustments,
  adjustmentLabel,
} from '../../services/accounting/receipt';
export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const t = data.transactions.find((x) => x.id === id);
  if (!t)
    return (
      <ScreenContainer title="Giao dịch" back>
        <EmptyState
          title="Không tìm thấy giao dịch"
          description="Giao dịch có thể đã được xóa."
        />
      </ScreenContainer>
    );
  const tags = transactionCategoryTags(t);
  const items = data.items.filter((i) => i.transaction_id === id);
  const receipt = items.length
    ? calculateReceipt(items, parseAdjustments(t.adjustments_json))
    : null;
  const name = (accountId: string | null) =>
    data.accounts.find((a) => a.id === accountId)?.name ?? '';
  const category = (categoryId: string | null) =>
    categoryPath(data.categories, categoryId);
  const remove = async () => {
    if (
      await ConfirmationDialog(
        'Xóa giao dịch?',
        `“${t.title}” sẽ bị xóa và số dư được tính lại. Thao tác có thể bị từ chối nếu làm âm số dư lịch sử.`,
        true,
      )
    ) {
      if (await mutate((repo) => repo.deleteTransaction(id))) router.back();
    }
  };
  const duplicate = async () => {
    if (busy) return;
    const draftId = randomUUID();
    if (await mutate((repo) => repo.duplicateTransaction(id, draftId)))
      router.push({
        pathname: '/transaction/drafts/[id]',
        params: { id: draftId },
      });
  };
  return (
    <ScreenContainer
      title="Chi tiết giao dịch"
      back
      rightAction={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextButton
            label="Sửa"
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: '/transaction/edit/[id]',
                params: { id },
              })
            }
          />
          <ActionMenu
            label="Thao tác giao dịch"
            disabled={busy}
            actions={[
              {
                label: 'Nhân bản thành bản nháp',
                icon: 'copy-outline',
                onPress: () => void duplicate(),
              },
              {
                label: 'Xóa giao dịch',
                icon: 'trash-outline',
                danger: true,
                onPress: () => void remove(),
              },
            ]}
          />
        </View>
      }
    >
      <AppCard>
        <View
          style={{
            alignSelf: 'center',
            padding: 14,
            borderRadius: 16,
            backgroundColor:
              t.type === 'expense'
                ? colors.expenseLight
                : t.type === 'income'
                  ? colors.incomeLight
                  : colors.transferLight,
          }}
        >
          <Icon
            name={
              t.type === 'transfer'
                ? 'swap-horizontal-outline'
                : (data.categories.find((c) => c.id === t.category_id)?.icon ??
                  'receipt-outline')
            }
            size={28}
            color={
              t.type === 'expense'
                ? colors.expense
                : t.type === 'income'
                  ? colors.income
                  : colors.transfer
            }
          />
        </View>
        <View style={{ alignItems: 'center' }}>
          <StatusBadge
            label={typeNames[t.type]}
            tone={
              t.type === 'expense'
                ? 'warning'
                : t.type === 'income'
                  ? 'positive'
                  : 'neutral'
            }
          />
        </View>
        <Text style={[s.heading, { textAlign: 'center' }]}>{t.title}</Text>
        <Amount
          value={t.amount}
          style={{
            fontSize: 32,
            lineHeight: 42,
            textAlign: 'center',
            color: t.type === 'expense' ? colors.expense : colors.primary,
          }}
        />
        {t.exclude_from_balance === 1 && (
          <Text style={[s.muted, { color: colors.primary }]}>
            Không tính vào số dư · vẫn tính vào thống kê thu/chi
          </Text>
        )}
        <Text style={[s.muted, { textAlign: 'center' }]}>
          {new Date(t.occurred_at).toLocaleString('vi-VN')}
        </Text>
        <View style={s.divider} />
        {t.source_account_id && (
          <Text style={s.text}>Từ: {name(t.source_account_id)}</Text>
        )}
        {t.destination_account_id && (
          <Text style={s.text}>Đến: {name(t.destination_account_id)}</Text>
        )}
        {t.category_id && t.category_split !== 1 && !tags.length && (
          <Text style={s.text}>Danh mục: {category(t.category_id)}</Text>
        )}
        {tags.map((id) => (
          <Text key={id} style={s.text}>
            Danh mục: {category(id)}
          </Text>
        ))}
        <TagBadges transaction={t} tags={data.tags ?? []} />
        {!!t.note && <Text style={s.text}>{t.note}</Text>}
        {t.type === 'transfer' && (
          <Text style={s.muted}>
            Chuyển nội bộ không ảnh hưởng tổng tài sản, thu nhập hoặc chi tiêu.
          </Text>
        )}
      </AppCard>
      {!!items.length && (!tags.length || t.category_split !== 1) && (
        <AppCard>
          <Text style={s.heading}>
            {t.category_split === 1
              ? `Phân bổ · ${items.length} danh mục`
              : `Hóa đơn · ${items.length} mục`}
          </Text>
          {items.map((i) => (
            <View key={i.id} style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{i.name}</Text>
                <Text style={s.muted}>
                  {itemCategoryIds(i).map(category).join(' · ')}
                </Text>
                <TagBadges transaction={i} tags={data.tags ?? []} />
              </View>
              <Amount value={i.amount} />
            </View>
          ))}
          {receipt && t.category_split !== 1 && (
            <>
              <View style={s.divider} />
              <View style={s.between}>
                <Text style={s.text}>Tạm tính</Text>
                <Amount value={receipt.subtotal} />
              </View>
              {receipt.lines.map((line) => (
                <View key={line.id} style={s.between}>
                  <Text style={[s.text, { flex: 1 }]}>
                    {adjustmentLabel(line)}
                  </Text>
                  <Amount value={line.amount} />
                </View>
              ))}
              <View style={s.between}>
                <Text style={s.heading}>Tổng thanh toán</Text>
                <Amount value={receipt.total} />
              </View>
              {receipt.lines.length > 0 && (
                <Text style={s.muted}>
                  Thống kê phân bổ tổng sau điều chỉnh theo tỷ trọng tiền của
                  từng mục.
                </Text>
              )}
            </>
          )}
        </AppCard>
      )}
    </ScreenContainer>
  );
}
