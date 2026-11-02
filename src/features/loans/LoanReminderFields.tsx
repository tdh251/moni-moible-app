import { Text } from 'react-native';
import { Dropdown } from '../../components/ui/Dropdown';
import { s } from '../../components/ui';

export function LoanReminderFields({
  value,
  onChange,
  lending,
}: {
  value: string;
  onChange: (value: string) => void;
  lending: boolean;
}) {
  return (
    <>
      <Dropdown
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
      <Text style={s.muted}>
        Nhắc lúc 09:00 theo giờ trên máy. Tháng thiếu ngày đã chọn sẽ nhắc vào
        ngày cuối tháng. Dừng khi tất toán hoặc hết kỳ hạn.
      </Text>
      <Text style={s.muted}>
        Máy lưu tối đa 60 thông báo sắp tới. Mở Moni định kỳ để bổ sung lịch
        nhắc cho các tháng tiếp theo.
      </Text>
    </>
  );
}
