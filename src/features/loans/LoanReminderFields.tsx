import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Dropdown } from '../../components/ui/Dropdown';
import { SecondaryButton } from '../../components/ui';

export function reminderTimeLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function LoanReminderFields({
  value,
  onChange,
  lending,
  timeMinutes,
  onTimeChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  lending: boolean;
  timeMinutes: number;
  onTimeChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  const [showTime, setShowTime] = useState(false);
  const time = new Date();
  time.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);
  return (
    <>
      <Dropdown
        disabled={disabled}
        label={lending ? 'Ngày thu tiền hằng tháng' : 'Ngày trả nợ hằng tháng'}
        placeholder="Chọn ngày trong tháng"
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: 'Không nhắc hằng tháng' },
          ...Array.from({ length: 31 }, (_, i) => ({
            value: String(i + 1),
            label: `Ngày ${i + 1} hằng tháng`,
          })),
        ]}
      />
      {!!value && (
        <SecondaryButton
          label={`Giờ nhắc: ${reminderTimeLabel(timeMinutes)}`}
          icon="time-outline"
          disabled={disabled}
          onPress={() => setShowTime(true)}
        />
      )}
      {showTime && !!value && (
        <DateTimePicker
          value={time}
          mode="time"
          is24Hour
          onValueChange={(_, selected) => {
            setShowTime(false);
            onTimeChange(selected.getHours() * 60 + selected.getMinutes());
          }}
          onDismiss={() => setShowTime(false)}
        />
      )}
    </>
  );
}
