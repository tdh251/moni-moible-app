import { useDeferredValue, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme';
import { useReducedMotionPreference } from '../../hooks/motion';
import { MotionPressable } from './MotionPressable';

interface Option {
  value: string;
  label: string;
  icon?: string;
}
function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .trim();
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
  disabled?: boolean;
  searchable?: boolean;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);
export function Dropdown(props: DropdownProps) {
  const { label, placeholder, options, value, searchable = false } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const reducedMotion = useReducedMotionPreference();
  const deferredSearch = useDeferredValue(search);
  const query = searchable ? normalizeSearch(deferredSearch) : '';
  const searchOptions = useMemo(
    () =>
      options.map((option) => ({ option, key: normalizeSearch(option.label) })),
    [options],
  );
  const filteredOptions = query
    ? searchOptions
        .filter((row) => row.key.includes(query))
        .map((row) => row.option)
    : options;
  const searchLabel = 'Tìm ' + label.toLocaleLowerCase('vi-VN');
  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
  };
  const selectedIds = Array.isArray(value) ? value : [value];
  const selectedSet = new Set(selectedIds);
  const selected = options.filter((option) => selectedSet.has(option.value));
  const selectedLabel = selected.length
    ? selected
        .slice(0, 2)
        .map((option) => option.label)
        .join(', ') + (selected.length > 2 ? ' +' + (selected.length - 2) : '')
    : placeholder;
  const disabled = props.disabled || !options.length;
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
        style={styles.trigger}
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
      </MotionPressable>
      <Modal
        visible={open}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior="padding"
          enabled={searchable}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng danh sách"
            style={StyleSheet.absoluteFill}
            onPress={close}
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
                  onPress={close}
                  style={styles.close}
                >
                  <Ionicons
                    name="close-outline"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              </View>
              {searchable && (
                <View style={styles.search}>
                  <Ionicons
                    name="search-outline"
                    size={20}
                    color={colors.muted}
                  />
                  <TextInput
                    accessibilityLabel={searchLabel}
                    placeholder={searchLabel + '...'}
                    placeholderTextColor={colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={Keyboard.dismiss}
                    style={[styles.text, styles.searchInput]}
                  />
                  {search.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa từ khóa tìm kiếm"
                      onPress={() => setSearch('')}
                      style={styles.close}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={22}
                        color={colors.muted}
                      />
                    </Pressable>
                  )}
                </View>
              )}
              {props.multiple && selected.length > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      'Xóa lựa chọn ' + label.toLocaleLowerCase('vi-VN')
                    }
                    style={[
                      styles.option,
                      {
                        paddingHorizontal: 12,
                        backgroundColor: colors.dangerLight,
                        borderWidth: 1,
                        borderColor: colors.dangerBorder,
                      },
                    ]}
                    disabled={disabled}
                    onPress={() => {
                      if (props.multiple) props.onChange([]);
                    }}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={colors.danger}
                    />
                    <Text style={[styles.text, { color: colors.danger }]}>
                      Xóa lựa chọn
                    </Text>
                  </Pressable>
                </View>
              )}
              <FlatList
                data={filteredOptions}
                keyExtractor={(option) => option.value}
                extraData={value}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
                style={{ flexGrow: 0, flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 6 }}
                ListEmptyComponent={
                  <Text style={[styles.text, styles.empty]}>
                    Không tìm thấy kết quả phù hợp.
                  </Text>
                }
                renderItem={({ item: option }) => {
                  const checked = selectedSet.has(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked, disabled }}
                      disabled={disabled}
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
                          close();
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
                }}
              />
              {props.multiple && (
                <Pressable
                  accessibilityRole="button"
                  onPress={close}
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
        </KeyboardAvoidingView>
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
  search: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
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
