import { describe, expect, it } from '@jest/globals';

import { APP_SECTIONS, DEFAULT_SECTION } from './sections';

describe('основные разделы приложения', () => {
  it('содержит три раздела MVP в заданном порядке', () => {
    expect(APP_SECTIONS.map(({ label }) => label)).toEqual([
      'Тренировки',
      'Упражнения',
      'Статистика',
    ]);
  });

  it('открывает тренировки по умолчанию', () => {
    expect(DEFAULT_SECTION).toBe('workouts');
  });
});
