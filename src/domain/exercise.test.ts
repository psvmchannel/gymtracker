import { describe, expect, it } from '@jest/globals';

import {
  MUSCLE_GROUPS,
  normalizeExerciseName,
  validateExerciseDraft,
} from './exercise';

describe('упражнение', () => {
  it('поддерживает продуктовый набор мышечных групп', () => {
    expect(MUSCLE_GROUPS).toEqual([
      'chest',
      'back',
      'legs',
      'biceps',
      'triceps',
      'shoulders',
      'abs',
    ]);
  });

  it('очищает название от пробелов по краям', () => {
    expect(
      validateExerciseDraft({ name: '  Жим лёжа  ', muscleGroup: 'chest' }),
    ).toEqual({
      ok: true,
      value: { name: 'Жим лёжа', muscleGroup: 'chest' },
    });
  });

  it('отклоняет пустое название', () => {
    expect(validateExerciseDraft({ name: '   ', muscleGroup: 'back' })).toEqual(
      {
        ok: false,
        message: 'Введите название упражнения.',
      },
    );
  });

  it('нормализует русский регистр для проверки уникальности', () => {
    expect(normalizeExerciseName('  ЖИМ ЛёЖА ')).toBe('жим лёжа');
  });
});
