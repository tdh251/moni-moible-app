import { useRef, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  AppCard,
  ConfirmationDialog,
  Field,
  Icon,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import {
  authenticate,
  savePreferences,
  showError,
  useFinance,
} from '../../hooks/finance';
import { usePreferences } from '../../stores/preferences';
import { pickBackup, shareFile } from '../../services/backup/files';
import { transactionsCsv } from '../../services/export/csv';
import { colors } from '../../theme';
import { APP_NAME, APP_DISPLAY_NAME } from '../../constants/app';
export default function Settings() {
  const { repository, mutate, busy } = useFinance();
  const hidden = usePreferences((v) => v.hidden);
  const biometric = usePreferences((v) => v.biometric);
  const [working, setWorking] = useState(false);
  const workingRef = useRef(false);
  const [resetText, setResetText] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const disabled = busy || working;
  const perform = async (job: () => Promise<unknown>) => {
    if (workingRef.current || busy) return;
    workingRef.current = true;
    setWorking(true);
    try {
      await job();
    } catch (e) {
      showError(e);
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  };
  const toggleLock = async () => {
    if (
      !biometric &&
      (!(await LocalAuthentication.hasHardwareAsync()) ||
        !(await LocalAuthentication.isEnrolledAsync()))
    ) {
      Alert.alert(
        'Chưa hỗ trợ',
        'Hãy đăng ký vân tay hoặc khuôn mặt trong cài đặt Android trước khi bật khóa ứng dụng.',
      );
      return;
    }
    if (await authenticate()) await savePreferences({ biometric: !biometric });
  };
  const backup = async () => {
    const value = await repository.backup();
    await shareFile(JSON.stringify(value, null, 2), 'json');
  };
  const restore = async () => {
    const value = await pickBackup();
    if (!value) return;
    if (
      await ConfirmationDialog(
        'Thay thế toàn bộ sổ tiền?',
        `Bản sao lưu ngày ${new Date(value.exported_at).toLocaleString('vi-VN')} có ${value.data.accounts.length} tài khoản, ${value.data.transactions.length} giao dịch. Toàn bộ dữ liệu tài chính hiện tại sẽ được thay thế. Hãy xuất bản sao lưu trước nếu cần.`,
        true,
      )
    ) {
      if (await mutate((repo) => repo.restore(value))) {
        Alert.alert('Đã khôi phục', 'Sổ tiền đã được thay thế hoàn chỉnh.');
        router.replace('/');
      }
    }
  };
  const reset = async () => {
    if (resetText !== 'XÓA TOÀN BỘ') return;
    if (
      await ConfirmationDialog(
        'Xóa vĩnh viễn dữ liệu?',
        'Tất cả tài khoản, giao dịch và danh mục tùy chỉnh trên thiết bị sẽ bị xóa. Không thể hoàn tác nếu chưa có bản sao lưu.',
        true,
      )
    ) {
      if (await mutate((repo) => repo.reset())) {
        setResetOpen(false);
        setResetText('');
        router.replace('/onboarding');
      }
    }
  };
  return (
    <ScreenContainer
      title="Cá nhân"
      subtitle="Một sổ tiền riêng, theo cách của bạn."
    >
      <AppCard>
        <View style={s.row}>
          <Icon name="wallet-outline" size={32} />
          <View>
            <Text style={s.heading}>{APP_NAME}</Text>
            <Text style={s.muted}>Tài chính cá nhân · lưu trên thiết bị</Text>
          </View>
        </View>
      </AppCard>
      <PrimaryButton
        label="Quản lý tài khoản"
        icon="card-outline"
        onPress={() => router.push('/accounts')}
      />
      <SecondaryButton
        label="Quản lý danh mục"
        icon="pricetags-outline"
        onPress={() => router.push('/categories')}
      />
      <Text style={s.heading}>Hiển thị</Text>
      <AppCard>
        <View style={s.between}>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Ẩn số tiền</Text>
            <Text style={s.muted}>Che số dư và các giá trị tiền trên sổ.</Text>
          </View>
          <Switch
            accessibilityLabel="Ẩn số tiền"
            value={hidden}
            disabled={disabled}
            trackColor={{ true: colors.primary }}
            onValueChange={(value) =>
              void perform(() => savePreferences({ hidden: value }))
            }
          />
        </View>
        <View style={s.divider} />
        <View style={s.between}>
          <Text style={s.text}>Tiền tệ</Text>
          <Text style={s.muted}>VND · Việt Nam đồng</Text>
        </View>
      </AppCard>
      <Text style={s.heading}>Bảo mật</Text>
      <AppCard>
        <View style={s.between}>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Khóa ứng dụng</Text>
            <Text style={s.muted}>
              Sinh trắc học hoặc mã khóa thiết bị. Khóa lại khi ứng dụng vào
              nền.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Khóa ứng dụng"
            value={biometric}
            disabled={disabled}
            trackColor={{ true: colors.primary }}
            onValueChange={() => void perform(toggleLock)}
          />
        </View>
        <Text style={s.muted}>
          Khóa giao diện không mã hóa tệp SQLite. Bản sao lưu JSON chứa dữ liệu
          rõ; hãy lưu ở nơi riêng tư.
        </Text>
      </AppCard>
      <Text style={s.heading}>Sao lưu & khôi phục</Text>
      <AppCard>
        <Text style={s.muted}>
          JSON {APP_NAME} phiên bản 4, gồm toàn bộ tài khoản, danh mục và giao
          dịch, gồm điều chỉnh hóa đơn. Vẫn đọc được bản sao lưu phiên bản 1, 2
          và 3. Việc khôi phục được kiểm tra trước và ghi nguyên tử.
        </Text>
        <SecondaryButton
          label="Xuất bản sao lưu"
          icon="cloud-download-outline"
          disabled={disabled}
          onPress={() => void perform(backup)}
        />
        <SecondaryButton
          label="Nhập bản sao lưu"
          icon="document-outline"
          disabled={disabled}
          onPress={() => void perform(restore)}
        />
      </AppCard>
      <Text style={s.heading}>Đồng bộ Cloud</Text>
      <AppCard>
        <View style={s.row}>
          <Icon name="cloud-offline-outline" />
          <Text style={s.heading}>Chưa thiết lập</Text>
        </View>
        <Text style={s.muted}>
          {APP_NAME} đang hoạt động ngoại tuyến. Supabase là tùy chọn cho giai
          đoạn sau; hiện chưa có đăng nhập hoặc đồng bộ.
        </Text>
      </AppCard>
      <Text style={s.heading}>Quản lý dữ liệu</Text>
      <AppCard>
        <SecondaryButton
          label="Xuất giao dịch CSV"
          icon="download-outline"
          disabled={disabled}
          onPress={() =>
            void perform(async () =>
              shareFile(
                transactionsCsv((await repository.backup()).data),
                'csv',
              ),
            )
          }
        />
        <SecondaryButton
          label="Khôi phục danh mục mặc định"
          disabled={disabled}
          onPress={() =>
            void perform(async () => {
              if (
                await ConfirmationDialog(
                  'Khôi phục danh mục mặc định?',
                  'Tên, màu và biểu tượng danh mục mặc định sẽ được khôi phục. Danh mục tùy chỉnh và lịch sử vẫn được giữ.',
                )
              )
                await mutate((repo) => repo.restoreDefaults());
            })
          }
        />
        <SecondaryButton
          label="Xóa toàn bộ dữ liệu tài chính"
          danger
          disabled={disabled}
          onPress={() => setResetOpen(!resetOpen)}
        />
        {resetOpen && (
          <>
            <Field
              label="Gõ XÓA TOÀN BỘ để tiếp tục"
              value={resetText}
              onChangeText={setResetText}
              autoCapitalize="characters"
            />
            <PrimaryButton
              label="Xác nhận xóa toàn bộ"
              danger
              disabled={disabled || resetText !== 'XÓA TOÀN BỘ'}
              onPress={() => void perform(reset)}
            />
          </>
        )}
      </AppCard>
      <Text style={s.heading}>Thông tin ứng dụng</Text>
      <AppCard>
        <Text style={s.text}>{APP_DISPLAY_NAME}</Text>
        <Text style={s.muted}>Phiên bản 1.0.0</Text>
        <Text style={s.muted}>
          Ghi thu chi, theo dõi tiền mặt và ngân hàng. Tối giản, rõ ràng và hoạt
          động ngoại tuyến.
        </Text>
      </AppCard>
      {working && <Text style={s.muted}>Đang xử lý…</Text>}
    </ScreenContainer>
  );
}
