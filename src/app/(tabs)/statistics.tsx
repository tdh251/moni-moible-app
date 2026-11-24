import { TagPicker } from '../../features/tags/TagPicker';
import { categoryReportRows } from '../../services/accounting/category-report';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  AccountPicker,
  Amount,
  AppCard,
  Choices,
  EmptyState,
  Icon,
  ScreenContainer,
  s,
} from '../../components/ui';
import { PeriodFilter } from '../../components/PeriodFilter';
import { useFinance } from '../../hooks/finance';
import { usePreferences } from '../../stores/preferences';
import { safeAdd, statistics } from '../../services/accounting/ledger';
import type { CategoryType } from '../../types/finance';
import {
  DonutChart,
  IncomeExpenseChart,
} from '../../features/statistics/Charts';
import { colors } from '../../theme';
import {
  Disclosure,
  MoneyRow,
  SummaryCard,
} from '../../components/ui/primitives';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
export default function Statistics() {
  const { data } = useFinance();
  const { stack } = useResponsiveLayout();
  const filters = usePreferences((v) => v.reportFilters);
  const set = usePreferences((v) => v.setFilters);
  const [mode, setMode] = useState<CategoryType>('expense');
  const summary = useMemo(() => statistics(data, filters), [data, filters]);
  const visibleRows = useMemo(
    () =>
      categoryReportRows(
        data.categories.filter((c) => c.type === mode),
        summary.categories,
        null,
        summary.categoryTotals,
      ),
    [data.categories, mode, summary.categories, summary.categoryTotals],
  );
  const total = summary.hasCategoryTags
    ? mode === 'expense'
      ? summary.expense
      : summary.income
    : visibleRows.reduce((sum, r) => safeAdd(sum, r.amount), 0);
  return (
    <ScreenContainer
      tabScreen
      title="Thống kê"
      subtitle="Thu nhập và chi tiêu trong kỳ."
    >
      <AppCard>
        <PeriodFilter
          value={filters}
          onChange={(value) => set('reportFilters', value)}
        />
        <Disclosure
          title="Tài khoản & tag"
          active={!!filters.account || !!filters.tags?.length}
        >
          <View style={{ gap: 12 }}>
            <AccountPicker
              all
              variant="dropdown"
              accounts={data.accounts}
              value={filters.account}
              onChange={(account) => set('reportFilters', { account })}
            />
            <TagPicker
              filter
              value={filters.tags ?? []}
              onChange={(tags) => set('reportFilters', { tags })}
            />
          </View>
        </Disclosure>
      </AppCard>
      <View style={{ flexDirection: stack ? 'column' : 'row', gap: 12 }}>
        <SummaryCard
          label="Thu nhập"
          value={summary.income}
          kind="income"
          style={{ flex: stack ? undefined : 1 }}
        />
        <SummaryCard
          label="Chi tiêu"
          value={summary.expense}
          kind="expense"
          style={{ flex: stack ? undefined : 1 }}
        />
      </View>
      <AppCard>
        <MoneyRow
          label="Chênh lệch thu − chi"
          value={summary.net}
          strong
          tone={summary.net < 0 ? colors.expense : colors.primary}
        />
        <Text style={s.muted}>
          Không tính số dư ban đầu và chuyển nội bộ; đây không phải biến động số
          dư ví.
        </Text>
      </AppCard>
      {summary.income || summary.expense ? (
        <AppCard>
          <Text style={s.heading}>Thu nhập & chi tiêu</Text>
          <IncomeExpenseChart
            income={summary.income}
            expense={summary.expense}
          />
        </AppCard>
      ) : (
        <EmptyState
          title="Kỳ này chưa có thu chi"
          description="Chọn kỳ khác hoặc ghi giao dịch để xem thống kê."
          icon="bar-chart-outline"
        />
      )}
      <AppCard>
        <Text style={s.heading}>Giao dịch theo danh mục</Text>
        <Choices
          value={mode}
          onChange={setMode}
          options={[
            { value: 'expense', label: 'Chi tiêu' },
            { value: 'income', label: 'Thu nhập' },
          ]}
        />
        <Text style={s.muted}>
          {summary.hasCategoryTags
            ? 'Mỗi danh mục tính toàn bộ giao dịch được gắn nhãn. Các danh mục có thể trùng giao dịch nên không cộng các dòng với nhau. Tỷ lệ so với tổng thu hoặc chi trong kỳ.'
            : 'Số tiền giao dịch được tổng hợp theo từng danh mục.'}
        </Text>
        {visibleRows.length > 0 && total > 0 ? (
          <>
            {!summary.hasCategoryTags && (
              <DonutChart rows={visibleRows} total={total} />
            )}
            {visibleRows.map((row) => (
              <View
                key={row.id}
                style={[
                  s.between,
                  {
                    minHeight: 48,
                    flexDirection: stack ? 'column' : 'row',
                    alignItems: stack ? 'stretch' : 'center',
                    paddingVertical: 8,
                  },
                ]}
              >
                <View style={[s.row, { flex: 1 }]}>
                  <Icon name={row.icon} color={row.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.text}>{row.name}</Text>
                    <Text style={s.muted}>
                      {((row.amount / total) * 100).toLocaleString('vi-VN', {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </Text>
                  </View>
                </View>
                <Amount value={row.amount} style={{ alignSelf: 'flex-end' }} />
              </View>
            ))}
          </>
        ) : (
          <EmptyState
            title={mode === 'expense' ? 'Chưa có chi tiêu' : 'Chưa có thu nhập'}
            description="Các khoản trong kỳ sẽ xuất hiện ở đây."
          />
        )}
      </AppCard>
      <AppCard>
        <Text style={s.heading}>Thống kê theo tag</Text>
        <Text style={s.muted}>
          Một giao dịch có thể có nhiều tag. Mỗi tag tính toàn bộ thu/chi của
          giao dịch đó; không cộng các dòng tag với nhau. Chuyển nội bộ không
          tính vào thu/chi.
        </Text>
        {Object.keys(summary.tags).length ? (
          (data.tags ?? [])
            .filter((tag) => summary.tags[tag.id])
            .map((tag) => {
              const row = summary.tags[tag.id];
              return (
                <View
                  key={tag.id}
                  style={{
                    gap: 8,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={s.row}>
                    <Icon name="pricetag-outline" color={tag.color} />
                    <Text style={[s.text, { flex: 1 }]}>
                      {tag.name}
                      {tag.is_archived ? ' · lưu trữ' : ''}
                    </Text>
                  </View>
                  <Text style={s.muted}>{row.count} giao dịch thu/chi</Text>
                  <MoneyRow
                    label="Thu nhập"
                    value={row.income}
                    tone={colors.income}
                  />
                  <MoneyRow
                    label="Chi tiêu"
                    value={row.expense}
                    tone={colors.expense}
                  />
                </View>
              );
            })
        ) : (
          <EmptyState
            title="Chưa có thu chi gắn tag"
            description="Gắn tag khi ghi giao dịch, hoặc chọn kỳ và bộ lọc khác."
            icon="pricetags-outline"
          />
        )}
      </AppCard>
    </ScreenContainer>
  );
}
