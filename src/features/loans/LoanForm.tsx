import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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

export function LoanForm({ loan }: { loan?: Loan }) {
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
        ensure(dueDate, 'Chọn ngày đến hạn cho khoản vay có kỳ hạn.');
      const due = dueDate ? new Date(dueDate) : null;
      due?.setHours(23, 59, 59, 999);
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
    }
  };
  return (
    <>
      {loan && (
        <AppCard>
          <Text style={s.text}>{loan.lender}</Text>
          <Text style={s.muted}>Còn nợ</Text>
          <Amount value={remaining} />
          <SecondaryButton
            label="Trả nợ toàn bộ"
            disabled={busy || remaining === 0}
            onPress={() => setAmount(String(remaining))}
          />
        </AppCard>
      )}
      <AppCard>
        {!loan && (
          <Field
            label="Người / đơn vị cho vay"
            value={lender}
            onChangeText={setLender}
            maxLength={100}
            placeholder="Ví dụ: Anh Minh"
          />
        )}
        <AmountInput
          label={loan ? 'Số tiền trả (VND)' : 'Số tiền vay/mượn (VND)'}
          value={amount}
          onChangeText={setAmount}
        />
        {fullRepayment && (
          <>
            <AmountInput
              label="Phụ phí tất toán phát sinh thêm (VND)"
              value={settlementFee}
              onChangeText={setSettlementFee}
            />
            <Text style={s.muted}>
              Không bắt buộc. Phụ phí được trừ cùng tiền trả nợ từ tài khoản đã
              chọn.
            </Text>
          </>
        )}
        {loan && repaymentTotal !== undefined && (
          <View style={{ gap: 6 }}>
            <Text style={s.label}>Tổng trừ tài khoản</Text>
            <Amount value={repaymentTotal} />
          </View>
        )}
        <AccountPicker
          accounts={accounts}
          value={account}
          onChange={setAccount}
          label={loan ? 'Tài khoản trả nợ' : 'Tài khoản nhận tiền'}
          variant="dropdown"
        />
        {!loan && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Không cộng tiền vay vào tài khoản nhận"
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
            <Text style={[s.text, { flex: 1 }]}>
              Không cộng tiền vay vào tài khoản nhận
            </Text>
          </Pressable>
        )}
        <SecondaryButton
          label={`${loan ? 'Ngày trả nợ' : 'Ngày nhận tiền'}: ${date.toLocaleDateString('vi-VN')}`}
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
          {loan
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
          )}
          <Text style={s.heading}>Chi phí vay</Text>
          <Text style={s.muted}>
            Nhập tổng tiền lãi, bảo hiểm hoặc phí theo thỏa thuận (VND). Chi phí
            được cộng vào tổng khoản vay phải trả.
          </Text>
          {costs.map((cost, index) => (
            <View key={cost.id} style={{ gap: 10 }}>
              <Field
                label={`Tên chi phí ${index + 1}`}
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
                label="Xóa chi phí"
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
              label="Thêm chi phí"
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
          <Text style={s.label}>Tổng khoản vay (gốc + chi phí)</Text>
          <Amount value={total} />
          <Text style={s.muted}>Cộng vào tài khoản nhận</Text>
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
          loan
            ? fullRepayment
              ? 'Lưu trả nợ toàn bộ'
              : 'Lưu trả nợ'
            : 'Lưu khoản vay/mượn'
        }
        disabled={
          busy ||
          !account ||
          (loan ? remaining <= 0 : !lender.trim()) ||
          !amount.trim()
        }
        onPress={() => void save()}
      />
    </>
  );
}
