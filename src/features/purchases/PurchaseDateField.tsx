import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Field, Icon, TextButton, s } from '../../components/ui';
import { MotionPressable } from '../../components/ui/MotionPressable';
import { colors, radius, spacing } from '../../theme';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

export function PurchaseDateField({
  label,
  value,
  onChange,
  disabled = false,
  optional = false,
  onValidityChange,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  optional?: boolean;
  onValidityChange?: (valid: boolean) => void;
}) {
  const { stack } = useResponsiveLayout();
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [raw, setRaw] = useState(() =>
    value
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}${optional ? '' : ` ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`}`
      : '',
  );
  const [invalid, setInvalid] = useState(false);
  const date = value ?? new Date();
  return (
    <View style={{ gap: 8 }}>
      {Platform.OS === 'web' ? (
        <>
          <Field
            label={`${label} (YYYY-MM-DD${optional ? '' : ' HH:mm'})`}
            value={raw}
            editable={!disabled}
            placeholder={optional ? 'Không bắt buộc' : '2026-11-17 10:30'}
            onChangeText={(input) => {
              setRaw(input);
              const text = input.trim();
              if (!text && optional) {
                setInvalid(false);
                onValidityChange?.(true);
                onChange(null);
                return;
              }
              const match =
                /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(text);
              let next: Date | null = null;
              if (match && (optional || match[4] !== undefined)) {
                const [, year, month, day, hour = '23', minute = '59'] = match;
                const parsed = new Date(
                  Number(year),
                  Number(month) - 1,
                  Number(day),
                  Number(hour),
                  Number(minute),
                  optional ? 59 : 0,
                  optional ? 999 : 0,
                );
                if (
                  parsed.getFullYear() === Number(year) &&
                  parsed.getMonth() === Number(month) - 1 &&
                  parsed.getDate() === Number(day) &&
                  parsed.getHours() === Number(hour) &&
                  parsed.getMinutes() === Number(minute)
                )
                  next = parsed;
              }
              setInvalid(!next);
              onValidityChange?.(!!next);
              if (next) onChange(next);
            }}
          />
          {invalid && (
            <Text style={s.muted}>
              Nhập ngày giờ hợp lệ theo định dạng ở trên.
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={s.label}>{label}</Text>
          <View
            style={{ flexDirection: stack ? 'column' : 'row', gap: spacing.sm }}
          >
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${value ? value.toLocaleDateString('vi-VN') : 'Chưa chọn'}`}
              disabled={disabled}
              onPress={() => setPicker('date')}
              style={[
                s.row,
                {
                  flex: stack ? undefined : 1,
                  minHeight: 48,
                  borderRadius: radius.input,
                  padding: spacing.compact,
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <Icon name="calendar-outline" size={18} />
              <Text style={[s.text, { flex: 1 }]}>
                {value ? value.toLocaleDateString('vi-VN') : 'Không bắt buộc'}
              </Text>
            </MotionPressable>
            {!optional && (
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={`Giờ: ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                disabled={disabled}
                onPress={() => setPicker('time')}
                style={[
                  s.row,
                  {
                    flex: stack ? undefined : 1,
                    minHeight: 48,
                    borderRadius: radius.input,
                    padding: spacing.compact,
                    backgroundColor: colors.surfaceSecondary,
                  },
                ]}
              >
                <Icon name="time-outline" size={18} />
                <Text style={[s.text, { flex: 1 }]}>
                  {date.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </MotionPressable>
            )}
          </View>
          {picker && (
            <DateTimePicker
              value={date}
              mode={picker}
              onValueChange={(_, selected) => {
                const next = new Date(date);
                if (picker === 'date')
                  next.setFullYear(
                    selected.getFullYear(),
                    selected.getMonth(),
                    selected.getDate(),
                  );
                else next.setHours(selected.getHours(), selected.getMinutes());
                if (optional) next.setHours(23, 59, 59, 999);
                onChange(next);
                setPicker(null);
              }}
              onDismiss={() => setPicker(null)}
            />
          )}
        </>
      )}
      {optional && value && Platform.OS !== 'web' && (
        <TextButton
          label="Xóa ngày đã chọn"
          disabled={disabled}
          onPress={() => onChange(null)}
        />
      )}
    </View>
  );
}
