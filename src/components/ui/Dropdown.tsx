import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme';

interface Option {
  value: string;
  label: string;
  icon?: string;
}
function OptionIcon({ name }: { name?: string }) {
  if (!name || !(name in Ionicons.glyphMap)) return null;
  return (
    <Ionicons
      name={name as keyof typeof Ionicons.glyphMap}
      size={20}
      color={colors.primary}
    />
  );
}

type DropdownProps = {
  label: string;
  placeholder: string;
  options: Option[];
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);
export function Dropdown(props: DropdownProps) {
  const { label, placeholder, options, value } = props;
  const [open, setOpen] = useState(false);
  const selectedIds = Array.isArray(value) ? value : [value];
  const selected = options.filter((option) =>
    selectedIds.includes(option.value),
  );
  const selectedLabel = selected.length
    ? selected
        .slice(0, 2)
        .map((option) => option.label)
        .join(', ') + (selected.length > 2 ? ' +' + (selected.length - 2) : '')
    : placeholder;
  const disabled = !options.length;
  return (
    <>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label + ': ' + selectedLabel}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.trigger,
          { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
        ]}
      >
        <OptionIcon name={selected[0]?.icon} />
        <Text
          style={[
            styles.text,
            { flex: 1, color: selected.length ? colors.text : colors.muted },
          ]}
          numberOfLines={2}
        >
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={colors.muted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng danh sách"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
            <View style={styles.menu} accessibilityViewIsModal>
              <View style={styles.header}>
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.text,
                    { flex: 1, fontWeight: '700', fontSize: 18 },
                  ]}
                >
                  {label}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng danh sách"
                  onPress={() => setOpen(false)}
                  style={styles.close}
                >
                  <Ionicons
                    name="close-outline"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              </View>
              {props.multiple && selected.length > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      'Xóa lựa chọn ' + label.toLocaleLowerCase('vi-VN')
                    }
                    style={[styles.option, { paddingHorizontal: 12 }]}
                    onPress={() => {
                      if (props.multiple) props.onChange([]);
                    }}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={[styles.text, { color: colors.primary }]}>
                      Xóa lựa chọn
                    </Text>
                  </Pressable>
                </View>
              )}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 6 }}
              >
                {options.map((option) => {
                  const checked = selectedIds.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked }}
                      accessibilityLabel={option.label}
                      onPress={() => {
                        if (props.multiple)
                          props.onChange(
                            checked
                              ? props.value.filter((id) => id !== option.value)
                              : [...props.value, option.value],
                          );
                        else {
                          props.onChange(option.value);
                          setOpen(false);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          backgroundColor: checked
                            ? colors.light
                            : pressed
                              ? colors.background
                              : colors.card,
                        },
                      ]}
                    >
                      <OptionIcon name={option.icon} />
                      <Text style={[styles.text, { flex: 1 }]}>
                        {option.label}
                      </Text>
                      {(checked || props.multiple) && (
                        <Ionicons
                          name={
                            props.multiple
                              ? checked
                                ? 'checkbox-outline'
                                : 'square-outline'
                              : 'checkmark-outline'
                          }
                          size={22}
                          color={checked ? colors.primary : colors.muted}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
              {props.multiple && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOpen(false)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: colors.primary,
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Text
                    style={[styles.text, { color: 'white', fontWeight: '600' }]}
                  >
                    Xong
                  </Text>
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: { fontSize: 16, lineHeight: 24, color: colors.text },
  overlay: { flex: 1, backgroundColor: 'rgba(25, 56, 44, 0.35)' },
  safeArea: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
