import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useNativeGesture,
  usePanGesture,
  type NativeGesture,
} from 'react-native-gesture-handler';
import { EmptyState, Icon, s } from '../../components/ui';
import { showError } from '../../hooks/finance';
import type { Category } from '../../types/finance';
import { colors } from '../../theme';
import {
  CATEGORY_ROW_GAP,
  categoryDropPosition,
  reorderCategoryIds,
  type CategoryRowLayout,
} from './reorder';

interface Drag {
  id: string;
  index: number;
  target: number;
  extent: number;
}
interface ActiveDrag extends Drag {
  ids: string[];
  layouts: CategoryRowLayout[];
  offset: number;
  translation: number;
  pointerY: number;
}

function DraggableCategory({
  category,
  selected,
  disabled,
  gestureEnabled,
  dragging,
  sorting,
  shift,
  translation,
  scrollGesture,
  position,
  count,
  onStart,
  onMove,
  onFinish,
  onPress,
  onEdit,
  onLayout,
  onAccessibleMove,
}: {
  category: Category;
  selected: boolean;
  disabled: boolean;
  gestureEnabled: boolean;
  dragging: boolean;
  sorting: boolean;
  shift: number;
  translation: Animated.Value;
  scrollGesture: NativeGesture;
  position: number;
  count: number;
  onStart: (id: string, translation: number, pointerY: number) => boolean;
  onMove: (id: string, translation: number, pointerY: number) => void;
  onFinish: (id: string, canceled: boolean) => void;
  onPress: () => void;
  onEdit: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onAccessibleMove: (direction: number) => void;
}) {
  const [offset] = useState(() => new Animated.Value(0));
  const wasDragged = useRef(false);
  const pan = usePanGesture({
    enabled: gestureEnabled,
    activateAfterLongPress: 400,
    maxPointers: 1,
    shouldCancelWhenOutside: false,
    cancelsJSResponder: true,
    runOnJS: true,
    block: scrollGesture,
    onBegin: () => {
      wasDragged.current = false;
    },
    onActivate: (event) => {
      wasDragged.current = onStart(
        category.id,
        event.translationY,
        event.absoluteY,
      );
    },
    onUpdate: (event) =>
      onMove(category.id, event.translationY, event.absoluteY),
    onDeactivate: (event) => {
      if (!event.canceled)
        onMove(category.id, event.translationY, event.absoluteY);
      onFinish(category.id, event.canceled);
    },
    onFinalize: () => onFinish(category.id, true),
  });
  useLayoutEffect(() => {
    if (!sorting) {
      offset.stopAnimation();
      offset.setValue(0);
      return;
    }
    const animation = Animated.spring(offset, {
      toValue: shift,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.8,
    });
    animation.start();
    return () => animation.stop();
  }, [offset, shift, sorting]);
  return (
    <GestureDetector gesture={pan} userSelect="none" enableContextMenu={false}>
      <Animated.View
        collapsable={false}
        onLayout={onLayout}
        style={{
          transform: [{ translateY: dragging ? translation : offset }],
          borderWidth: 2,
          borderColor: dragging ? colors.primary : colors.border,
          borderRadius: 16,
          backgroundColor: dragging || selected ? colors.light : colors.card,
          paddingHorizontal: 8,
          paddingVertical: 10,
          marginBottom: CATEGORY_ROW_GAP,
          zIndex: dragging ? 10 : 0,
          elevation: dragging ? 6 : 0,
          shadowColor: colors.primary,
          shadowOpacity: dragging ? 0.18 : 0,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <View style={s.row}>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityHint="Chạm để chọn hoặc sửa. Giữ để kéo đổi thứ tự."
            accessibilityState={{ selected, disabled }}
            accessibilityValue={{
              text: `Vị trí ${position + 1} trên ${count}`,
            }}
            accessibilityActions={[
              { name: 'moveUp', label: 'Chuyển lên' },
              { name: 'moveDown', label: 'Chuyển xuống' },
            ]}
            onAccessibilityAction={(event) => {
              if (disabled) return;
              if (event.nativeEvent.actionName === 'moveUp')
                onAccessibleMove(-1);
              else if (event.nativeEvent.actionName === 'moveDown')
                onAccessibleMove(1);
              else if (event.nativeEvent.actionName === 'activate') onPress();
            }}
            style={[s.row, { flex: 1, minHeight: 48 }]}
            onPress={() => {
              if (!wasDragged.current) onPress();
            }}
          >
            <Icon name={category.icon} color={category.color} />
            <View style={{ flex: 1 }}>
              <Text style={s.text} numberOfLines={2}>
                {category.name}
              </Text>
              {!!category.is_archived && (
                <Text style={s.muted}>Đã lưu trữ</Text>
              )}
            </View>
            {selected && <Icon name="checkmark-outline" />}
          </Pressable>
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Sửa ${category.name}`}
            style={{ padding: 12 }}
            onPress={() => {
              if (!wasDragged.current) onEdit();
            }}
          >
            <Icon name="create-outline" size={20} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function CategoryList({
  categories,
  busy,
  value,
  onSelect,
  onEdit,
  onReorder,
  onScroll,
  bottomPadding = 4,
}: {
  categories: Category[];
  busy: boolean;
  value?: string;
  onSelect?: (id: string) => void;
  onEdit: (category: Category) => void;
  onReorder: (ids: string[]) => Promise<boolean>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  bottomPadding?: number;
}) {
  const [pending, setPending] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [translation] = useState(() => new Animated.Value(0));
  const active = useRef<ActiveDrag | null>(null);
  const heights = useRef(new Map<string, number>());
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef<ComponentRef<typeof View>>(null);
  const geometry = useRef({ top: 0, height: 0, contentHeight: 0 });
  const offset = useRef(0);
  const scrollGesture = useNativeGesture();
  const rows = useMemo(() => {
    const sorted = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    if (!optimisticIds) return sorted;
    const byId = new Map(sorted.map((c) => [c.id, c]));
    return optimisticIds
      .map((id) => byId.get(id))
      .filter((c): c is Category => !!c);
  }, [categories, optimisticIds]);
  const orderKey = rows.map((c) => c.id).join('|');
  const cancel = useCallback(() => {
    active.current = null;
    translation.setValue(0);
    setDrag(null);
  }, [translation]);
  useEffect(() => {
    if (busy || (active.current && active.current.ids.join('|') !== orderKey))
      cancel();
  }, [busy, orderKey, cancel]);
  const updatePosition = useCallback(() => {
    const current = active.current;
    if (!current) return;
    const next = categoryDropPosition(
      current.layouts,
      current.id,
      current.translation + offset.current - current.offset,
    );
    if (!next) return;
    translation.setValue(next.translation);
    if (next.target !== current.target) {
      current.target = next.target;
      setDrag({
        id: current.id,
        index: current.index,
        target: next.target,
        extent: current.extent,
      });
    }
  }, [translation]);
  const start = (id: string, dy: number, pointerY: number) => {
    if (busy || pending || active.current) return false;
    const snapshot: CategoryRowLayout[] = [];
    let top = 4;
    for (const row of rows) {
      const height = heights.current.get(row.id);
      if (!height || height <= 0) return false;
      snapshot.push({ id: row.id, top, height });
      top += height + CATEGORY_ROW_GAP;
    }
    const initial = categoryDropPosition(snapshot, id, 0);
    if (!initial) return false;
    viewport.current?.measureInWindow((_, top, __, height) => {
      geometry.current = { ...geometry.current, top, height };
    });
    const next: ActiveDrag = {
      id,
      index: initial.index,
      target: initial.index,
      extent: initial.extent,
      ids: rows.map((c) => c.id),
      layouts: snapshot,
      offset: offset.current,
      translation: dy,
      pointerY,
    };
    active.current = next;
    translation.setValue(0);
    setDrag({
      id,
      index: next.index,
      target: next.target,
      extent: next.extent,
    });
    return true;
  };
  const move = (id: string, dy: number, pointerY: number) => {
    if (active.current?.id !== id) return;
    active.current.translation = dy;
    active.current.pointerY = pointerY;
    updatePosition();
  };
  const persist = async (ids: string[]) => {
    setPending(true);
    setOptimisticIds(ids);
    try {
      await onReorder(ids);
    } catch (error) {
      showError(error);
    } finally {
      setOptimisticIds(null);
      setPending(false);
    }
  };
  const finish = (id: string, canceled: boolean) => {
    const current = active.current;
    if (!current || current.id !== id) return;
    cancel();
    if (!canceled && current.index !== current.target)
      void persist(
        reorderCategoryIds(current.ids, current.index, current.target),
      );
  };
  const activeId = drag?.id;
  useEffect(() => {
    if (!activeId) return;
    let frame = 0;
    let previousTime = 0;
    const tick = (time: number) => {
      const current = active.current;
      if (!current) return;
      const { top, height, contentHeight } = geometry.current;
      const y = current.pointerY - top;
      const edge = Math.min(64, height / 3);
      const direction =
        y < edge
          ? -Math.min(1, (edge - y) / edge)
          : y > height - edge
            ? Math.min(1, (y - height + edge) / edge)
            : 0;
      const elapsed = previousTime ? Math.min(time - previousTime, 32) : 16;
      previousTime = time;
      const next = Math.max(
        0,
        Math.min(
          Math.max(0, contentHeight - height),
          offset.current + direction * elapsed * 0.55,
        ),
      );
      if (height > 0 && next !== offset.current) {
        offset.current = next;
        scroll.current?.scrollTo({ y: next, animated: false });
        updatePosition();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeId, updatePosition]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        ref={viewport}
        collapsable={false}
        style={{ flex: 1 }}
        onLayout={() =>
          viewport.current?.measureInWindow((_, top, __, height) => {
            geometry.current = { ...geometry.current, top, height };
          })
        }
      >
        <GestureDetector gesture={scrollGesture}>
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 4, paddingBottom: bottomPadding }}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!drag}
            removeClippedSubviews={false}
            onContentSizeChange={(_, height) => {
              geometry.current.contentHeight = height;
            }}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.y;
              updatePosition();
              if (!active.current) onScroll?.(event);
            }}
            scrollEventThrottle={16}
          >
            {!rows.length && (
              <EmptyState
                title="Chưa có danh mục"
                description="Thêm một danh mục để bắt đầu."
              />
            )}
            {rows.map((category, index) => {
              let shift = 0;
              if (drag && category.id !== drag.id) {
                if (index > drag.index && index <= drag.target)
                  shift = -drag.extent;
                if (index < drag.index && index >= drag.target)
                  shift = drag.extent;
              }
              return (
                <DraggableCategory
                  key={category.id}
                  category={category}
                  selected={value === category.id}
                  disabled={
                    busy ||
                    pending ||
                    !!drag ||
                    (!!onSelect && !!category.is_archived)
                  }
                  gestureEnabled={
                    !busy && !pending && (!drag || category.id === drag.id)
                  }
                  dragging={drag?.id === category.id}
                  sorting={!!drag}
                  shift={shift}
                  translation={translation}
                  scrollGesture={scrollGesture}
                  position={index}
                  count={rows.length}
                  onStart={start}
                  onMove={move}
                  onFinish={finish}
                  onPress={() =>
                    onSelect ? onSelect(category.id) : onEdit(category)
                  }
                  onEdit={() => onEdit(category)}
                  onLayout={(event) => {
                    heights.current.set(
                      category.id,
                      event.nativeEvent.layout.height,
                    );
                  }}
                  onAccessibleMove={(direction) => {
                    if (
                      !busy &&
                      !pending &&
                      !drag &&
                      index + direction >= 0 &&
                      index + direction < rows.length
                    )
                      void persist(
                        reorderCategoryIds(
                          rows.map((c) => c.id),
                          index,
                          index + direction,
                        ),
                      );
                  }}
                />
              );
            })}
          </ScrollView>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}
