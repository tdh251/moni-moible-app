import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState, Icon, s } from '../../components/ui';
import type { Category } from '../../types/finance';
import { colors } from '../../theme';

const ROW_HEIGHT = 80;
type Drag = { index: number; target: number; dy: number; startOffset: number };

function DragHandle({
  disabled,
  start,
  move,
  finish,
}: {
  disabled: boolean;
  start: () => void;
  move: (dy: number) => void;
  finish: (cancel?: boolean) => void;
}) {
  const handlers = useRef({ disabled, start, move, finish });
  useEffect(() => {
    handlers.current = { disabled, start, move, finish };
  }, [disabled, start, move, finish]);
  const responder = useMemo(
    () =>
      // PanResponder only registers these callbacks; refs are read during gestures.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => !handlers.current.disabled,
        onPanResponderGrant: () => handlers.current.start(),
        onPanResponderMove: (_, gesture) => handlers.current.move(gesture.dy),
        onPanResponderRelease: () => handlers.current.finish(),
        onPanResponderTerminate: () => handlers.current.finish(true),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  return (
    <View {...responder.panHandlers} style={styles.action} accessible={false}>
      <Icon
        name="reorder-three-outline"
        color={disabled ? colors.border : colors.muted}
      />
    </View>
  );
}

export function CategoryList({
  categories,
  busy,
  value,
  onSelect,
  onEdit,
  onReorder,
}: {
  categories: Category[];
  busy: boolean;
  value?: string;
  onSelect?: (id: string) => void;
  onEdit: (category: Category) => void;
  onReorder: (ids: string[]) => Promise<boolean>;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const gestureDy = useRef(0);
  const active = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<string[] | null>(null);
  const disabled = busy || pending !== null;
  const update = useCallback(
    (dy: number) => {
      const current = active.current;
      if (!current) return;
      gestureDy.current = dy;
      const travel = Math.max(
        -current.index * ROW_HEIGHT,
        Math.min(
          (categories.length - current.index - 1) * ROW_HEIGHT,
          dy + offset.current - current.startOffset,
        ),
      );
      const next = {
        ...current,
        dy: travel,
        target: Math.round(current.index + travel / ROW_HEIGHT),
      };
      active.current = next;
      setDrag(next);
    },
    [categories.length],
  );
  const finish = useCallback(
    (cancel = false) => {
      const current = active.current;
      active.current = null;
      setDrag(null);
      if (!current || cancel || current.index === current.target) return;
      const ids = categories.map((c) => c.id);
      const [id] = ids.splice(current.index, 1);
      ids.splice(current.target, 0, id);
      setPending(ids);
      void onReorder(ids).finally(() => setPending(null));
    },
    [categories, onReorder],
  );
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    // Continue scrolling near the edges, including when the finger pauses.
    const timer = setInterval(() => {
      const current = active.current;
      if (!current) return;
      const center =
        current.index * ROW_HEIGHT +
        current.dy +
        ROW_HEIGHT / 2 -
        offset.current;
      const direction =
        center < 56 ? -1 : center > viewport.current - 56 ? 1 : 0;
      const next = Math.max(
        0,
        Math.min(
          categories.length * ROW_HEIGHT - viewport.current,
          offset.current + direction * 10,
        ),
      );
      if (next !== offset.current) {
        offset.current = next;
        scroll.current?.scrollTo({ y: next, animated: false });
        update(gestureDy.current);
      }
    }, 32);
    return () => clearInterval(timer);
  }, [dragging, categories.length, update]);
  const displayed = pending
    ? pending.map((id) => categories.find((c) => c.id === id)!).filter(Boolean)
    : categories;
  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1 }}
      scrollEnabled={!dragging}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.height;
      }}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      {!displayed.length && (
        <EmptyState
          title="Chưa có danh mục"
          description="Thêm một danh mục để bắt đầu."
        />
      )}
      <View style={{ height: displayed.length * ROW_HEIGHT }}>
        {displayed.map((c, index) => {
          const isDragging = drag?.index === index;
          let shift = 0;
          if (drag) {
            if (isDragging) shift = drag.dy;
            else if (index > drag.index && index <= drag.target)
              shift = -ROW_HEIGHT;
            else if (index < drag.index && index >= drag.target)
              shift = ROW_HEIGHT;
          }
          return (
            <View
              key={c.id}
              style={[
                styles.row,
                {
                  top: index * ROW_HEIGHT,
                  transform: [{ translateY: shift }],
                  zIndex: isDragging ? 1 : 0,
                  borderColor: isDragging ? colors.primary : colors.border,
                  backgroundColor: value === c.id ? colors.light : colors.card,
                },
              ]}
            >
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`Thứ tự ${c.name}`}
                accessibilityHint="Vuốt lên hoặc xuống để thay đổi thứ tự"
                accessibilityValue={{
                  min: 1,
                  max: displayed.length,
                  now: index + 1,
                }}
                accessibilityActions={[
                  { name: 'increment', label: 'Di chuyển xuống' },
                  { name: 'decrement', label: 'Di chuyển lên' },
                ]}
                onAccessibilityAction={(event) => {
                  if (disabled || dragging) return;
                  const target =
                    index +
                    (event.nativeEvent.actionName === 'increment' ? 1 : -1);
                  if (target < 0 || target >= categories.length) return;
                  active.current = {
                    index,
                    target,
                    dy: 0,
                    startOffset: offset.current,
                  };
                  finish();
                }}
              >
                <DragHandle
                  disabled={disabled}
                  start={() => {
                    gestureDy.current = 0;
                    const next = {
                      index,
                      target: index,
                      dy: 0,
                      startOffset: offset.current,
                    };
                    active.current = next;
                    setDrag(next);
                  }}
                  move={update}
                  finish={finish}
                />
              </View>
              <Pressable
                style={[s.row, { flex: 1, minHeight: 60 }]}
                disabled={
                  disabled || dragging || (!!onSelect && !!c.is_archived)
                }
                accessibilityRole="button"
                accessibilityLabel={`${onSelect ? 'Chọn' : 'Sửa'} ${c.name}`}
                accessibilityState={{
                  selected: value === c.id,
                  disabled: disabled || (!!onSelect && !!c.is_archived),
                }}
                onPress={() => (onSelect ? onSelect(c.id) : onEdit(c))}
              >
                <Icon name={c.icon} color={c.color} />
                <View style={{ flex: 1 }}>
                  <Text style={s.text} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {!!c.is_archived && <Text style={s.muted}>Đã lưu trữ</Text>}
                </View>
                {value === c.id && <Icon name="checkmark-outline" />}
              </Pressable>
              <Pressable
                style={styles.action}
                disabled={disabled || dragging}
                accessibilityRole="button"
                accessibilityLabel={`Sửa ${c.name}`}
                onPress={() => onEdit(c)}
              >
                <Icon name="create-outline" size={20} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT - 8,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  action: {
    width: 48,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
