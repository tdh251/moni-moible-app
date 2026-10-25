import { Redirect } from 'expo-router';
import { useFinance } from '../hooks/finance';
export default function Index() {
  const { data } = useFinance();
  return (
    <Redirect href={data.onboarded ? '/(tabs)/dashboard' : '/onboarding'} />
  );
}
