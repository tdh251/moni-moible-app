import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AccountPicker,
  Amount,
  AmountInput,
  AppCard,
  Field,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { Disclosure } from '../../components/ui/primitives';
import { FormActions } from '../../components/ui/FormActions';
import { useFinance, showError } from '../../hooks/finance';
import { ensure, parseAmount } from '../../services/accounting/money';
import { purchaseOutstanding } from '../../services/purchases';
import type { Purchase } from '../../types/finance';
import { PurchaseDateField } from './PurchaseDateField';

export function PurchaseForm({
  purchase,
  refund = false,
  initialAccount,
}: {
  purchase?: Purchase;
  refund?: boolean;
  initialAccount?: string;
}) {
  const { data, mutate, busy } = useFinance();
  const editing = !!purchase && !refund;
  const [id] = useState(() => (editing ? purchase.id : randomUUID()));
  const [title, setTitle] = useState(editing ? purchase.title : '');
  const [person, setPerson] = useState(editing ? purchase.person : '');
  const [amount, setAmount] = useState(editing ? String(purchase.amount) : '');
  const [account, setAccount] = useState(
    (editing ||
    data.accounts.some((a) => a.id === purchase?.account_id && !a.is_archived)
      ? purchase?.account_id
      : undefined) ??
      initialAccount ??
      '',
  );
  const [note, setNote] = useState(editing ? purchase.note : '');
  const [date, setDate] = useState(
    editing ? new Date(purchase.occurred_at) : new Date(),
  );
  const [due, setDue] = useState<Date | null>(
    editing && purchase.due_at ? new Date(purchase.due_at) : null,
  );
  const [dateValid, setDateValid] = useState(true);
  const [dueValid, setDueValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const remaining = purchase
    ? purchaseOutstanding(purchase, data.purchaseRefunds ?? [])
    : 0;
  const accounts = data.accounts.filter(
    (a) => !a.is_archived || (editing && a.id === purchase.account_id),
  );
  const save = async () => {
    if (savingRef.current || busy) return;
    savingRef.current = true;
    setSaving(true);
    try {
      ensure(dateValid && dueValid, 'Kiểm tra lại ngày giờ đã nhập.');
      const now = new Date().toISOString();
      const base = {
        id,
        amount: parseAmount(amount),
        account_id: account,
        occurred_at: date.toISOString(),
        created_at: editing ? purchase.created_at : now,
        note: note.trim(),
      };
      ensure(!refund || !!purchase, 'Không tìm thấy khoản mua hộ.');
      const saved =
        refund && purchase
          ? await mutate((repo) =>
              repo.refundPurchase({ ...base, purchase_id: purchase.id }),
            )
          : await mutate((repo) =>
              repo.savePurchase(
                {
                  ...base,
                  title,
                  person,
                  due_at: due?.toISOString() ?? null,
                  updated_at: now,
                },
                editing,
              ),
            );
      if (saved) {
        if (editing || refund) router.back();
        else
          router.dismissTo({
            pathname: '/(tabs)/loans',
            params: { side: 'receivable', kind: 'purchase' },
          });
      }
    } catch (error) {
      showError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <ScreenContainer
      title={
        refund ? 'Nhận hoàn tiền' : editing ? 'Sửa khoản mua hộ' : 'Ghi mua hộ'
      }
      subtitle={
        refund
          ? purchase?.person
          : 'Theo dõi tiền ứng mua hộ, tách khỏi chi tiêu cá nhân.'
      }
      back
      backDisabled={busy || saving}
      footer={
        <FormActions
          busy={busy || saving}
          showCancel={false}
          saveLabel={
            refund
              ? 'Ghi nhận hoàn tiền'
              : editing
                ? 'Lưu thay đổi'
                : 'Lưu khoản mua hộ'
          }
          saveDisabled={
            !dateValid ||
            !dueValid ||
            !account ||
            !amount.trim() ||
            (refund ? remaining <= 0 : !person.trim() || !title.trim())
          }
          onSave={() => void save()}
          onCancel={() => router.back()}
        />
      }
    >
      {refund && purchase && (
        <AppCard>
          <Text style={s.heading}>{purchase.title}</Text>
          <Text style={s.muted}>Tiền còn chờ {purchase.person} hoàn</Text>
          <Amount value={remaining} style={{ fontSize: 28, lineHeight: 38 }} />
          <SecondaryButton
            label="Nhận toàn bộ số tiền còn lại"
            disabled={busy || saving || remaining <= 0}
            onPress={() => setAmount(String(remaining))}
          />
        </AppCard>
      )}
      <AppCard>
        <AmountInput
          prominent
          label={refund ? 'Số tiền thực nhận (VND)' : 'Số tiền mua hộ (VND)'}
          value={amount}
          onChangeText={setAmount}
        />
        {!refund && (
          <>
            <Field
              label="Mua hộ ai?"
              value={person}
              onChangeText={setPerson}
              maxLength={100}
              placeholder="Ví dụ: Minh"
              editable={!busy && !saving}
            />
            <Field
              label="Nội dung mua hộ"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              placeholder="Ví dụ: Mua sách, đặt đồ ăn…"
              editable={!busy && !saving}
            />
          </>
        )}
        <AccountPicker
          accounts={accounts}
          value={account}
          onChange={setAccount}
          label={refund ? 'Nhận tiền vào tài khoản' : 'Thanh toán từ tài khoản'}
          variant="dropdown"
        />
        <Text style={s.muted}>
          {refund
            ? 'Tiền thực nhận được cộng vào ví, không tính là thu nhập. Có thể ghi nhận hoàn tiền nhiều lần.'
            : 'Tiền được trừ khỏi ví, không tính vào chi tiêu cá nhân hay báo cáo danh mục. Chỉ nhập phần tiền mua hộ.'}
        </Text>
      </AppCard>
      <AppCard>
        <Disclosure title="Ngày và ghi chú" defaultOpen={editing || refund}>
          <PurchaseDateField
            label={refund ? 'Ngày nhận hoàn tiền' : 'Ngày mua hộ'}
            value={date}
            onChange={(value) => {
              if (value) setDate(value);
            }}
            onValidityChange={setDateValid}
            disabled={busy || saving}
          />
          {!refund && (
            <PurchaseDateField
              label="Hạn hoàn tiền"
              value={due}
              onChange={setDue}
              onValidityChange={setDueValid}
              optional
              disabled={busy || saving}
            />
          )}
          <Field
            label="Ghi chú"
            value={note}
            onChangeText={setNote}
            maxLength={4000}
            multiline
            placeholder="Thông tin đơn hàng, thỏa thuận…"
            editable={!busy && !saving}
          />
        </Disclosure>
      </AppCard>
    </ScreenContainer>
  );
}
