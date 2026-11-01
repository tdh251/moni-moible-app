import { colors } from '../../theme';
import { TransactionFiltersModal } from '../../features/transactions/TransactionFiltersModal';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Pressable,
  SectionList,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router } from 'expo-router';
import {
  EmptyState,
  Field,
  Icon,
  ScreenContainer,
  SecondaryButton,
  TransactionRow,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { PeriodFilter } from '../../components/PeriodFilter';
import { usePreferences } from '../../stores/preferences';
import { filterTransactions } from '../../services/accounting/ledger';
import type { Transaction } from '../../types/finance';
export default function History() {
  const { data } = useFinance();
  const filters = usePreferences((v) => v.historyFilters);
  const set = usePreferences((v) => v.setFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addButtonVisible, setAddButtonVisible] = useState(true);
  const [addButtonProgress] = useState(() => new Animated.Value(1));
  const scrollTracking = useRef({ offset: 0, direction: 0, distance: 0 });

  useEffect(() => {
    const animation = Animated.timing(addButtonProgress, {
      toValue: addButtonVisible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [addButtonProgress, addButtonVisible]);

  const handleScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    // Ignore overscroll bounce so it cannot reverse the detected direction.
    const offset = Math.max(
      0,
      Math.min(
        contentOffset.y,
        Math.max(0, contentSize.height - layoutMeasurement.height),
      ),
    );
    const tracking = scrollTracking.current;
    const delta = offset - tracking.offset;
    tracking.offset = offset;
    if (offset === 0) {
      tracking.direction = 0;
      tracking.distance = 0;
      setAddButtonVisible(true);
      return;
    }
    if (delta === 0) return;
    const direction = Math.sign(delta);
    tracking.distance =
      direction === tracking.direction
        ? tracking.distance + Math.abs(delta)
        : Math.abs(delta);
    tracking.direction = direction;
    if (tracking.distance >= 10) {
      setAddButtonVisible(direction < 0);
      tracking.distance = 0;
    }
  };
  const account = filters.account || filters.accounts?.[0] || '';
  const transactions = useMemo(
    () => filterTransactions(data, { ...filters, account, accounts: [] }),
    [data, filters, account],
  );
  const sections = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const day = new Date(t.occurred_at).toLocaleDateString('vi-VN');
      groups.set(day, [...(groups.get(day) ?? []), t]);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [transactions]);
  return (
    <ScreenContainer
      title="Giao dịch"
      subtitle="Nhìn lại dòng tiền của bạn."
      scroll={false}
    >
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 20 }}>
            <Field
              label="Tìm giao dịch"
              value={filters.search}
              onChangeText={(search) => set('historyFilters', { search })}
              placeholder="Tiêu đề hoặc ghi chú"
            />
            <PeriodFilter
              value={filters}
              onChange={(patch) => set('historyFilters', patch)}
            />
            <View style={s.between}>
              <Text style={[s.muted, { flex: 1 }]}>
                {transactions.length} giao dịch trong kỳ
              </Text>
              <SecondaryButton
                label="Lọc"
                icon="options-outline"
                onPress={() => {
                  Keyboard.dismiss();
                  setFilterOpen(true);
                }}
              />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[s.label, { marginTop: 18 }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TransactionRow transaction={item} ledger={data} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có giao dịch phù hợp"
            description="Thử đổi kỳ, tài khoản hoặc bộ lọc. Bạn cũng có thể ghi giao dịch mới."
          />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
      />
      <Animated.View
        pointerEvents={addButtonVisible ? 'auto' : 'none'}
        accessibilityElementsHidden={!addButtonVisible}
        importantForAccessibility={
          addButtonVisible ? 'auto' : 'no-hide-descendants'
        }
        style={{
          position: 'absolute',
          right: 20,
          bottom: 16,
          opacity: addButtonProgress,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm giao dịch"
          accessibilityHint="Mở màn hình thêm giao dịch mới"
          onPress={() => {
            Keyboard.dismiss();
            router.push('/transaction/new');
          }}
          style={({ pressed }) => ({
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
            elevation: 5,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
          })}
        >
          <Icon name="add-outline" color="#FFFFFF" size={28} />
        </Pressable>
      </Animated.View>
      {filterOpen && (
        <TransactionFiltersModal
          initialValue={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(next) => {
            set('historyFilters', next);
            setFilterOpen(false);
          }}
        />
      )}
    </ScreenContainer>
  );
}
