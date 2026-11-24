import assert from 'node:assert/strict';
import test from 'node:test';
import { colors } from '../src/theme/index.ts';
import { responsiveLayout } from '../src/theme/responsive.ts';

function luminance(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(foreground, background) {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('body, input, button and semantic badge text meet WCAG AA contrast', () => {
  const pairs = [
    ['text', 'card'],
    ['text', 'background'],
    ['muted', 'card'],
    ['muted', 'background'],
    ['muted', 'surfaceSecondary'],
    ['placeholder', 'card'],
    ['primary', 'light'],
    ['primary', 'brandMuted'],
    ['onPrimary', 'primary'],
    ['onPrimary', 'danger'],
    ['income', 'incomeLight'],
    ['expense', 'expenseLight'],
    ['danger', 'dangerLight'],
    ['warning', 'warningLight'],
    ['transfer', 'transferLight'],
  ];
  for (const [foreground, background] of pairs) {
    const ratio = contrast(colors[foreground], colors[background]);
    assert.ok(
      ratio >= 4.5,
      `${foreground}/${background}: ${ratio.toFixed(2)} < 4.5`,
    );
  }
});

test('small hero labels retain AA contrast throughout the gradient', () => {
  for (const background of ['heroStart', 'heroMiddle', 'heroEnd']) {
    for (const foreground of ['onDark', 'onDarkMuted']) {
      assert.ok(
        contrast(colors[foreground], colors[background]) >= 4.5,
        `${foreground}/${background}`,
      );
    }
  }
});

test('compact and enlarged system text layouts use a full width money column', () => {
  for (const width of [320, 360, 375, 390, 412, 430]) {
    assert.equal(responsiveLayout(width, 1.5).stack, true, `${width} at 150%`);
    assert.equal(responsiveLayout(width, 2).stack, true, `${width} at 200%`);
    assert.equal(
      responsiveLayout(width, 1).stack,
      width < 390,
      `${width} at 100%`,
    );
  }
});
