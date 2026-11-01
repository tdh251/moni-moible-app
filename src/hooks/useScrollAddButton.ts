import { useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useScrollAddButton() {
  const [addButtonVisible, setAddButtonVisible] = useState(true);
  const scrollTracking = useRef({ offset: 0, direction: 0, distance: 0 });

  const handleScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    // Ignore overscroll bounce so it cannot reverse the detected direction.
    const offset = Math.max(
      0,
      Math.min(
        contentOffset.y,
        Math.max(0, contentSize.height - layoutMeasurement.height),
      ),
    );
    const tracking = scrollTracking.current;
    const delta = offset - tracking.offset;
    tracking.offset = offset;
    if (offset === 0) {
      tracking.direction = 0;
      tracking.distance = 0;
      setAddButtonVisible(true);
      return;
    }
    if (delta === 0) return;
    const direction = Math.sign(delta);
    tracking.distance =
      direction === tracking.direction
        ? tracking.distance + Math.abs(delta)
        : Math.abs(delta);
    tracking.direction = direction;
    if (tracking.distance >= 10) {
      setAddButtonVisible(direction < 0);
      tracking.distance = 0;
    }
  };
  const resetScroll = () => {
    scrollTracking.current = { offset: 0, direction: 0, distance: 0 };
    setAddButtonVisible(true);
  };
  return { addButtonVisible, handleScroll, resetScroll };
}
