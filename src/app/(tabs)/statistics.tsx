import { categoryReportRows } from '../../services/accounting/category-report';
import { categoryPath } from '../../services/categories/hierarchy';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AccountPicker,
  Amount,
  AppCard,
  Choices,
  EmptyState,
  Icon,
  ScreenContainer,
  SecondaryButton,
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
export default function Statistics() {
  const { data } = useFinance();
  const filters = usePreferences((v) => v.reportFilters);
  const set = usePreferences((v) => v.setFilters);
  const [mode, setMode] = useState<CategoryType>('expense');
  const summary = useMemo(() => statistics(data, filters), [data, filters]);
  const [parentId, setParentId] = useState<string | null>(null);
  const parent = data.categories.find((c) => c.id === parentId);
  const visibleRows = categoryReportRows(
    data.categories.filter((c) => c.type === mode),
    summary.categories,
    parentId,
    summary.categoryTotals,
  );
  const total = summary.hasCategoryTags
    ? mode === 'expense'
      ? summary.expense
      : summary.income
    : visibleRows.reduce((sum, r) => safeAdd(sum, r.amount), 0);
  return (
    <ScreenContainer
      title="Thống kê"
      subtitle="Hiểu dòng tiền, an tâm hơn mỗi ngày."
    >
      <AppCard>
        <PeriodFilter
          value={filters}
          onChange={(value) => set('reportFilters', value)}
        />
        <AccountPicker
          all
          accounts={data.accounts}
          value={filters.account}
          onChange={(account) => set('reportFilters', { account })}
        />
      </AppCard>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <AppCard style={{ flex: 1, padding: 15 }}>
          <Text style={s.muted}>Thu nhập</Text>
          <Amount value={summary.income} style={{ color: colors.income }} />
        </AppCard>
        <AppCard style={{ flex: 1, padding: 15 }}>
          <Text style={s.muted}>Chi tiêu</Text>
          <Amount value={summary.expense} style={{ color: colors.expense }} />
        </AppCard>
      </View>
      <AppCard>
        <View style={s.between}>
          <Text style={s.text}>Chênh lệch thu − chi</Text>
          <Amount
            value={summary.net}
            style={{ color: summary.net < 0 ? colors.expense : colors.primary }}
          />
        </View>
        <Text style={s.muted}>Không tính số dư ban đầu và chuyển nội bộ.</Text>
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
          onChange={(next) => {
            setMode(next);
            setParentId(null);
          }}
          options={[
            { value: 'expense', label: 'Chi tiêu' },
            { value: 'income', label: 'Thu nhập' },
          ]}
        />
        {parent && (
          <SecondaryButton
            label={`Quay lại · ${categoryPath(data.categories, parent.id)}`}
            icon="arrow-back-outline"
            onPress={() => setParentId(parent.parent_id ?? null)}
          />
        )}
        <Text style={s.muted}>
          {summary.hasCategoryTags
            ? 'Mỗi danh mục tính toàn bộ giao dịch được gắn nhãn. Các danh mục có thể trùng giao dịch nên không cộng các dòng với nhau. Tỷ lệ so với tổng thu hoặc chi trong kỳ.'
            : 'Tổng danh mục cha gồm các cấp con. Chạm danh mục để xem chi tiết.'}
        </Text>
        {visibleRows.length > 0 && total > 0 ? (
          <>
            {!summary.hasCategoryTags && (
              <DonutChart rows={visibleRows} total={total} />
            )}
            {visibleRows.map((row) => (
              <Pressable
                key={row.id}
                style={[s.between, { minHeight: 48 }]}
                accessibilityRole="button"
                accessibilityLabel={`Chi tiết ${row.name}`}
                disabled={
                  row.id === parentId ||
                  !data.categories.some((c) => c.parent_id === row.id)
                }
                onPress={() => setParentId(row.id)}
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
                <Amount value={row.amount} />
              </Pressable>
            ))}
          </>
        ) : (
          <EmptyState
            title={mode === 'expense' ? 'Chưa có chi tiêu' : 'Chưa có thu nhập'}
            description="Các khoản trong kỳ sẽ xuất hiện ở đây."
          />
        )}
      </AppCard>
    </ScreenContainer>
  );
}
