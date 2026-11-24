import { useDeferredValue, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Icon, PrimaryButton, SearchField, TextButton, s } from './index';
import { BottomSheet } from './BottomSheet';
import { MotionPressable } from './MotionPressable';
import { colors, radius, spacing } from '../../theme';

interface Option {
  value: string;
  label: string;
  icon?: string;
}
type DropdownProps = {
  label: string;
  placeholder: string;
  options: Option[];
  disabled?: boolean;
  searchable?: boolean;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);
function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .trim();
}
export function Dropdown(props: DropdownProps) {
  const { label, placeholder, options, value, searchable = false } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = searchable ? normalizeSearch(deferredSearch) : '';
  const { height } = useWindowDimensions();
  const indexed = useMemo(
    () =>
      options.map((option) => ({ option, key: normalizeSearch(option.label) })),
    [options],
  );
  const filtered = query
    ? indexed.filter((row) => row.key.includes(query)).map((row) => row.option)
    : options;
  const selectedIds = Array.isArray(value) ? value : [value];
  const selectedSet = new Set(selectedIds);
  const selected = options.filter((option) => selectedSet.has(option.value));
  const selectedLabel = selected.length
    ? selected
        .slice(0, 2)
        .map((option) => option.label)
        .join(', ') + (selected.length > 2 ? ' +' + (selected.length - 2) : '')
    : placeholder;
  const disabled = !!props.disabled || !options.length;
  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
  };
  return (
    <>
      <MotionPressable
        accessibilityRole="combobox"
        accessibilityLabel={label + ': ' + selectedLabel}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setSearch('');
          setOpen(true);
        }}
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: open ? colors.primary : colors.border,
          borderRadius: radius.input,
          paddingHorizontal: 14,
          paddingVertical: spacing.compact,
          backgroundColor: colors.card,
        }}
      >
        {selected[0]?.icon && <Icon name={selected[0].icon} size={20} />}
        <Text
          style={[
            s.text,
            {
              flex: 1,
              minWidth: 0,
              color: selected.length ? colors.text : colors.placeholder,
            },
          ]}
        >
          {selectedLabel}
        </Text>
        <Icon name="chevron-down-outline" size={18} color={colors.muted} />
      </MotionPressable>
      <BottomSheet
        visible={open}
        title={label}
        onClose={close}
        footer={
          props.multiple ? (
            <PrimaryButton label="Xong" onPress={close} />
          ) : undefined
        }
      >
        <View style={{ gap: spacing.sm, flexShrink: 1 }}>
          {searchable && (
            <SearchField
              label={'Tìm ' + label.toLocaleLowerCase('vi-VN')}
              placeholder={'Tìm ' + label.toLocaleLowerCase('vi-VN')}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={Keyboard.dismiss}
            />
          )}
          {props.multiple && selected.length > 0 && (
            <TextButton
              label={`Bỏ chọn tất cả (${selected.length})`}
              onPress={() => {
                if (props.multiple) props.onChange([]);
              }}
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(option) => option.value}
            style={{
              maxHeight: Math.max(160, height * 0.55),
              flexShrink: 1,
              flexGrow: 0,
            }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text
                style={[
                  s.muted,
                  { paddingVertical: spacing.comfortable, textAlign: 'center' },
                ]}
              >
                Không tìm thấy kết quả phù hợp.
              </Text>
            }
            renderItem={({ item: option }) => {
              const checked = selectedSet.has(option.value);
              return (
                <Pressable
                  accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                  accessibilityState={
                    props.multiple ? { checked } : { selected: checked }
                  }
                  onPress={() => {
                    if (props.multiple)
                      props.onChange(
                        checked
                          ? selectedIds.filter((id) => id !== option.value)
                          : [...selectedIds, option.value],
                      );
                    else {
                      props.onChange(option.value);
                      close();
                    }
                  }}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.compact,
                    gap: spacing.compact,
                    borderRadius: radius.icon,
                    backgroundColor: checked
                      ? colors.light
                      : pressed
                        ? colors.surfaceSecondary
                        : colors.card,
                  })}
                >
                  {option.icon && <Icon name={option.icon} size={20} />}
                  <Text
                    style={[
                      s.text,
                      {
                        flex: 1,
                        minWidth: 0,
                        fontWeight: checked ? '500' : '400',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {(checked || props.multiple) && (
                    <Icon
                      name={
                        props.multiple
                          ? checked
                            ? 'checkbox-outline'
                            : 'square-outline'
                          : 'checkmark-outline'
                      }
                      size={20}
                      color={checked ? colors.primary : colors.muted}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </BottomSheet>
    </>
  );
}
