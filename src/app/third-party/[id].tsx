import { useMemo } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { useFinance } from '../../hooks/finance';
import {
  readThirdPartySettlement,
  thirdPartyBalances,
  thirdPartyEntryOrder,
  thirdPartyFinancialLabels,
  thirdPartyStatusLabels,
} from '../../services/third-party';
import { transactionTagIds } from '../../services/tags';
import type { ThirdPartyStatus } from '../../types/third-party';
import { ThirdPartyEntryRow } from '../../features/third-party/ThirdPartyEntryRow';
import {
  Disclosure,
  HeroCard,
  MoneyRow,
  StatusBadge,
} from '../../components/ui/primitives';

export default function ThirdPartyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const item = data.thirdPartyCases?.find((row) => row.id === id);
  const balances = useMemo(() => thirdPartyBalances(data), [data]);
  const entries = useMemo(
    () =>
      (data.thirdPartyEntries ?? [])
        .filter((e) => e.case_id === id)
        .sort((a, b) => thirdPartyEntryOrder(b, a)),
    [data.thirdPartyEntries, id],
  );
  const journals = useMemo(
    () =>
      (data.thirdPartySettlements ?? []).filter(
        (record) => record.case_id === id,
      ),
    [data.thirdPartySettlements, id],
  );
  const accounts = useMemo(
    () => new Map(data.accounts.map((a) => [a.id, a.name])),
    [data.accounts],
  );
  if (!item)
    return (
      <ScreenContainer title="Thu chi hộ" back>
        <EmptyState
          title="Không tìm thấy hồ sơ"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  const balance = balances.get(id)!;
  const closed = item.status === 'completed';
  const changeStatus = async (value: ThirdPartyStatus | 'reopen') => {
    if (
      !(await ConfirmationDialog(
        value === 'reopen'
          ? 'Mở lại hồ sơ?'
          : value === 'cancelled'
            ? 'Hủy nghiệp vụ?'
            : 'Đổi trạng thái hồ sơ?',
        value === 'cancelled'
          ? 'Các giao dịch, số dư và công nợ vẫn được giữ nguyên. Bạn vẫn cần xử lý tiền còn giữ hộ / cần thu.'
          : 'Chỉ đổi trạng thái công việc, không tự tạo hoặc xóa dòng tiền.',
      ))
    )
      return;
    if (
      await mutate((repo) => repo.setThirdPartyStatus(id, value, item.revision))
    )
      Alert.alert(
        'Đã cập nhật',
        value === 'reopen' ? 'Đã mở lại hồ sơ.' : thirdPartyStatusLabels[value],
      );
  };
  const undo = async (settlementId: string) => {
    if (closed) {
      Alert.alert(
        'Hồ sơ đã hoàn tất',
        'Chọn Mở lại hồ sơ trong menu trước khi hoàn tác quyết toán.',
      );
      return;
    }
    if (
      await ConfirmationDialog(
        'Hoàn tác lần quyết toán?',
        'Gỡ toàn bộ bút toán nhận / trả tiền và thu chi cá nhân của lần này. Số dư, báo cáo và chênh lệch được tính lại. Thao tác bị từ chối nếu ảnh hưởng tới lịch sử phụ thuộc.',
      )
    )
      if (
        await mutate((repo) =>
          repo.undoThirdPartySettlement(settlementId, item.revision),
        )
      )
        Alert.alert('Đã hoàn tác', 'Công nợ và báo cáo đã được tính lại.');
  };
  const remove = async () => {
    if (
      await ConfirmationDialog(
        'Xóa hồ sơ chưa có lịch sử?',
        'Chỉ xóa hồ sơ chưa có bút toán hoặc quyết toán. Hồ sơ đã có lịch sử nên dùng Hủy nghiệp vụ.',
      )
    )
      if (await mutate((repo) => repo.deleteThirdPartyCase(id, item.revision)))
        router.back();
  };
  return (
    <ScreenContainer
      title="Thu chi hộ"
      subtitle={item.person}
      back
      scroll={false}
      rightAction={
        <ActionMenu
          label="Thao tác hồ sơ thu chi hộ"
          disabled={busy}
          actions={[
            ...(closed || item.status === 'cancelled'
              ? [
                  {
                    label: 'Mở lại hồ sơ',
                    icon: 'refresh-outline' as const,
                    onPress: () => void changeStatus('reopen'),
                  },
                ]
              : []),
            ...(!closed
              ? [
                  {
                    label: 'Sửa thông tin',
                    icon: 'create-outline' as const,
                    onPress: () =>
                      router.push({
                        pathname: '/third-party/edit/[id]',
                        params: { id },
                      }),
                  },
                  ...(item.status !== 'cancelled' && item.status !== 'fulfilled'
                    ? [
                        {
                          label: 'Đánh dấu đã thực hiện',
                          icon: 'checkmark-circle-outline' as const,
                          onPress: () => void changeStatus('fulfilled'),
                        },
                      ]
                    : []),
                  ...((item.status === 'fulfilled' ||
                    item.status === 'cancelled') &&
                  balance.difference === 0
                    ? [
                        {
                          label: 'Hoàn tất hồ sơ',
                          icon: 'checkmark-done-outline' as const,
                          onPress: () => void changeStatus('completed'),
                        },
                      ]
                    : []),
                  ...(item.status !== 'cancelled'
                    ? [
                        {
                          label: 'Hủy nghiệp vụ, giữ lịch sử',
                          icon: 'close-circle-outline' as const,
                          onPress: () => void changeStatus('cancelled'),
                        },
                      ]
                    : []),
                ]
              : []),
            ...(!entries.length && !journals.length
              ? [
                  {
                    label: 'Xóa hồ sơ trống',
                    icon: 'trash-outline' as const,
                    danger: true,
                    onPress: () => void remove(),
                  },
                ]
              : []),
          ]}
        />
      }
      footer={
        !closed ? (
          <View style={{ gap: 10 }}>
            <PrimaryButton
              label={
                balance.difference ? 'Quyết toán' : 'Quyết toán / hoàn tất'
              }
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname: '/third-party/settle/[id]',
                  params: { id },
                })
              }
            />
            <SecondaryButton
              label="Thêm bút toán"
              icon="add-outline"
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname: '/third-party/entry/new',
                  params: { caseId: id },
                })
              }
            />
          </View>
        ) : undefined
      }
    >
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <HeroCard
              label={thirdPartyFinancialLabels[balance.financialStatus]}
              value={Math.abs(balance.difference)}
              subtitle={item.title}
              rightAction={
                <StatusBadge
                  label={thirdPartyStatusLabels[item.status]}
                  tone={closed ? 'positive' : 'neutral'}
                />
              }
            />
            {!closed && !['fulfilled', 'cancelled'].includes(item.status) && (
              <View style={{ gap: 8 }}>
                {item.status === 'pending' && (
                  <SecondaryButton
                    label="Bắt đầu thực hiện"
                    disabled={busy}
                    onPress={() => void changeStatus('in_progress')}
                  />
                )}
                {!closed &&
                  item.status !== 'fulfilled' &&
                  item.status !== 'cancelled' && (
                    <SecondaryButton
                      label="Đã thực hiện / giao đồ"
                      disabled={busy}
                      onPress={() => void changeStatus('fulfilled')}
                    />
                  )}
              </View>
            )}
            <AppCard>
              <Text style={s.heading}>Tổng hợp tài chính</Text>
              {[
                ['Nhận tiền trước', balance.receive],
                ['Nhận lại tiền ứng', balance.reimbursement],
                ['Nhà bán hoàn tiền', balance.payment_refund],
                ['Đã thanh toán hộ', balance.payment],
                ['Đã trả lại', balance.refund],
                ['Giữ lại thành thu nhập', balance.personalIncome],
                ['Tự chịu thành chi tiêu', balance.personalExpense],
              ].map(([label, amount]) => (
                <MoneyRow
                  key={String(label)}
                  label={String(label)}
                  value={Number(amount)}
                />
              ))}
            </AppCard>
            <AppCard>
              <Disclosure title="Thông tin hồ sơ">
                <View style={{ gap: 12 }}>
                  <Text style={s.text}>{item.person}</Text>
                  {!!item.description && (
                    <Text style={s.text}>{item.description}</Text>
                  )}
                  <Text style={s.muted}>
                    Bắt đầu: {new Date(item.started_at).toLocaleString('vi-VN')}
                  </Text>
                  {!!item.due_at && (
                    <Text style={s.muted}>
                      Hạn quyết toán:{' '}
                      {new Date(item.due_at).toLocaleDateString('vi-VN')}
                    </Text>
                  )}
                  {!!item.completed_at && (
                    <Text style={s.muted}>
                      Hoàn tất:{' '}
                      {new Date(item.completed_at).toLocaleString('vi-VN')}
                    </Text>
                  )}
                  {item.expected_amount !== null && (
                    <View style={[s.between, { flexWrap: 'wrap' }]}>
                      <Text style={s.muted}>Dự kiến (tham khảo)</Text>
                      <Amount value={item.expected_amount} />
                    </View>
                  )}
                  {!!item.note && <Text style={s.text}>{item.note}</Text>}
                  {transactionTagIds(item).length > 0 && (
                    <Text style={s.muted}>
                      Tag:{' '}
                      {data.tags
                        ?.filter((tag) =>
                          transactionTagIds(item).includes(tag.id),
                        )
                        .map((tag) => tag.name)
                        .join(' · ')}
                    </Text>
                  )}
                </View>
              </Disclosure>
            </AppCard>
            <Text style={s.heading}>Lịch sử bút toán</Text>
          </View>
        }
        renderItem={({ item: entry }) => (
          <ThirdPartyEntryRow
            entry={entry}
            accountName={accounts.get(entry.account_id ?? '')}
            onPress={() => {
              if (entry.settlement_id) void undo(entry.settlement_id);
              else
                router.push({
                  pathname: '/third-party/entry/edit/[id]',
                  params: { id: entry.id },
                });
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có bút toán"
            description="Nhận tiền hoặc thanh toán hộ khi dòng tiền thực tế phát sinh."
          />
        }
        ListFooterComponent={
          journals.length ? (
            <View style={{ gap: 12, marginTop: 24 }}>
              <Text style={s.heading}>Nhật ký quyết toán</Text>
              {journals.map((record) => {
                const request = readThirdPartySettlement(record);
                return (
                  <AppCard key={record.id}>
                    <Text style={s.text}>
                      {record.undone_at ? 'Đã hoàn tác' : 'Đang áp dụng'} ·{' '}
                      {new Date(request.occurred_at).toLocaleString('vi-VN')}
                    </Text>
                    <View style={[s.between, { flexWrap: 'wrap' }]}>
                      <Text style={s.muted}>Phần tiền thực tế</Text>
                      <Amount value={request.cash_amount} />
                    </View>
                    <View style={[s.between, { flexWrap: 'wrap' }]}>
                      <Text style={s.muted}>Phần thu chi cá nhân</Text>
                      <Amount value={request.personal_amount} />
                    </View>
                    {!!request.note && (
                      <Text style={s.muted}>{request.note}</Text>
                    )}
                    {record.undone_at ? (
                      <Text style={s.muted}>
                        Hoàn tác lúc{' '}
                        {new Date(record.undone_at).toLocaleString('vi-VN')}
                      </Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void undo(record.id)}
                        style={s.textAction}
                      >
                        <Text style={s.textActionLabel}>
                          Hoàn tác lần quyết toán
                        </Text>
                      </Pressable>
                    )}
                  </AppCard>
                );
              })}
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
