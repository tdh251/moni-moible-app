import { Text, View } from 'react-native';
import { IconButton, s } from './index';

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
          <IconButton
            label={archiveLabel}
            icon={archived ? 'arrow-undo-outline' : 'archive-outline'}
            disabled={disabled}
            onPress={onArchive}
          />
        )}
        {onDelete && (
          <IconButton
            label={deleteLabel}
            icon="trash-outline"
            danger
            disabled={disabled}
            onPress={onDelete}
          />
        )}
      </View>
    </View>
  );
}
