import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AmountInput,
  AppCard,
  Field,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../components/ui';
import { useFinance, showError } from '../hooks/finance';
import { makeAccount } from '../database/repository';
import { APP_NAME } from '../constants/app';
import { parseAmount } from '../services/accounting/ledger';
import { SectionHeader } from '../components/ui/primitives';
export default function Onboarding() {
  const { data, mutate, busy } = useFinance();
  const [cash, setCash] = useState('0');
  const [banks, setBanks] = useState<
    { id: string; name: string; amount: string }[]
  >([]);
  if (data.onboarded) return <Redirect href="/(tabs)/dashboard" />;
  const save = async () => {
    try {
      const accounts = [
        makeAccount(randomUUID(), 'Tiền mặt', 'cash', parseAmount(cash, true)),
        ...banks.map((b) =>
          makeAccount(b.id, b.name, 'bank', parseAmount(b.amount, true)),
        ),
      ];
      if (await mutate((repo) => repo.onboard(accounts)))
        router.replace('/(tabs)/dashboard');
    } catch (e) {
      showError(e);
    }
  };
  return (
    <ScreenContainer
      title={APP_NAME}
      subtitle="Bắt đầu với số dư hiện tại."
      footer={
        <PrimaryButton
          label={busy ? 'Đang lưu…' : 'Bắt đầu quản lý'}
          loading={busy}
          disabled={busy}
          onPress={() => void save()}
        />
      }
    >
      <View style={{ gap: 8 }}>
        <Text style={s.title}>Mỗi khoản tiền, một nơi rõ ràng.</Text>
        <Text style={s.muted}>
          Dữ liệu được lưu trên thiết bị. Số dư ban đầu không được tính là thu
          nhập.
        </Text>
      </View>
      <AppCard>
        <Text style={s.heading}>01 · Tiền mặt</Text>
        <AmountInput
          prominent
          label="Số tiền mặt hiện có (VND)"
          value={cash}
          onChangeText={setCash}
        />
      </AppCard>
      <SectionHeader title="Tài khoản ngân hàng" />
      <Text style={s.muted}>
        Có thể bỏ qua và thêm sau. Số dư được phép bằng 0.
      </Text>
      {banks.map((b, i) => (
        <AppCard key={b.id}>
          <Field
            label={`Tên ngân hàng ${i + 1}`}
            maxLength={100}
            value={b.name}
            onChangeText={(name) =>
              setBanks((v) =>
                v.map((x) => (x.id === b.id ? { ...x, name } : x)),
              )
            }
          />
          <AmountInput
            label="Số dư ban đầu (VND)"
            value={b.amount}
            onChangeText={(amount) =>
              setBanks((v) =>
                v.map((x) => (x.id === b.id ? { ...x, amount } : x)),
              )
            }
          />
          <SecondaryButton
            label="Bỏ tài khoản này"
            danger
            onPress={() => setBanks((v) => v.filter((x) => x.id !== b.id))}
          />
        </AppCard>
      ))}
      <SecondaryButton
        label="Thêm tài khoản ngân hàng"
        icon="add-outline"
        disabled={busy}
        onPress={() =>
          setBanks((v) => [...v, { id: randomUUID(), name: '', amount: '0' }])
        }
      />
    </ScreenContainer>
  );
}
