import { loanCashFlows } from '../../services/loans';
import { purchaseCashFlows } from '../../services/purchases';
import { ThirdPartyEntryRow } from '../../features/third-party/ThirdPartyEntryRow';
import { thirdPartyEntryOrder } from '../../services/third-party';
import { useMemo, useState } from 'react';
import { createTransactionListIndex } from '../../services/transaction-list';
import { Modal, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Amount,
  AmountInput,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  Field,
  PrimaryButton,
  ScreenContainer,
  TextButton,
  TransactionRow,
  s,
} from '../../components/ui';
import { useFinance, showError } from '../../hooks/finance';
import { accountBalances, parseAmount } from '../../services/accounting/ledger';
import { formatVnd } from '../../utils/format';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { FormActions } from '../../components/ui/FormActions';
import { HeroCard, MoneyRow } from '../../components/ui/primitives';
import { useReducedMotionPreference } from '../../hooks/motion';
import { colors } from '../../theme';
export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const reducedMotion = useReducedMotionPreference();
  const transactionIndex = useMemo(
    () => createTransactionListIndex(data),
    [data],
  );
  const a = data.accounts.find((x) => x.id === id);
  const [name, setName] = useState(a?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [opening, setOpening] = useState(String(a?.opening_balance ?? 0));
  if (!a)
    return (
      <ScreenContainer title="Tài khoản" back>
        <EmptyState
          title="Không tìm thấy tài khoản"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  const transactions = data.transactions.filter(
    (t) => t.source_account_id === id || t.destination_account_id === id,
  );
  const loanFlows = loanCashFlows(data)
    .filter((flow) => flow.account_id === id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const thirdPartyEntries = (data.thirdPartyEntries ?? [])
    .filter((entry) => entry.account_id === id)
    .sort((a, b) => thirdPartyEntryOrder(b, a));
  const thirdPartyCases = new Map(
    (data.thirdPartyCases ?? []).map((item) => [item.id, item]),
  );
  const purchaseFlows = purchaseCashFlows(data)
    .filter((flow) => flow.account_id === id)
    .sort(
      (a, b) =>
        b.occurred_at.localeCompare(a.occurred_at) ||
        b.created_at.localeCompare(a.created_at),
    );
  const saveOpening = async () => {
    try {
      const amount = parseAmount(opening, true);
      if (
        await ConfirmationDialog(
          'Điều chỉnh số dư ban đầu?',
          `Đổi từ ${formatVnd(a.opening_balance)} thành ${formatVnd(amount)}. Đây là sửa nền sổ tiền, ảnh hưởng số dư toàn bộ lịch sử, không tạo khoản thu/chi.`,
        )
      )
        if (await mutate((repo) => repo.adjustOpening(id, amount)))
          setAdjust(false);
    } catch (e) {
      showError(e);
    }
  };
  const archive = async () => {
    if (
      await ConfirmationDialog(
        a.is_archived ? 'Khôi phục tài khoản?' : 'Lưu trữ tài khoản?',
        a.is_archived
          ? 'Tài khoản sẽ nhận giao dịch mới trở lại.'
          : 'Chỉ lưu trữ khi số dư bằng 0. Lịch sử vẫn được giữ nguyên.',
      )
    )
      await mutate((repo) => repo.archiveAccount(id, !a.is_archived));
  };
  return (
    <ScreenContainer
      title="Chi tiết tài khoản"
      back
      subtitle={a.is_archived ? 'Tài khoản đã lưu trữ' : 'Chi tiết tài khoản'}
      rightAction={
        <View style={s.row}>
          {!a.is_archived && (
            <TextButton
              label={adjust ? 'Hủy điều chỉnh' : 'Sửa'}
              disabled={busy}
              onPress={() => {
                if (adjust) {
                  setAdjust(false);
                  return;
                }
                setName(a.name);
                setEditing(true);
              }}
            />
          )}
          {(!a.is_archived || a.type === 'bank') && (
            <ActionMenu
              label="Thao tác tài khoản"
              disabled={busy}
              actions={[
                ...(!a.is_archived
                  ? [
                      {
                        label: 'Điều chỉnh số dư ban đầu',
                        icon: 'options-outline' as const,
                        onPress: () => {
                          setOpening(String(a.opening_balance));
                          setAdjust(true);
                        },
                      },
                    ]
                  : []),
                ...(a.type === 'bank'
                  ? [
                      {
                        label: a.is_archived
                          ? 'Khôi phục tài khoản'
                          : 'Lưu trữ tài khoản',
                        icon: 'archive-outline' as const,
                        onPress: () => void archive(),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </View>
      }
      footer={
        !a.is_archived ? (
          <PrimaryButton
            label={adjust ? 'Xem lại & xác nhận' : 'Ghi giao dịch'}
            disabled={busy}
            onPress={() => {
              if (adjust) void saveOpening();
              else
                router.push({
                  pathname: '/transaction/new',
                  params: { account: id },
                });
            }}
          />
        ) : undefined
      }
    >
      <HeroCard
        label="Số dư hiện tại"
        value={accountBalances(data)[id]}
        subtitle={a.name}
      >
        <MoneyRow
          label="Số dư ban đầu"
          value={a.opening_balance}
          tone={colors.onDark}
          labelTone={colors.onDarkMuted}
        />
      </HeroCard>
      {!a.is_archived && (
        <>
          {editing && (
            <Modal
              animationType={reducedMotion ? 'none' : 'slide'}
              onRequestClose={() => {
                if (!busy) setEditing(false);
              }}
            >
              <ScreenContainer
                title="Sửa tài khoản"
                subtitle="Cập nhật tên hiển thị của tài khoản."
                onClose={() => setEditing(false)}
                closeDisabled={busy}
                footer={
                  <FormActions
                    showCancel={false}
                    saveLabel="Lưu thay đổi"
                    busy={busy}
                    onCancel={() => setEditing(false)}
                    onSave={() => {
                      void mutate((repo) => repo.renameAccount(id, name)).then(
                        (saved) => {
                          if (saved) setEditing(false);
                        },
                      );
                    }}
                  />
                }
              >
                <AppCard>
                  <Field
                    label="Tên tài khoản"
                    value={name}
                    onChangeText={setName}
                    maxLength={100}
                    editable={!busy}
                  />
                </AppCard>
              </ScreenContainer>
            </Modal>
          )}
          {adjust && (
            <AppCard>
              <Text style={s.heading}>Điều chỉnh số dư ban đầu</Text>
              <Text style={s.muted}>
                Chỉ dùng khi bạn nhập sai số dư lúc bắt đầu. Để ghi tiền thực
                nhận hoặc thực chi, hãy tạo giao dịch.
              </Text>
              <AmountInput
                prominent
                value={opening}
                onChangeText={setOpening}
              />
            </AppCard>
          )}
        </>
      )}
      {thirdPartyEntries.length > 0 && (
        <AppCard>
          <Text style={s.heading}>Thu chi hộ trong tài khoản</Text>
          {thirdPartyEntries.map((entry) => (
            <ThirdPartyEntryRow
              key={entry.id}
              entry={entry}
              accountName={a.name}
              title={`${thirdPartyCases.get(entry.case_id)?.title ?? ''} · ${thirdPartyCases.get(entry.case_id)?.person ?? ''}`}
            />
          ))}
        </AppCard>
      )}
      {purchaseFlows.length > 0 && (
        <AppCard>
          <Text style={s.heading}>Mua hộ trong tài khoản</Text>
          {purchaseFlows.map((flow) => (
            <Pressable
              key={flow.id}
              accessibilityRole="button"
              style={{ paddingVertical: 10, gap: 6 }}
              onPress={() =>
                router.push({
                  pathname: '/purchases/[id]',
                  params: { id: flow.purchase_id },
                })
              }
            >
              <Text style={s.text}>{flow.title}</Text>
              <View style={s.between}>
                <Text style={s.muted}>
                  {new Date(flow.occurred_at).toLocaleDateString('vi-VN')}
                </Text>
                <Amount
                  value={flow.source_account_id ? -flow.amount : flow.amount}
                />
              </View>
            </Pressable>
          ))}
        </AppCard>
      )}
      {loanFlows.length > 0 && (
        <AppCard>
          <Text style={s.heading}>Vay / cho vay trong tài khoản</Text>
          {loanFlows.map((flow) => (
            <Pressable
              key={flow.id}
              accessibilityRole="button"
              style={{ paddingVertical: 10, gap: 6 }}
              onPress={() =>
                router.push({
                  pathname: '/loans/[id]',
                  params: {
                    id: flow.loan_id,
                  },
                })
              }
            >
              <Text style={s.text}>{flow.title}</Text>
              {flow.exclude_from_balance === 1 && (
                <Text style={s.muted}>Không tính vào số dư</Text>
              )}
              <View style={s.between}>
                <Text style={s.muted}>
                  {new Date(flow.occurred_at).toLocaleDateString('vi-VN')}
                </Text>
                <Amount
                  value={flow.source_account_id ? -flow.amount : flow.amount}
                />
              </View>
            </Pressable>
          ))}
        </AppCard>
      )}
      <Text style={s.heading}>Lịch sử tài khoản · {transactions.length}</Text>
      <AppCard>
        {transactions.length ? (
          transactions.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              index={transactionIndex}
            />
          ))
        ) : (
          <EmptyState
            title="Chưa có giao dịch"
            description="Số dư ban đầu không xuất hiện trong lịch sử giao dịch."
          />
        )}
      </AppCard>
    </ScreenContainer>
  );
}
