import { Redirect, Tabs } from 'expo-router';
import { Icon } from '../../components/ui';
import { colors, typography, radius } from '../../theme';
import { Text, useWindowDimensions } from 'react-native';
import { useFinance } from '../../hooks/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotionPreference } from '../../hooks/motion';
import { motion } from '../../theme/motion';
export default function TabsLayout() {
  const { data } = useFinance();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  if (!data.onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: reducedMotion ? 'none' : 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: motion.transition },
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.light,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          height:
            (fontScale > 1.3 ? 44 + Math.ceil(fontScale * 32) : 60) +
            insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          elevation: 0,
        },
        tabBarItemStyle: {
          borderRadius: radius.icon,
          marginHorizontal: 3,
          paddingVertical: 4,
        },
        tabBarLabelStyle: typography.navigation,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ color, children }) => (
          <Text style={[typography.navigation, { color, textAlign: 'center' }]}>
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Tổng quan',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'grid' : 'grid-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Giao dịch',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'receipt' : 'receipt-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Công nợ',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'hand-left' : 'hand-left-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Thống kê',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'pie-chart' : 'pie-chart-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
