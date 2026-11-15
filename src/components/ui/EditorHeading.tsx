import { Text, View } from 'react-native';
import { s } from './index';
import { ActionMenu } from './ActionMenu';

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
      {(onArchive || onDelete) && (
        <ActionMenu
          label="Thao tác"
          disabled={disabled}
          actions={[
            ...(onArchive
              ? [
                  {
                    label: archiveLabel,
                    icon: archived
                      ? ('arrow-undo-outline' as const)
                      : ('archive-outline' as const),
                    onPress: onArchive,
                  },
                ]
              : []),
            ...(onDelete
              ? [
                  {
                    label: deleteLabel,
                    icon: 'trash-outline' as const,
                    danger: true,
                    onPress: onDelete,
                  },
                ]
              : []),
          ]}
        />
      )}
    </View>
  );
}
