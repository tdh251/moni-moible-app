import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  AppCard,
  Choices,
  ConfirmationDialog,
  EmptyState,
  Field,
  Icon,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import type { Category, CategoryType } from '../../types/finance';
import { colors } from '../../theme';
const icons = [
  'restaurant-outline',
  'basket-outline',
  'home-outline',
  'bus-outline',
  'bag-outline',
  'game-controller-outline',
  'medkit-outline',
  'receipt-outline',
  'briefcase-outline',
  'gift-outline',
  'wallet-outline',
  'ellipsis-horizontal-outline',
];
const palette = [
  '#287D68',
  '#B76553',
  '#D4A457',
  '#648DAB',
  '#9B7FA7',
  '#729B84',
];
export default function Categories() {
  const { data, mutate, busy } = useFinance();
  const [type, setType] = useState<CategoryType>('expense');
  const [draft, setDraft] = useState<Category | null>(null);
  const save = async () => {
    if (draft && (await mutate((repo) => repo.saveCategory(draft))))
      setDraft(null);
  };
  const archive = async () => {
    if (!draft) return;
    if (
      await ConfirmationDialog(
        draft.is_archived ? 'Khôi phục danh mục?' : 'Lưu trữ danh mục?',
        'Lịch sử và số liệu cũ được giữ nguyên.',
      )
    )
      if (
        await mutate((repo) =>
          repo.saveCategory({
            ...draft,
            is_archived: draft.is_archived ? 0 : 1,
          }),
        )
      )
        setDraft(null);
  };
  const list = data.categories.filter((c) => c.type === type);
  return (
    <ScreenContainer
      title="Danh mục"
      subtitle="Một cấp đơn giản, dễ tìm và dễ ghi."
      back
    >
      <Choices
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Chi tiêu' },
          { value: 'income', label: 'Thu nhập' },
        ]}
      />
      {list.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={`Sửa ${c.name}`}
          onPress={() => setDraft({ ...c })}
        >
          <AppCard>
            <View style={s.row}>
              <Icon name={c.icon} color={c.color} />
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{c.name}</Text>
                {!!c.is_archived && <Text style={s.muted}>Đã lưu trữ</Text>}
              </View>
              <Icon name="create-outline" size={20} />
            </View>
          </AppCard>
        </Pressable>
      ))}
      {!list.length && (
        <EmptyState
          title="Chưa có danh mục"
          description="Thêm một danh mục để bắt đầu."
        />
      )}
      <PrimaryButton
        label="Thêm danh mục"
        icon="add-outline"
        onPress={() =>
          setDraft({
            id: randomUUID(),
            name: '',
            type,
            icon: type === 'expense' ? 'basket-outline' : 'wallet-outline',
            color: colors.primary,
            sort_order: list.length,
            is_archived: 0,
          })
        }
      />
      <Modal
        visible={draft !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setDraft(null);
        }}
      >
        {draft && (
          <ScreenContainer
            title={
              data.categories.some((c) => c.id === draft.id)
                ? 'Sửa danh mục'
                : 'Thêm danh mục'
            }
          >
            <Text style={s.muted}>
              {draft.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
            </Text>
            <Field
              label="Tên danh mục"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              maxLength={100}
            />
            <Text style={s.label}>Biểu tượng</Text>
            <View style={s.wrap}>
              {icons.map((icon) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={icon}
                  accessibilityState={{ selected: draft.icon === icon }}
                  key={icon}
                  style={[s.pill, draft.icon === icon && s.selected]}
                  onPress={() => setDraft({ ...draft, icon })}
                >
                  <Icon name={icon} />
                </Pressable>
              ))}
            </View>
            <Text style={s.label}>Màu sắc</Text>
            <View style={s.wrap}>
              {palette.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={color}
                  accessibilityState={{ selected: draft.color === color }}
                  onPress={() => setDraft({ ...draft, color })}
                  style={[
                    s.pill,
                    {
                      backgroundColor: color,
                      borderWidth: draft.color === color ? 3 : 0,
                      borderColor: colors.text,
                      width: 45,
                      height: 45,
                    },
                  ]}
                />
              ))}
            </View>
            <PrimaryButton
              label="Lưu danh mục"
              disabled={busy}
              onPress={() => void save()}
            />
            {data.categories.some((c) => c.id === draft.id) && (
              <SecondaryButton
                label={
                  draft.is_archived ? 'Khôi phục danh mục' : 'Lưu trữ danh mục'
                }
                disabled={busy}
                onPress={() => void archive()}
              />
            )}
            <SecondaryButton
              label="Đóng"
              disabled={busy}
              onPress={() => setDraft(null)}
            />
          </ScreenContainer>
        )}
      </Modal>
    </ScreenContainer>
  );
}
