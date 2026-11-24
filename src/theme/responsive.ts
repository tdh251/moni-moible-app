// Use the available width and system text size; never turn off font scaling.
export function responsiveLayout(width: number, fontScale: number) {
  return {
    compact: width < 360,
    largeText: fontScale > 1.3,
    stack: width < 390 || fontScale > 1.3,
  };
}
