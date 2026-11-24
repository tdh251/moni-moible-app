import { Redirect } from 'expo-router';

export default function Purchases() {
  return (
    <Redirect
      href={{
        pathname: '/(tabs)/loans',
        params: { side: 'receivable', kind: 'purchase' },
      }}
    />
  );
}
