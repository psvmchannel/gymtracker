import { describe, expect, it, jest } from '@jest/globals';

import { confirmAction } from './confirmAction.web';

const options = {
  title: 'Удалить тренировку?',
  message: 'Тренировка и все её подходы будут удалены.',
  confirmLabel: 'Удалить',
};

describe('confirmAction в web', () => {
  it('не выполняет действие после отмены', () => {
    const onConfirm = jest.fn();
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: jest.fn(() => false),
    });

    confirmAction({ ...options, onConfirm });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('выполняет действие после подтверждения', () => {
    const onConfirm = jest.fn();
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: jest.fn(() => true),
    });

    confirmAction({ ...options, onConfirm });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
