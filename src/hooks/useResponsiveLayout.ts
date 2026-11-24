import { useWindowDimensions } from 'react-native';
import { responsiveLayout } from '../theme/responsive';

export function useResponsiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  return responsiveLayout(width, fontScale);
}
