import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FinanceProvider } from '../hooks/finance';
import { APP_NAME } from '../constants/app';
import { EmptyState, PrimaryButton, ScreenContainer } from '../components/ui';
import { colors } from '../theme';
import { MotionProvider, useReducedMotionPreference } from '../hooks/motion';
import { motion } from '../theme/motion';
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <ScreenContainer title={APP_NAME}>
      <EmptyState
        title="Chưa thể mở màn hình"
        description="Vui lòng thử lại. Dữ liệu đã lưu vẫn được giữ trên thiết bị."
      />
      <PrimaryButton label="Thử lại" onPress={() => void retry()} />
    </ScreenContainer>
  );
}
export default function RootLayout() {
  return (
    <MotionProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <FinanceProvider>
          <RootNavigator />
        </FinanceProvider>
      </SafeAreaProvider>
    </MotionProvider>
  );
}

function RootNavigator() {
  const reducedMotion = useReducedMotionPreference();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reducedMotion ? 'none' : 'slide_from_right',
        animationDuration: motion.transition,
        freezeOnBlur: true,
      }}
    />
  );
}
