import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Amount,
  AppCard,
  Choices,
  EmptyState,
  SearchField,
  ScreenContainer,
  s,
} from '../../components/ui';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { Dropdown } from '../../components/ui/Dropdown';
import { PeriodFilter } from '../../components/PeriodFilter';
import { useFinance } from '../../hooks/finance';
import { initialFilters } from '../../stores/preferences';
import { periodRange } from '../../services/accounting/ledger';
import { filterThirdPartyCases } from '../../services/third-party-list';
import {
  thirdPartyBalances,
  thirdPartyFinancialLabels,
  thirdPartyStatusLabels,
  thirdPartyTotals,
} from '../../services/third-party';
import type {
  ThirdPartyFinancialStatus,
  ThirdPartyStatus,
} from '../../types/third-party';
import { colors, layout } from '../../theme';
import { TagPicker } from '../../features/tags/TagPicker';
import {
  Disclosure,
  HeroCard,
  MoneyRow,
  StatusBadge,
} from '../../components/ui/primitives';

export default function ThirdPartyCases() {
  const { data, busy } = useFinance();
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search);
  const [person, setPerson] = useState('');
  const [status, setStatus] = useState<ThirdPartyStatus | ''>('');
  const [financial, setFinancial] = useState<
    ThirdPartyFinancialStatus | 'unresolved' | ''
  >('');
  const [period, setPeriod] = useState(initialFilters);
  const [timeFilter, setTimeFilter] = useState<'all' | 'period'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const balances = useMemo(() => thirdPartyBalances(data), [data]);
  const totals = useMemo(() => thirdPartyTotals(data), [data]);
  const people = useMemo(
    () =>
      [
        ...new Set((data.thirdPartyCases ?? []).map((item) => item.person)),
      ].sort((a, b) => a.localeCompare(b, 'vi')),
    [data.thirdPartyCases],
  );
  const cases = useMemo(
    () =>
      filterThirdPartyCases(data, {
        search: query,
        person,
        status,
        financial,
        tags,
        range:
          timeFilter === 'period'
            ? periodRange(period.date, period.period)
            : undefined,
      }),
    [data, query, person, status, financial, tags, timeFilter, period],
  );
  return (
    <ScreenContainer
      title="Thu chi hộ"
      back
      scroll={false}
      floatingAction={
        <FloatingAddButton
          label="Tạo khoản thu chi hộ"
          hint="Tạo hồ sơ mà chưa cần ghi dòng tiền"
          disabled={busy}
          onPress={() => router.push('/third-party/new')}
        />
      }
    >
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: layout.floatingContentPadding }}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 18 }}>
            <HeroCard
              label="Tiền cần thu lại"
              value={totals.receivable}
              subtitle={`${totals.open} chưa hoàn tất · ${totals.completed} đã hoàn tất`}
            >
              <MoneyRow
                label="Đang giữ hộ"
                value={totals.holding}
                tone={colors.onDark}
                labelTone={colors.onDarkMuted}
              />
              <Text style={[s.muted, { color: colors.onDarkMuted }]}>
                Tổng trước bộ lọc, gồm hồ sơ đã hủy còn công nợ.
              </Text>
            </HeroCard>
            <SearchField
              label="Tìm hồ sơ"
              value={search}
              onChangeText={setSearch}
              placeholder="Tên, người liên quan, nội dung"
            />
            <Disclosure
              title="Bộ lọc hồ sơ"
              active={
                !!person ||
                !!status ||
                !!financial ||
                !!tags.length ||
                timeFilter === 'period'
              }
            >
              <View style={{ gap: 12 }}>
                <Dropdown
                  label="Người liên quan"
                  placeholder="Tất cả người"
                  searchable
                  value={person}
                  onChange={setPerson}
                  options={[
                    { value: '', label: 'Tất cả người' },
                    ...people.map((name) => ({ value: name, label: name })),
                  ]}
                />
                <Dropdown
                  label="Trạng thái công việc"
                  placeholder="Tất cả trạng thái"
                  value={status}
                  onChange={(value) =>
                    setStatus(value as ThirdPartyStatus | '')
                  }
                  options={[
                    { value: '', label: 'Tất cả trạng thái' },
                    ...(
                      Object.keys(thirdPartyStatusLabels) as ThirdPartyStatus[]
                    ).map((value) => ({
                      value,
                      label: thirdPartyStatusLabels[value],
                    })),
                  ]}
                />
                <Choices
                  value={financial}
                  onChange={setFinancial}
                  options={[
                    { value: '', label: 'Tất cả' },
                    { value: 'unresolved', label: 'Cần quyết toán' },
                    { value: 'holding', label: 'Đang giữ hộ' },
                    { value: 'receivable', label: 'Cần thu lại' },
                    { value: 'balanced', label: 'Đã cân bằng' },
                  ]}
                />
                <TagPicker filter value={tags} onChange={setTags} />
                <Choices
                  value={timeFilter}
                  onChange={setTimeFilter}
                  options={[
                    { value: 'all', label: 'Mọi thời gian' },
                    { value: 'period', label: 'Lọc ngày bắt đầu' },
                  ]}
                />
                {timeFilter === 'period' && (
                  <PeriodFilter
                    value={period}
                    onChange={(patch) =>
                      setPeriod((old) => ({ ...old, ...patch }))
                    }
                  />
                )}
              </View>
            </Disclosure>
          </View>
        }
        renderItem={({ item }) => {
          const balance = balances.get(item.id)!;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title} · ${item.person}`}
              onPress={() =>
                router.push({
                  pathname: '/third-party/[id]',
                  params: { id: item.id },
                })
              }
              style={{ marginBottom: 12 }}
            >
              <AppCard>
                <Text style={s.heading}>{item.title}</Text>
                <Text style={s.text}>{item.person}</Text>
                <View style={s.wrap}>
                  <StatusBadge
                    label={thirdPartyStatusLabels[item.status]}
                    tone={
                      item.status === 'completed'
                        ? 'positive'
                        : item.status === 'cancelled'
                          ? 'neutral'
                          : 'brand'
                    }
                  />
                  <StatusBadge
                    label={thirdPartyFinancialLabels[balance.financialStatus]}
                    tone={balance.difference ? 'warning' : 'positive'}
                  />
                </View>
                <View style={[s.between, { flexWrap: 'wrap' }]}>
                  <Text style={s.muted}>
                    {balance.difference > 0
                      ? 'Đang giữ hộ'
                      : balance.difference < 0
                        ? 'Cần thu lại'
                        : 'Chênh lệch'}
                  </Text>
                  <Amount value={Math.abs(balance.difference)} />
                </View>
                <Text style={s.muted}>
                  Bắt đầu{' '}
                  {new Date(item.started_at).toLocaleDateString('vi-VN')} · Tạo{' '}
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </Text>
                {!!item.due_at && (
                  <Text style={s.muted}>
                    Hạn quyết toán{' '}
                    {new Date(item.due_at).toLocaleDateString('vi-VN')}
                  </Text>
                )}
              </AppCard>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có hồ sơ phù hợp"
            description="Tạo khoản thu chi hộ mới hoặc đổi bộ lọc. Hồ sơ có thể tạo trước khi có dòng tiền."
            icon="people-outline"
          />
        }
      />
    </ScreenContainer>
  );
}
