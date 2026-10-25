import { Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  Amount,
  AppCard,
  Choices,
  Field,
  SecondaryButton,
  s,
} from '../../components/ui';
import type { ReceiptAdjustment } from '../../types/finance';
import { FinanceError } from '../../services/accounting/money';
import {
  calculateReceipt,
  parsePercent,
  parseAdjustmentAmount,
  adjustmentLabel,
} from '../../services/accounting/receipt';

export interface AdjustmentDraft {
  id: string;
  name: string;
  percent: string;
  mode: 'percent' | 'fixed';
  amount: string;
}
export function parseAdjustmentDrafts(
  drafts: AdjustmentDraft[],
): ReceiptAdjustment[] {
  return drafts.map((d): ReceiptAdjustment => ({
    id: d.id,
    name: d.name.trim(),
    ...(d.mode === 'fixed'
      ? { kind: 'fixed' as const, amount_vnd: parseAdjustmentAmount(d.amount) }
      : { kind: 'percent' as const, rate_bps: parsePercent(d.percent) }),
  }));
}
export function previewReceipt(
  items: readonly { amount: string }[],
  adjustments: AdjustmentDraft[],
) {
  try {
    // The service applies the same validation when saving; invalid drafts never reach SQLite.
    const amounts = items.map((i) => ({
      amount: /^\d+$/.test(i.amount) ? Number(i.amount) : NaN,
    }));
    return {
      summary: calculateReceipt(amounts, parseAdjustmentDrafts(adjustments)),
      error: '',
    };
  } catch (e) {
    return {
      summary: null,
      error:
        e instanceof FinanceError
          ? e.message
          : 'Kiểm tra các mục chi và điều chỉnh.',
    };
  }
}
export function ReceiptAdjustments({
  drafts,
  onChange,
  summary,
  error,
}: {
  drafts: AdjustmentDraft[];
  onChange: (value: AdjustmentDraft[]) => void;
  summary: ReturnType<typeof calculateReceipt> | null;
  error: string;
}) {
  return (
    <>
      <Text style={s.heading}>Điều chỉnh hóa đơn</Text>
      <Text style={s.muted}>
        Chọn % hoặc số tiền VND cho mỗi dòng. Dấu - để giảm, dấu + để cộng. Các
        dòng % tính trên tạm tính ban đầu; dòng VND cộng hoặc trừ trực tiếp.
      </Text>
      {drafts.map((draft, index) => (
        <AppCard key={draft.id}>
          <Field
            label={`Tên điều chỉnh ${index + 1}`}
            value={draft.name}
            maxLength={100}
            placeholder="Ví dụ: Chiết khấu"
            onChangeText={(name) =>
              onChange(
                drafts.map((d) => (d.id === draft.id ? { ...d, name } : d)),
              )
            }
          />
          <Choices
            value={draft.mode}
            options={[
              { value: 'percent', label: 'Phần trăm (%)' },
              { value: 'fixed', label: 'Số tiền (VND)' },
            ]}
            onChange={(mode) =>
              onChange(
                drafts.map((d) => (d.id === draft.id ? { ...d, mode } : d)),
              )
            }
          />
          <Field
            label={
              draft.mode === 'fixed' ? 'Số tiền điều chỉnh (VND)' : 'Tỷ lệ (%)'
            }
            value={draft.mode === 'fixed' ? draft.amount : draft.percent}
            maxLength={draft.mode === 'fixed' ? 17 : 8}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={
              draft.mode === 'fixed' ? '-10000 hoặc +10000' : '-5 hoặc +5'
            }
            onChangeText={(value) =>
              onChange(
                drafts.map((d) =>
                  d.id === draft.id
                    ? {
                        ...d,
                        [draft.mode === 'fixed' ? 'amount' : 'percent']: value,
                      }
                    : d,
                ),
              )
            }
          />
          {summary && <Amount value={summary.lines[index].amount} reveal />}
          <SecondaryButton
            label="Bỏ điều chỉnh"
            danger
            onPress={() => onChange(drafts.filter((d) => d.id !== draft.id))}
          />
        </AppCard>
      ))}
      <SecondaryButton
        label="Thêm điều chỉnh"
        icon="add-outline"
        disabled={drafts.length >= 20}
        onPress={() =>
          onChange([
            ...drafts,
            {
              id: randomUUID(),
              name: '',
              mode: 'percent',
              percent: '-5',
              amount: '',
            },
          ])
        }
      />
      <AppCard>
        {summary ? (
          <>
            <View style={s.between}>
              <Text style={s.text}>Tạm tính</Text>
              <Amount value={summary.subtotal} reveal />
            </View>
            {summary.lines.map((line) => (
              <View key={line.id} style={s.between}>
                <Text style={[s.text, { flex: 1 }]}>
                  {adjustmentLabel(line)}
                </Text>
                <Amount value={line.amount} reveal />
              </View>
            ))}
            <View style={s.divider} />
            <View style={s.between}>
              <Text style={s.heading}>Tổng thanh toán</Text>
              <Amount value={summary.total} reveal />
            </View>
            <Text style={s.muted}>
              Làm tròn từng điều chỉnh đến 1 VND. Chỉ trừ tài khoản một lần theo
              tổng thanh toán; thống kê danh mục được phân bổ tương ứng.
            </Text>
          </>
        ) : (
          <Text style={s.muted}>{error}</Text>
        )}
      </AppCard>
    </>
  );
}
