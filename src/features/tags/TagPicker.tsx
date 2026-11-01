import { useState } from 'react';
import { Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { Dropdown } from '../../components/ui/Dropdown';
import { Icon, ScreenContainer, s } from '../../components/ui';
import { PickerLabel } from '../../components/ui/PickerLabel';
import { useFinance } from '../../hooks/finance';
import { TagManager } from './TagManager';

export function TagPicker({
  value,
  onChange,
  filter = false,
  label,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  filter?: boolean;
  label?: string;
}) {
  const { data, busy } = useFinance();
  const [open, setOpen] = useState(false);
  const tags = data.tags ?? [];
  const options = tags
    .filter((t) => filter || !t.is_archived || value.includes(t.id))
    .map((t) => ({
      value: t.id,
      label: t.name + (t.is_archived ? ' · lưu trữ' : ''),
      icon: 'pricetag-outline',
    }));
  return (
    <View style={s.selectGroup}>
      <PickerLabel
        label={label ?? (filter ? 'Lọc theo tag' : 'Tag (không bắt buộc)')}
        addLabel="Thêm tag mới"
        disabled={busy}
        onAdd={
          filter
            ? undefined
            : () => {
                Keyboard.dismiss();
                setOpen(true);
              }
        }
      />
      {options.length ? (
        <Dropdown
          multiple
          label="Tag"
          placeholder={filter ? 'Tất cả tag' : 'Chọn một hoặc nhiều tag'}
          options={options}
          value={value}
          onChange={(ids) => {
            if (!busy) onChange(ids);
          }}
        />
      ) : (
        <Text style={s.muted}>
          {filter
            ? 'Chưa có tag để lọc.'
            : 'Tạo tag để nhóm giao dịch theo ý bạn.'}
        </Text>
      )}
      {value.length > 0 && (
        <View style={s.wrap}>
          {value.map((id) => {
            const tag = tags.find((t) => t.id === id);
            if (!tag) return null;
            return (
              <Pressable
                key={id}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Bỏ tag ${tag.name}`}
                onPress={() =>
                  onChange(value.filter((selected) => selected !== id))
                }
                style={[
                  s.row,
                  {
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderRadius: 22,
                    backgroundColor: `${tag.color}18`,
                    borderWidth: 1,
                    borderColor: tag.color,
                  },
                ]}
              >
                <Icon name="pricetag-outline" color={tag.color} size={16} />
                <Text style={s.text}>{tag.name}</Text>
                <Icon name="close-outline" size={16} />
              </Pressable>
            );
          })}
        </View>
      )}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <ScreenContainer
          title="Tag"
          scroll={false}
          onClose={() => setOpen(false)}
          closeDisabled={busy}
        >
          {open && (
            <TagManager
              createOnly
              onClose={() => setOpen(false)}
              onSelect={(id) => {
                if (!value.includes(id)) onChange([...value, id]);
                setOpen(false);
              }}
            />
          )}
        </ScreenContainer>
      </Modal>
    </View>
  );
}
