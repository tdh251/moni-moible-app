import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  AccountPicker,
  Amount,
  AmountInput,
  AppCard,
  Choices,
  Field,
  Icon,
  PrimaryButton,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance, showError } from '../../hooks/finance';
import { ensure, parseAmount } from '../../services/accounting/ledger';
import { Dropdown } from '../../components/ui/Dropdown';
import {
  loanOutstanding,
  loanTotalAmount,
  loanPaymentTotal,
} from '../../services/loans';
import { colors } from '../../theme';
import type { Loan } from '../../types/finance';
import { LoanReminderFields } from './LoanReminderFields';
import { requestLoanReminderPermission } from '../../services/loan-reminders/notifications';

export function LoanForm({
  loan,
  direction = 'borrow',
}: {
  loan?: Loan;
  direction?: 'borrow' | 'lend';
}) {
  const lending = (loan?.direction ?? direction) === 'lend';
  const excludeLabel = 'Không tính vào số dư';
  const { data, mutate, busy } = useFinance();
  const accounts = data.accounts.filter((a) => !a.is_archived);
  const [lender, setLender] = useState('');
  const [amount, setAmount] = useState('');
  const [settlementFee, setSettlementFee] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [excludeFromBalance, setExcludeFromBalance] = useState(false);
  const [date, setDate] = useState(new Date());
  const [term, setTerm] = useState('none');
  const [paymentDay, setPaymentDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [costs, setCosts] = useState<
    { id: string; name: string; amount: string }[]
  >([]);
  const [picker, setPicker] = useState<'date' | 'time' | 'due' | null>(null);
  const remaining = loan ? loanOutstanding(loan, data.loanPayments ?? []) : 0;
  const fullRepayment =
    !!loan &&
    remaining > 0 &&
    /^\d+$/.test(amount.trim()) &&
    Number(amount) === remaining;
  let repaymentTotal: number | undefined;
  if (loan) {
    try {
      repaymentTotal = loanPaymentTotal({
        amount: parseAmount(amount),
        fee_amount: fullRepayment
          ? parseAmount(settlementFee.trim() || '0', true)
          : 0,
      });
    } catch {
      /* Wait until entered amounts are valid before showing the debit. */
    }
  }
  const serializeCosts = () =>
    JSON.stringify(
      costs.map((cost) => ({
        ...cost,
        name: cost.name.trim(),
        amount: parseAmount(cost.amount),
      })),
    );
  let total: number | undefined;
  if (!loan) {
    try {
      total = loanTotalAmount({
        amount: parseAmount(amount),
        costs_json: serializeCosts(),
      });
    } catch {
      /* Show the total once all entered amounts are valid. */
    }
  }
  const save = async () => {
    if (saving || busy) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const base = {
        id: randomUUID(),
        amount: parseAmount(amount),
        account_id: account,
        occurred_at: date.toISOString(),
        created_at: now,
      };
      if (!loan && term === 'fixed')
        ensure(dueDate, 'Chọn ngày đến hạn cho khoản vay / cho vay có kỳ hạn.');
      const due = dueDate ? new Date(dueDate) : null;
      due?.setHours(23, 59, 59, 999);
      if (!loan && term === 'fixed' && paymentDay) {
        const warning = await requestLoanReminderPermission();
        if (warning) Alert.alert('Nhắc lịch trên máy', warning);
      }
      const saved = loan
        ? await mutate((repo) =>
            repo.repayLoan({
              ...base,
              loan_id: loan.id,
              fee_amount: fullRepayment
                ? parseAmount(settlementFee.trim() || '0', true)
                : 0,
            }),
          )
        : await mutate((repo) =>
            repo.addLoan({
              ...base,
              direction,
              payment_day:
                term === 'fixed' && paymentDay ? Number(paymentDay) : null,
              lender,
              note,
              exclude_from_balance: excludeFromBalance ? 1 : 0,
              due_at: term === 'fixed' ? due?.toISOString() : null,
              costs_json: serializeCosts(),
            }),
          );
      if (saved) router.back();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {loan && (
        <AppCard>
          <Text style={s.text}>{loan.lender}</Text>
          <Text style={s.muted}>{lending ? 'Cần thu hồi' : 'Còn nợ'}</Text>
          <Amount value={remaining} />
          <SecondaryButton
            label={lending ? 'Thu hồi toàn bộ' : 'Trả nợ toàn bộ'}
            disabled={busy || remaining === 0}
            onPress={() => setAmount(String(remaining))}
          />
        </AppCard>
      )}
      <AppCard>
        {!loan && (
          <Field
            label={lending ? 'Người / đơn vị vay' : 'Người / đơn vị cho vay'}
            value={lender}
            onChangeText={setLender}
            maxLength={100}
            placeholder="Ví dụ: Anh Minh"
          />
        )}
        <AmountInput
          label={
            lending
              ? loan
                ? 'Số tiền thu hồi (VND)'
                : 'Số tiền cho vay (VND)'
              : loan
                ? 'Số tiền trả (VND)'
                : 'Số tiền vay (VND)'
          }
          value={amount}
          onChangeText={setAmount}
        />
        {fullRepayment && (
          <>
            <AmountInput
              label={
                lending
                  ? 'Phụ phí tất toán thu thêm (VND)'
                  : 'Phụ phí tất toán phát sinh thêm (VND)'
              }
              value={settlementFee}
              onChangeText={setSettlementFee}
            />
            <Text style={s.muted}>
              {lending
                ? 'Không bắt buộc. Phụ phí được cộng cùng tiền thu hồi vào tài khoản đã chọn.'
                : 'Không bắt buộc. Phụ phí được trừ cùng tiền trả nợ từ tài khoản đã chọn.'}
            </Text>
          </>
        )}
        {loan && repaymentTotal !== undefined && (
          <View style={{ gap: 6 }}>
            <Text style={s.label}>
              {lending ? 'Tổng cộng vào tài khoản' : 'Tổng trừ tài khoản'}
            </Text>
            <Amount value={repaymentTotal} />
          </View>
        )}
        <AccountPicker
          accounts={accounts}
          value={account}
          onChange={setAccount}
          label={
            lending
              ? loan
                ? 'Tài khoản nhận tiền thu hồi'
                : 'Tài khoản xuất tiền'
              : loan
                ? 'Tài khoản trả nợ'
                : 'Tài khoản nhận tiền'
          }
          variant="dropdown"
        />
        {!loan && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={excludeLabel}
            accessibilityState={{ checked: excludeFromBalance, disabled: busy }}
            disabled={busy}
            onPress={() => setExcludeFromBalance((value) => !value)}
            style={({ pressed }) => [
              s.row,
              { minHeight: 52, opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
            ]}
          >
            <Icon
              name={excludeFromBalance ? 'checkbox-outline' : 'square-outline'}
              size={26}
              color={excludeFromBalance ? colors.primary : colors.muted}
            />
            <Text style={[s.text, { flex: 1 }]}>{excludeLabel}</Text>
          </Pressable>
        )}
        <SecondaryButton
          label={`${lending ? (loan ? 'Ngày thu hồi' : 'Ngày cho vay') : loan ? 'Ngày trả nợ' : 'Ngày nhận tiền'}: ${date.toLocaleDateString('vi-VN')}`}
          icon="calendar-outline"
          onPress={() => setPicker('date')}
          disabled={busy}
        />
        <SecondaryButton
          label={`Giờ: ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
          icon="time-outline"
          onPress={() => setPicker('time')}
          disabled={busy}
        />
        {!loan && (
          <Field
            label="Ghi chú"
            value={note}
            onChangeText={setNote}
            maxLength={4000}
            multiline
            placeholder="Nội dung khoản vay, thỏa thuận…"
          />
        )}
        <Text style={s.muted}>
          {lending
            ? loan
              ? 'Tiền thu hồi được cộng vào tài khoản bạn chọn.'
              : excludeFromBalance
                ? 'Chỉ ghi nhận khoản cần thu hồi; số dư tài khoản giữ nguyên.'
                : 'Tiền gốc được trừ từ tài khoản xuất tiền.'
            : loan
              ? 'Tiền trả nợ được trừ từ tài khoản bạn chọn.'
              : excludeFromBalance
                ? 'Chỉ ghi nhận khoản nợ; số dư tài khoản nhận giữ nguyên.'
                : 'Chỉ tiền gốc được cộng vào tài khoản nhận tiền.'}
        </Text>
      </AppCard>
      {!loan && (
        <AppCard>
          <Text style={s.heading}>Kỳ hạn</Text>
          <Choices
            value={term}
            onChange={setTerm}
            options={[
              { value: 'none', label: 'Không kỳ hạn' },
              { value: 'fixed', label: 'Có kỳ hạn' },
            ]}
          />
          {term === 'fixed' && (
            <>
              <SecondaryButton
                label={
                  dueDate
                    ? `Ngày đến hạn: ${dueDate.toLocaleDateString('vi-VN')}`
                    : 'Chọn ngày đến hạn'
                }
                icon="calendar-outline"
                disabled={busy}
                onPress={() => setPicker('due')}
              />
              <LoanReminderFields
                value={paymentDay}
                onChange={setPaymentDay}
                lending={lending}
              />
            </>
          )}
          <Text style={s.heading}>
            {lending ? 'Lãi / phí cần thu' : 'Chi phí vay'}
          </Text>
          <Text style={s.muted}>
            {lending
              ? 'Nhập tổng tiền lãi hoặc phí người vay cần trả theo thỏa thuận (VND). Khoản này được cộng vào tổng cần thu hồi.'
              : 'Nhập tổng tiền lãi, bảo hiểm hoặc phí theo thỏa thuận (VND). Chi phí được cộng vào tổng khoản vay phải trả.'}
          </Text>
          {costs.map((cost, index) => (
            <View key={cost.id} style={{ gap: 10 }}>
              <Field
                label={`${lending ? 'Tên lãi / phí' : 'Tên chi phí'} ${index + 1}`}
                value={cost.name}
                maxLength={100}
                onChangeText={(name) =>
                  setCosts((current) =>
                    current.map((item) =>
                      item.id === cost.id ? { ...item, name } : item,
                    ),
                  )
                }
              />
              <AmountInput
                value={cost.amount}
                onChangeText={(amount) =>
                  setCosts((current) =>
                    current.map((item) =>
                      item.id === cost.id ? { ...item, amount } : item,
                    ),
                  )
                }
              />
              <SecondaryButton
                label={lending ? 'Xóa lãi / phí' : 'Xóa chi phí'}
                danger
                icon="trash-outline"
                disabled={busy}
                onPress={() =>
                  setCosts((current) =>
                    current.filter((item) => item.id !== cost.id),
                  )
                }
              />
            </View>
          ))}
          {costs.length < 50 && (
            <Dropdown
              label={lending ? 'Thêm lãi / phí' : 'Thêm chi phí'}
              placeholder="Thêm lãi, bảo hiểm, phí khác"
              value=""
              options={[
                { value: 'interest', label: 'Tiền lãi' },
                { value: 'insurance', label: 'Phí bảo hiểm' },
                { value: 'other', label: 'Phí khác' },
              ]}
              onChange={(kind) =>
                setCosts((current) => [
                  ...current,
                  {
                    id: randomUUID(),
                    name:
                      kind === 'interest'
                        ? 'Tiền lãi'
                        : kind === 'insurance'
                          ? 'Phí bảo hiểm'
                          : 'Phí khác',
                    amount: '',
                  },
                ])
              }
            />
          )}
        </AppCard>
      )}
      {!loan && total !== undefined && (
        <AppCard>
          <Text style={s.label}>
            {lending
              ? 'Tổng cần thu hồi (gốc + lãi / phí)'
              : 'Tổng khoản vay (gốc + chi phí)'}
          </Text>
          <Amount value={total} />
          <Text style={s.muted}>
            {lending ? 'Trừ từ tài khoản xuất tiền' : 'Cộng vào tài khoản nhận'}
          </Text>
          <Amount value={excludeFromBalance ? 0 : parseAmount(amount)} />
        </AppCard>
      )}
      {picker && (
        <DateTimePicker
          value={picker === 'due' ? (dueDate ?? date) : date}
          mode={picker === 'due' ? 'date' : picker}
          onValueChange={(_, selected) => {
            if (picker === 'due') setDueDate(selected);
            else setDate(selected);
            setPicker(null);
          }}
          onDismiss={() => setPicker(null)}
        />
      )}
      <PrimaryButton
        label={
          lending
            ? loan
              ? fullRepayment
                ? 'Lưu thu hồi toàn bộ'
                : 'Lưu thu hồi'
              : 'Lưu khoản cho vay'
            : loan
              ? fullRepayment
                ? 'Lưu trả nợ toàn bộ'
                : 'Lưu trả nợ'
              : 'Lưu khoản vay'
        }
        disabled={
          busy ||
          saving ||
          !account ||
          (loan ? remaining <= 0 : !lender.trim()) ||
          !amount.trim()
        }
        onPress={() => void save()}
      />
    </>
  );
}
