import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState, Icon, s } from '../../components/ui';
import type { Category } from '../../types/finance';
import { colors } from '../../theme';
import {
  categoryPath,
  categoryTree,
} from '../../services/categories/hierarchy';

export function CategoryList({
  categories,
  busy,
  value,
  onSelect,
  onEdit,
  onAddChild,
  onReorder,
}: {
  categories: Category[];
  busy: boolean;
  value?: string;
  onSelect?: (id: string) => void;
  onEdit: (category: Category) => void;
  onAddChild: (category: Category) => void;
  onReorder: (ids: string[]) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const disabled = busy || pending;
  const rows = categoryTree(categories);
  const visible = categoryTree(categories, collapsed);
  const move = async (category: Category, direction: number) => {
    const siblings = rows
      .map((r) => r.category)
      .filter((c) => (c.parent_id ?? null) === (category.parent_id ?? null));
    const index = siblings.findIndex((c) => c.id === category.id);
    const target = siblings[index + direction];
    if (!target || disabled) return;
    // Change only sibling order. Children stay attached to their parent.
    const ids = rows.map((r) => r.category.id);
    const a = ids.indexOf(category.id),
      b = ids.indexOf(target.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setPending(true);
    try {
      await onReorder(ids);
    } finally {
      setPending(false);
    }
  };
  return (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      {!rows.length && (
        <EmptyState
          title="Chưa có danh mục"
          description="Thêm một danh mục để bắt đầu."
        />
      )}
      {visible.map(({ category: c, depth }) => {
        const children = categories.some((child) => child.parent_id === c.id);
        const siblings = rows.filter(
          (r) => (r.category.parent_id ?? null) === (c.parent_id ?? null),
        );
        const position = siblings.findIndex((r) => r.category.id === c.id);
        return (
          <View
            key={c.id}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: 10,
              marginBottom: 8,
              marginLeft: Math.min(depth, 3) * 12,
              backgroundColor: value === c.id ? colors.light : colors.card,
            }}
          >
            <View style={s.row}>
              {children && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${collapsed.has(c.id) ? 'Mở' : 'Thu gọn'} ${c.name}`}
                  accessibilityState={{ expanded: !collapsed.has(c.id) }}
                  style={{ padding: 12 }}
                  onPress={() =>
                    setCollapsed((old) => {
                      const next = new Set(old);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                >
                  <Icon
                    name={
                      collapsed.has(c.id)
                        ? 'chevron-forward-outline'
                        : 'chevron-down-outline'
                    }
                    size={18}
                  />
                </Pressable>
              )}
              <Pressable
                disabled={disabled || (!!onSelect && !!c.is_archived)}
                accessibilityRole="button"
                accessibilityLabel={`${onSelect ? 'Chọn' : 'Sửa'} ${categoryPath(categories, c.id)}`}
                accessibilityState={{ selected: value === c.id }}
                style={[s.row, { flex: 1, minHeight: 48 }]}
                onPress={() => (onSelect ? onSelect(c.id) : onEdit(c))}
              >
                <Icon name={c.icon} color={c.color} />
                <View style={{ flex: 1 }}>
                  <Text style={s.text}>{c.name}</Text>
                  {depth > 0 && (
                    <Text style={s.muted} numberOfLines={2}>
                      {categoryPath(categories, c.id)}
                    </Text>
                  )}
                  {!!c.is_archived && <Text style={s.muted}>Đã lưu trữ</Text>}
                </View>
                {value === c.id && <Icon name="checkmark-outline" />}
              </Pressable>
              <Pressable
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Sửa ${c.name}`}
                style={{ padding: 12 }}
                onPress={() => onEdit(c)}
              >
                <Icon name="create-outline" size={20} />
              </Pressable>
            </View>
            <View style={[s.row, { justifyContent: 'flex-end' }]}>
              {!c.is_archived && (
                <Pressable
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Thêm danh mục con cho ${c.name}`}
                  style={[s.row, { minHeight: 44, paddingHorizontal: 10 }]}
                  onPress={() => onAddChild(c)}
                >
                  <Icon name="add-outline" size={18} />
                  <Text style={s.muted}>Thêm cấp con</Text>
                </Pressable>
              )}
              {[-1, 1].map((direction) => (
                <Pressable
                  key={direction}
                  disabled={
                    disabled ||
                    (direction === -1
                      ? position === 0
                      : position === siblings.length - 1)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${direction === -1 ? 'Chuyển lên' : 'Chuyển xuống'} ${c.name}`}
                  style={{
                    padding: 12,
                    opacity: (
                      direction === -1
                        ? position === 0
                        : position === siblings.length - 1
                    )
                      ? 0.3
                      : 1,
                  }}
                  onPress={() => void move(c, direction)}
                >
                  <Icon
                    name={
                      direction === -1
                        ? 'arrow-up-outline'
                        : 'arrow-down-outline'
                    }
                    size={18}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
