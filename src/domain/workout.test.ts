import { describe, expect, it } from '@jest/globals';

import {
  formatLocalDate,
  validateExerciseSet,
  validateWorkoutDate,
} from './workout';

describe('тренировка', () => {
  it('форматирует явно переданную локальную дату без преобразования в UTC', () => {
    expect(formatLocalDate(new Date(2026, 0, 9, 23, 30))).toBe('2026-01-09');
  });

  it('отклоняет невозможную календарную дату', () => {
    expect(validateWorkoutDate('2026-02-30')).toEqual({
      ok: false,
      message: 'Такой календарной даты не существует.',
    });
  });

  it('принимает дробный вес с запятой и целые повторения', () => {
    expect(validateExerciseSet({ weight: '82,5', repetitions: '8' })).toEqual({
      ok: true,
      value: { weight: 82.5, repetitions: 8 },
    });
  });

  it('отклоняет дробные и неположительные повторения', () => {
    expect(validateExerciseSet({ weight: '20', repetitions: '2.5' }).ok).toBe(
      false,
    );
    expect(validateExerciseSet({ weight: '20', repetitions: '0' }).ok).toBe(
      false,
    );
  });
});
