import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AmountInput,
  AppCard,
  EmptyState,
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
      title={`Chào bạn, đây là ${APP_NAME}`}
      subtitle="Nhẹ nhàng quản lý tiền, bắt đầu từ hôm nay."
    >
      <EmptyState
        title="Mỗi khoản tiền, một nơi rõ ràng"
        description="Dữ liệu được lưu trên thiết bị. Số dư ban đầu không được tính là thu nhập."
        icon="wallet-outline"
      />
      <AppCard>
        <Text style={s.heading}>01 · Tiền mặt</Text>
        <AmountInput
          label="Số tiền mặt hiện có (VND)"
          value={cash}
          onChangeText={setCash}
        />
      </AppCard>
      <Text style={s.heading}>02 · Tài khoản ngân hàng</Text>
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
      <View style={{ marginTop: 8 }}>
        <PrimaryButton
          label={busy ? 'Đang lưu…' : 'Bắt đầu quản lý'}
          disabled={busy}
          onPress={() => void save()}
        />
      </View>
    </ScreenContainer>
  );
}
