import { useState } from 'react';
import { Text } from 'react-native';
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
  SecondaryButton,
  TransactionRow,
  s,
} from '../../components/ui';
import { useFinance, showError } from '../../hooks/finance';
import { accountBalances, parseAmount } from '../../services/accounting/ledger';
import { formatVnd } from '../../utils/format';
export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const a = data.accounts.find((x) => x.id === id);
  const [name, setName] = useState(a?.name ?? '');
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
      title={a.name}
      back
      subtitle={a.is_archived ? 'Tài khoản đã lưu trữ' : 'Chi tiết tài khoản'}
    >
      <AppCard>
        <Text style={s.muted}>Số dư hiện tại</Text>
        <Amount
          value={accountBalances(data)[id]}
          style={{ fontSize: 30, lineHeight: 42 }}
        />
        <Text style={s.muted}>
          Số dư ban đầu:{' '}
          <Amount value={a.opening_balance} style={{ fontSize: 13 }} />
        </Text>
      </AppCard>
      {!a.is_archived && (
        <>
          <AppCard>
            <Field
              label="Tên tài khoản"
              value={name}
              onChangeText={setName}
              maxLength={100}
            />
            <SecondaryButton
              label="Lưu tên tài khoản"
              disabled={busy}
              onPress={() =>
                void mutate((repo) => repo.renameAccount(id, name))
              }
            />
          </AppCard>
          <SecondaryButton
            label={adjust ? 'Đóng điều chỉnh' : 'Điều chỉnh số dư ban đầu'}
            disabled={busy}
            onPress={() => setAdjust(!adjust)}
          />
          {adjust && (
            <AppCard>
              <Text style={s.muted}>
                Chỉ dùng khi bạn nhập sai số dư lúc bắt đầu. Để ghi tiền thực
                nhận hoặc thực chi, hãy tạo giao dịch.
              </Text>
              <AmountInput value={opening} onChangeText={setOpening} />
              <PrimaryButton
                label="Xem lại & xác nhận"
                disabled={busy}
                onPress={() => void saveOpening()}
              />
            </AppCard>
          )}
          <PrimaryButton
            label="Ghi giao dịch từ tài khoản"
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: '/transaction/new',
                params: { account: id },
              })
            }
          />
        </>
      )}
      {a.type === 'bank' && (
        <SecondaryButton
          label={a.is_archived ? 'Khôi phục tài khoản' : 'Lưu trữ tài khoản'}
          disabled={busy}
          onPress={() => void archive()}
        />
      )}
      <Text style={s.heading}>Lịch sử tài khoản · {transactions.length}</Text>
      <AppCard>
        {transactions.length ? (
          transactions.map((t) => (
            <TransactionRow key={t.id} transaction={t} ledger={data} />
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
