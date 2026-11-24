import { useRef, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import {
  AppCard,
  ConfirmationDialog,
  Field,
  Icon,
  NavigationRow,
  PrimaryButton,
  ScreenContainer,
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
import { Disclosure, SectionHeader } from '../../components/ui/primitives';
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
        `Bản sao lưu ngày ${new Date(value.exported_at).toLocaleString('vi-VN')} có ${value.data.accounts.length} tài khoản, ${value.data.transactions.length} giao dịch, ${value.data.purchases?.length ?? 0} khoản mua hộ và ${value.data.thirdPartyCases?.length ?? 0} hồ sơ thu chi hộ (${value.data.thirdPartyEntries?.length ?? 0} bút toán). Toàn bộ dữ liệu tài chính hiện tại sẽ được thay thế. Hãy xuất bản sao lưu trước nếu cần.`,
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
    <ScreenContainer tabScreen title="Cá nhân">
      <View style={[s.row, { paddingVertical: 8 }]}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="wallet-outline" size={26} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>{APP_NAME}</Text>
          <Text style={s.muted}>Sổ tiền riêng trên thiết bị của bạn</Text>
        </View>
      </View>
      <SectionHeader title="Tài chính" />
      <AppCard style={{ padding: 0, gap: 0 }}>
        <NavigationRow
          label="Tài khoản"
          icon="card-outline"
          disabled={disabled}
          onPress={() => router.push('/accounts')}
        />
        <View style={s.divider} />
        <NavigationRow
          label="Danh mục"
          icon="grid-outline"
          disabled={disabled}
          onPress={() => router.push('/categories')}
        />
        <View style={s.divider} />
        <NavigationRow
          label="Tag"
          icon="pricetag-outline"
          disabled={disabled}
          onPress={() => router.push('/tags')}
        />
      </AppCard>
      <SectionHeader title="Hiển thị & bảo mật" />
      <AppCard>
        <View style={[s.row, { minHeight: 48 }]}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={s.text}>Ẩn số tiền</Text>
            <Text style={s.muted}>Che số dư và các giá trị tiền.</Text>
          </View>
          <Switch
            accessibilityLabel="Ẩn số tiền"
            value={hidden}
            disabled={disabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            onValueChange={(value) =>
              void perform(() => savePreferences({ hidden: value }))
            }
          />
        </View>
        <View style={s.divider} />
        <View style={[s.row, { minHeight: 48 }]}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={s.text}>Khóa ứng dụng</Text>
            <Text style={s.muted}>Sinh trắc học hoặc mã khóa thiết bị.</Text>
          </View>
          <Switch
            accessibilityLabel="Khóa ứng dụng"
            value={biometric}
            disabled={disabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            onValueChange={() => void perform(toggleLock)}
          />
        </View>
        <Disclosure title="Thông tin bảo mật">
          <Text style={s.muted}>
            Khóa giao diện không mã hóa tệp SQLite. Bản sao lưu JSON chứa dữ
            liệu rõ; hãy lưu ở nơi riêng tư. Ứng dụng khóa lại khi vào nền.
          </Text>
        </Disclosure>
        <View style={s.between}>
          <Text style={s.muted}>Tiền tệ</Text>
          <Text style={s.text}>VND · Việt Nam đồng</Text>
        </View>
      </AppCard>
      <SectionHeader title="Dữ liệu" />
      <AppCard style={{ padding: 0, gap: 0 }}>
        <NavigationRow
          label="Xuất bản sao lưu"
          description="Toàn bộ sổ tiền, công nợ và thu chi hộ"
          icon="cloud-download-outline"
          disabled={disabled}
          onPress={() => void perform(backup)}
        />
        <View style={s.divider} />
        <NavigationRow
          label="Nhập bản sao lưu"
          icon="document-outline"
          disabled={disabled}
          onPress={() => void perform(restore)}
        />
        <View style={s.divider} />
        <NavigationRow
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
      </AppCard>
      <AppCard>
        <View style={s.row}>
          <Icon name="cloud-offline-outline" />
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Đồng bộ Cloud</Text>
            <Text style={s.muted}>
              Chưa thiết lập · Sổ tiền đang lưu trên thiết bị.
            </Text>
          </View>
        </View>
      </AppCard>
      <SectionHeader title="Quản lý dữ liệu" />
      <AppCard style={{ padding: 0, gap: 0 }}>
        <NavigationRow
          label="Khôi phục danh mục mặc định"
          icon="refresh-outline"
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
        <View style={s.divider} />
        <NavigationRow
          label="Xóa toàn bộ dữ liệu tài chính"
          icon="trash-outline"
          danger
          disabled={disabled}
          onPress={() => setResetOpen(!resetOpen)}
        />
        {resetOpen && (
          <View style={{ padding: 16, gap: 12 }}>
            <Field
              label="Gõ XÓA TOÀN BỘ để tiếp tục"
              value={resetText}
              onChangeText={setResetText}
              autoCapitalize="characters"
              editable={!disabled}
            />
            <PrimaryButton
              label="Xác nhận xóa toàn bộ"
              danger
              disabled={disabled || resetText !== 'XÓA TOÀN BỘ'}
              onPress={() => void perform(reset)}
            />
          </View>
        )}
      </AppCard>
      <AppCard>
        <Text style={s.heading}>{APP_DISPLAY_NAME}</Text>
        <Text style={s.muted}>
          Phiên bản {Constants.expoConfig?.version ?? '—'}
        </Text>
        <Text style={s.muted}>
          Ghi thu chi, theo dõi tiền mặt và ngân hàng. Đơn giản, rõ ràng và hoạt
          động ngoại tuyến.
        </Text>
      </AppCard>
      {working && (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          Đang xử lý…
        </Text>
      )}
    </ScreenContainer>
  );
}
