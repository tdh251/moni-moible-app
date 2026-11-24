import { Text, View } from 'react-native';
import type { Tag, Transaction } from '../../types/finance';
import { transactionTagIds } from '../../services/tags';
import { colors, radius, spacing, typography } from '../../theme';

export function TagBadges({
  transaction,
  tags,
}: {
  transaction: Pick<Transaction, 'tag_ids_json'>;
  tags: Tag[] | ReadonlyMap<string, Tag>;
}) {
  const ids = transactionTagIds(transaction);
  if (!ids.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {ids.map((id) => {
        const tag = Array.isArray(tags)
          ? tags.find((t) => t.id === id)
          : tags.get(id);
        return tag ? (
          <Text
            key={id}
            style={{
              color: colors.text,
              backgroundColor: `${tag.color}18`,
              borderRadius: radius.small,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              maxWidth: '100%',
              ...typography.caption,
            }}
          >
            #{tag.name}
          </Text>
        ) : null;
      })}
    </View>
  );
}
