import { describe, expect, it } from '@jest/globals';

import { withSafeAreaViewport } from './registerServiceWorker.web';

describe('withSafeAreaViewport', () => {
  it('включает системные safe area в viewport', () => {
    expect(withSafeAreaViewport('width=device-width, initial-scale=1')).toBe(
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
  });

  it('не добавляет параметр повторно', () => {
    expect(withSafeAreaViewport('width=device-width, viewport-fit=cover')).toBe(
      'width=device-width, viewport-fit=cover',
    );
  });
});
