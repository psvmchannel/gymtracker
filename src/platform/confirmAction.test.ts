import { describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';

import { confirmAction as confirmNativeAction } from './confirmAction';

const options = {
  title: 'Удалить тренировку?',
  message: 'Тренировка и все её подходы будут удалены.',
  confirmLabel: 'Удалить',
};

describe('confirmAction', () => {
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
