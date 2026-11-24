import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { AppState, SectionList, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import {
  Amount,
  Choices,
  EmptyState,
  SearchField,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { DebtRow } from '../../features/debts/DebtRow';
import { useFinance } from '../../hooks/finance';
import {
  createDebtEntries,
  debtTotals,
  groupDebts,
  type DebtKind,
  type DebtSide,
} from '../../services/debts';
import { colors, layout } from '../../theme';
import { HeroCard, MoneyRow, Disclosure } from '../../components/ui/primitives';

export default function Debts() {
  const { data, reminderWarning, busy } = useFinance();
  const params = useLocalSearchParams<{ side?: string; kind?: string }>();
  const side: DebtSide = params.side === 'payable' ? 'payable' : 'receivable';
  const collecting = side === 'receivable';
  const kind: DebtKind | '' = collecting
    ? params.kind === 'lend' || params.kind === 'purchase'
      ? params.kind
      : ''
    : '';
  const [status, setStatus] = useState<'open' | 'settled' | ''>('open');
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      const refresh = () => setNow(Date.now());
      refresh();
      const timer = setInterval(refresh, 60_000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, []),
  );
  const entries = useMemo(() => createDebtEntries(data), [data]);
  const totals = useMemo(() => debtTotals(entries), [entries]);
  const sections = useMemo(
    () => groupDebts(entries, { side, kind, status, search: query }),
    [entries, side, kind, status, query],
  );
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account.name])),
    [data.accounts],
  );
  const tint = collecting ? colors.primary : colors.expense;

  return (
    <ScreenContainer
      title="Công nợ"
      tabScreen
      scroll={false}
      floatingAction={
        <FloatingAddButton
          label="Thêm công nợ"
          hint="Chọn ghi cho vay, đi vay hoặc mua hộ"
          disabled={busy}
          onPress={() =>
            router.push({ pathname: '/debts/new', params: { side } })
          }
        />
      }
    >
      <SegmentedControl
        value={side}
        onChange={(next) => router.setParams({ side: next, kind: '' })}
        options={[
          { value: 'receivable', label: 'Cần thu' },
          { value: 'payable', label: 'Cần trả' },
        ]}
      />
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        extraData={now}
        keyExtractor={(entry) => entry.key}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: layout.floatingContentPadding }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <SecondaryButton
              label="Thu chi hộ · Nhận trước & quyết toán"
              icon="people-outline"
              onPress={() => router.push('/third-party')}
            />
            <HeroCard
              label={collecting ? 'Tổng tiền cần thu' : 'Tổng tiền cần trả'}
              value={totals[side]}
              subtitle="Tất cả các kỳ · Tổng trước bộ lọc"
            >
              {collecting && (
                <View style={{ gap: 8 }}>
                  <MoneyRow
                    label="Cho vay"
                    value={totals.lend}
                    tone={colors.onDark}
                    labelTone={colors.onDarkMuted}
                  />
                  <MoneyRow
                    label="Mua hộ chờ hoàn"
                    value={totals.purchase}
                    tone={colors.onDark}
                    labelTone={colors.onDarkMuted}
                  />
                </View>
              )}
            </HeroCard>
            {!!reminderWarning && <Text style={s.text}>{reminderWarning}</Text>}
            {collecting && (
              <Disclosure title="Lọc loại khoản cần thu" active={!!kind}>
                <Choices<DebtKind | ''>
                  value={kind}
                  onChange={(next) => router.setParams({ kind: next })}
                  options={[
                    { value: '', label: 'Tất cả loại' },
                    { value: 'lend', label: 'Cho vay' },
                    { value: 'purchase', label: 'Mua hộ' },
                  ]}
                />
              </Disclosure>
            )}
            <Choices
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: 'open',
                  label: collecting ? 'Chưa thu hết' : 'Chưa trả hết',
                },
                { value: 'settled', label: 'Đã xong' },
                { value: '', label: 'Tất cả' },
              ]}
            />
            <SearchField
              label="Tìm công nợ"
              value={search}
              onChangeText={setSearch}
              placeholder="Tên người, nội dung, ghi chú"
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={[
              s.between,
              { marginTop: 24, marginBottom: 10, gap: 12, flexWrap: 'wrap' },
            ]}
          >
            <Text style={s.heading}>{section.title}</Text>
            <Amount value={section.remaining} style={{ color: tint }} />
          </View>
        )}
        renderItem={({ item }) => (
          <DebtRow
            entry={item}
            accountName={accountNames.get(item.accountId) ?? ''}
            now={now}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={
              collecting
                ? 'Chưa có khoản cần thu phù hợp'
                : 'Chưa có khoản cần trả phù hợp'
            }
            description={
              collecting
                ? 'Thêm khoản cho vay, mua hộ hoặc đổi bộ lọc để xem các khoản đã ghi.'
                : 'Thêm khoản đi vay hoặc đổi bộ lọc để xem các khoản đã ghi.'
            }
            icon="people-outline"
          />
        }
      />
    </ScreenContainer>
  );
}
