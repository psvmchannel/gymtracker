import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';

import { confirmAction as confirmNativeAction } from './confirmAction';

const options = {
  title: 'Удалить тренировку?',
  message: 'Тренировка и все её подходы будут удалены.',
  confirmLabel: 'Удалить',
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('confirmAction', () => {
  it('не выполняет действие после нативной отмены', () => {
    const onConfirm = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    confirmNativeAction({ ...options, onConfirm });
    const buttons = alert.mock.calls[0]?.[2];
    buttons?.[0]?.onPress?.();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('выполняет действие после нативного подтверждения', () => {
    const onConfirm = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    confirmNativeAction({ ...options, onConfirm });
    expect(onConfirm).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]?.[2];
    buttons?.[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
