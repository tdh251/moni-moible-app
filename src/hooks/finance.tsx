import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, Modal } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { getRepository } from '../database/client';
import { APP_NAME } from '../constants/app';
import type { FinanceRepository } from '../database/repository';
import { emptyLedger } from '../database/repository';
import { FinanceError } from '../services/accounting/ledger';
import { usePreferences } from '../stores/preferences';
import type { Snapshot } from '../types/finance';
import {
  EmptyState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
} from '../components/ui';

interface ContextValue {
  data: Snapshot;
  repository: FinanceRepository;
  busy: boolean;
  mutate: (
    operation: (repository: FinanceRepository) => Promise<unknown>,
  ) => Promise<boolean>;
}
const FinanceContext = createContext<ContextValue | null>(null);
export function showError(error: unknown) {
  console.error(error);
  Alert.alert(
    'Chưa thể thực hiện',
    error instanceof FinanceError
      ? error.message
      : 'Không thể đọc hoặc lưu dữ liệu. Vui lòng thử lại. Dữ liệu hiện có được giữ an toàn.',
  );
}
export async function savePreferences(value: {
  hidden?: boolean;
  biometric?: boolean;
}) {
  const current = usePreferences.getState();
  const next = {
    hidden: current.hidden,
    biometric: current.biometric,
    ...value,
  };
  await SecureStore.setItemAsync('monomoney-preferences', JSON.stringify(next));
  current.setPreferences(next);
}
export async function authenticate(): Promise<boolean> {
  // Keep device credential fallback available if biometrics were removed later.
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `Mở khóa ${APP_NAME}`,
    cancelLabel: 'Hủy',
    disableDeviceFallback: false,
  });
  if (
    !result.success &&
    !['user_cancel', 'system_cancel', 'app_cancel'].includes(result.error)
  ) {
    Alert.alert(
      'Chưa thể xác thực',
      'Hãy thử lại bằng vân tay hoặc mã khóa thiết bị. Kiểm tra cài đặt bảo mật Android nếu cảm biến chưa sẵn sàng.',
    );
  }
  return result.success;
}
export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot>({
    ...emptyLedger(),
    onboarded: false,
  });
  const [repository, setRepository] = useState<FinanceRepository>();
  const [error, setError] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [locked, setLocked] = useState(false);
  const authInProgress = useRef(false);
  const biometric = usePreferences((s) => s.biometric);
  const boot = useCallback(async () => {
    try {
      const repo = await getRepository();
      const raw = await SecureStore.getItemAsync('monomoney-preferences');
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (
          value &&
          typeof value === 'object' &&
          'hidden' in value &&
          'biometric' in value
        ) {
          usePreferences.getState().setPreferences({
            hidden: value.hidden === true,
            biometric: value.biometric === true,
          });
          setLocked(value.biometric === true);
        }
      }
      setData(await repo.snapshot());
      setRepository(repo);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }, []);
  useEffect(() => {
    // Boot reads external SQLite/SecureStore state. Defer its async callback so
    // this effect only subscribes to initialization, without a synchronous update.
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void boot();
    });
    return () => {
      active = false;
    };
  }, [boot]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && biometric && !authInProgress.current)
        setLocked(true);
    });
    return () => sub.remove();
  }, [biometric]);
  const unlock = async () => {
    if (authInProgress.current) return;
    authInProgress.current = true;
    setBusy(true);
    try {
      if (await authenticate()) setLocked(false);
    } catch (e) {
      showError(e);
    } finally {
      authInProgress.current = false;
      setBusy(false);
    }
  };
  const mutate = async (
    operation: (repo: FinanceRepository) => Promise<unknown>,
  ) => {
    if (!repository || busyRef.current || refreshFailed) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      await operation(repository);
      try {
        setData(await repository.snapshot());
      } catch (readError) {
        // The write has already committed. Never invite a second submission.
        console.error(readError);
        setRefreshFailed(true);
      }
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const retrySnapshot = async () => {
    if (!repository || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      setData(await repository.snapshot());
      setRefreshFailed(false);
    } catch (readError) {
      showError(readError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  if (error)
    return (
      <ScreenContainer title={APP_NAME}>
        <EmptyState
          title="Không thể mở dữ liệu"
          description="Hãy thử lại. Không cần xóa dữ liệu ứng dụng."
        />
        <PrimaryButton
          label="Thử lại"
          onPress={() => {
            setError(false);
            void boot();
          }}
        />
      </ScreenContainer>
    );
  if (!repository) return <LoadingState />;
  if (locked && biometric)
    return (
      <ScreenContainer title={APP_NAME}>
        <EmptyState
          title="Sổ tiền của bạn được khóa"
          description="Xác thực bằng sinh trắc học hoặc mã khóa thiết bị để tiếp tục."
          icon="lock-closed-outline"
        />
        <PrimaryButton
          label="Mở khóa"
          disabled={busy}
          onPress={() => void unlock()}
        />
      </ScreenContainer>
    );
  return (
    <FinanceContext.Provider
      value={{ data, repository, busy: busy || refreshFailed, mutate }}
    >
      {children}
      <Modal
        visible={refreshFailed}
        onRequestClose={() => undefined}
        animationType="fade"
      >
        <ScreenContainer title="Dữ liệu đã được lưu">
          <EmptyState
            title="Cần tải lại sổ tiền"
            description="Thao tác vừa rồi đã lưu thành công. Không cần thực hiện lại. Hãy tải lại dữ liệu để tiếp tục."
            icon="checkmark-circle-outline"
          />
          <PrimaryButton
            label="Tải lại dữ liệu"
            disabled={busy}
            onPress={() => void retrySnapshot()}
          />
        </ScreenContainer>
      </Modal>
    </FinanceContext.Provider>
  );
}
export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('FinanceProvider is missing');
  return context;
}
