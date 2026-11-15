import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AmountInput,
  AppCard,
  Field,
  ScreenContainer,
  s,
} from '../../components/ui';
import { useFinance, showError } from '../../hooks/finance';
import { makeAccount } from '../../database/repository';
import { parseAmount } from '../../services/accounting/ledger';
import { FormActions } from '../../components/ui/FormActions';
export default function NewAccount() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('0');
  const { mutate, busy } = useFinance();
  const save = async () => {
    try {
      const account = makeAccount(
        randomUUID(),
        name,
        'bank',
        parseAmount(amount, true),
      );
      if (await mutate((repo) => repo.addAccount(account))) router.back();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <ScreenContainer
      title="Thêm tài khoản"
      back
      backDisabled={busy}
      footer={
        <FormActions
          busy={busy}
          showCancel={false}
          saveLabel="Lưu tài khoản"
          onCancel={() => router.back()}
          onSave={() => void save()}
        />
      }
    >
      <AppCard>
        <Field
          label="Tên tài khoản"
          value={name}
          onChangeText={setName}
          maxLength={100}
          placeholder="Ví dụ: Vietcombank"
        />
        <AmountInput
          label="Số dư ban đầu (VND)"
          value={amount}
          onChangeText={setAmount}
        />
        <Text style={s.muted}>
          Đây là số dư trước các giao dịch bạn ghi vào sổ, không phải một khoản
          thu.
        </Text>
      </AppCard>
    </ScreenContainer>
  );
}
