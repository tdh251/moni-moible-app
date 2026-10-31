import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Field, Icon, s } from '../../components/ui';
import { colors } from '../../theme';
import {
  categoryIconGroups,
  categoryPalette,
  normalizeIconSearch,
} from './appearance';

export function CategoryAppearancePicker({
  icon,
  color,
  name,
  disabled,
  onIconChange,
  onColorChange,
}: {
  icon: string;
  color: string;
  name: string;
  disabled: boolean;
  onIconChange: (value: string) => void;
  onColorChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState(
    () =>
      categoryIconGroups.find((g) => g.icons.some((item) => item.name === icon))
        ?.name ?? '',
  );
  const query = normalizeIconSearch(search);
  const allIcons = categoryIconGroups.flatMap((g) => g.icons);
  const selectedIcon = allIcons.find((item) => item.name === icon);
  const shownGroups = group
    ? categoryIconGroups.filter((g) => g.name === group)
    : categoryIconGroups;
  const shownIcons = shownGroups.flatMap((g) =>
    g.icons.filter(
      (item) =>
        !query ||
        normalizeIconSearch(`${g.name} ${item.label} ${item.name}`).includes(
          query,
        ),
    ),
  );
  const selectedColor = categoryPalette.find(
    (item) => item.color.toUpperCase() === color.toUpperCase(),
  );
  const palette = selectedColor
    ? categoryPalette
    : [{ color, label: 'Màu hiện tại' }, ...categoryPalette];
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.label}>Xem trước</Text>
      <View
        style={[
          s.row,
          {
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            backgroundColor: colors.card,
          },
        ]}
      >
        <View
          style={{
            width: 52,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: `${color}18`,
          }}
        >
          <Icon name={icon} color={color} size={30} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.text}>{name.trim() || 'Danh mục của bạn'}</Text>
          <Text style={s.muted}>
            {selectedIcon?.label ?? 'Biểu tượng hiện tại'} ·{' '}
            {selectedColor?.label ?? color}
          </Text>
        </View>
      </View>
      <Text style={s.label}>Biểu tượng · {allIcons.length} lựa chọn</Text>
      <Field
        label="Tìm biểu tượng"
        placeholder="Ví dụ: quần áo, cà phê, thú cưng..."
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setGroup('');
        }}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8 }}
      >
        {['', ...categoryIconGroups.map((g) => g.name)].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={value || 'Tất cả biểu tượng'}
            accessibilityState={{ selected: group === value, disabled }}
            disabled={disabled}
            onPress={() => setGroup(value)}
            style={[
              s.pill,
              { minHeight: 44, justifyContent: 'center' },
              group === value && s.selected,
            ]}
          >
            <Text style={[s.text, { fontSize: 13 }]}>{value || 'Tất cả'}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={s.muted}>
        {shownIcons.length
          ? `${shownIcons.length} biểu tượng${group ? ` · ${group}` : ''}`
          : 'Không tìm thấy biểu tượng. Thử từ khóa khác hoặc chọn Tất cả.'}
      </Text>
      <View style={[s.wrap, { gap: 10 }]}>
        {shownIcons.map((item) => (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: icon === item.name, disabled }}
            disabled={disabled}
            onPress={() => onIconChange(item.name)}
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderWidth: icon === item.name ? 2 : 1,
              borderColor: icon === item.name ? colors.primary : colors.border,
              backgroundColor: icon === item.name ? colors.light : colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={item.name}
              color={icon === item.name ? color : colors.text}
              size={26}
            />
            {icon === item.name && (
              <View
                style={{
                  position: 'absolute',
                  right: -3,
                  top: -3,
                  backgroundColor: colors.card,
                  borderRadius: 10,
                }}
              >
                <Icon name="checkmark-circle" size={18} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={s.label}>Màu sắc · {categoryPalette.length} lựa chọn</Text>
      <View style={[s.wrap, { gap: 10 }]}>
        {palette.map((item) => {
          const selected = color.toUpperCase() === item.color.toUpperCase();
          const red = parseInt(item.color.slice(1, 3), 16),
            green = parseInt(item.color.slice(3, 5), 16),
            blue = parseInt(item.color.slice(5, 7), 16);
          const checkColor =
            red * 0.299 + green * 0.587 + blue * 0.114 > 150
              ? colors.text
              : '#FFFFFF';
          return (
            <Pressable
              key={item.color}
              accessibilityRole="button"
              accessibilityLabel={`Màu ${item.label}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onColorChange(item.color)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 2,
                borderColor: selected ? colors.text : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: item.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected && (
                  <Icon name="checkmark-outline" size={23} color={checkColor} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.muted}>
        Đang chọn: {selectedColor?.label ?? 'Màu hiện tại'} ·{' '}
        {color.toUpperCase()}
      </Text>
    </View>
  );
}
