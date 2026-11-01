import { Pressable, Text, View } from 'react-native';
import { Icon, s } from './index';
import { colors } from '../../theme';

export function EditorHeading({
  title,
  archiveLabel,
  deleteLabel,
  archived,
  onArchive,
  onDelete,
  disabled = false,
}: {
  title: string;
  archiveLabel: string;
  deleteLabel: string;
  archived: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.between}>
      <Text style={[s.heading, { flex: 1 }]}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {onArchive && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={archiveLabel}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onArchive}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 44,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
            })}
          >
            <Icon
              name={archived ? 'arrow-undo-outline' : 'archive-outline'}
              size={22}
            />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onDelete}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 44,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
            })}
          >
            <Icon name="trash-outline" color={colors.expense} size={22} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
