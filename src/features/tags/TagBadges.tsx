import { Text, View } from 'react-native';
import type { Tag, Transaction } from '../../types/finance';
import { transactionTagIds } from '../../services/tags';

export function TagBadges({
  transaction,
  tags,
}: {
  transaction: Transaction;
  tags: Tag[];
}) {
  const ids = transactionTagIds(transaction);
  if (!ids.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {ids.map((id) => {
        const tag = tags.find((t) => t.id === id);
        return tag ? (
          <Text
            key={id}
            style={{
              color: tag.color,
              backgroundColor: `${tag.color}18`,
              borderRadius: 8,
              paddingVertical: 4,
              paddingHorizontal: 8,
              fontSize: 12,
            }}
          >
            #{tag.name}
          </Text>
        ) : null;
      })}
    </View>
  );
}
