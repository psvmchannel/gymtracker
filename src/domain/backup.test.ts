import { describe, expect, it } from '@jest/globals';

import { BACKUP_VERSION, parseBackupJson, validateBackup } from './backup';

const validBackup = {
  version: BACKUP_VERSION,
  exportedAt: '2026-09-12T12:00:00.000Z',
  exercises: [
    {
      id: 'exercise-1',
      name: 'Жим лёжа',
      muscleGroup: 'chest',
      isArchived: false,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  workouts: [
    {
      id: 'workout-1',
      date: '2026-09-10',
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-10T10:00:00.000Z',
    },
  ],
  workoutExercises: [
    {
      id: 'workout-exercise-1',
      workoutId: 'workout-1',
      exerciseId: 'exercise-1',
      position: 0,
    },
  ],
  exerciseSets: [
    {
      id: 'set-1',
      workoutExerciseId: 'workout-exercise-1',
      weight: 82.5,
      repetitions: 6,
      position: 0,
    },
  ],
} as const;

describe('backup validation', () => {
  it('принимает полный согласованный снимок', () => {
    expect(validateBackup(validBackup)).toEqual({
      ok: true,
      value: validBackup,
    });
  });

  it('отклоняет неподдерживаемую версию', () => {
    expect(validateBackup({ ...validBackup, version: 2 })).toEqual({
      ok: false,
      message: 'Версия резервной копии не поддерживается.',
    });
  });

  it('отклоняет повреждённую ссылку', () => {
    expect(
      validateBackup({
        ...validBackup,
        exerciseSets: [
          { ...validBackup.exerciseSets[0], workoutExerciseId: 'missing' },
        ],
      }),
    ).toEqual({
      ok: false,
      message: 'Резервная копия содержит повреждённые ссылки.',
    });
  });

  it('отклоняет пропуск в порядке подходов', () => {
    expect(
      validateBackup({
        ...validBackup,
        exerciseSets: [{ ...validBackup.exerciseSets[0], position: 1 }],
      }),
    ).toEqual({
      ok: false,
      message: 'Нарушен порядок упражнений или подходов.',
    });
  });

  it('понятно сообщает о некорректном JSON', () => {
    expect(parseBackupJson('{')).toEqual({
      ok: false,
      message: 'Файл не содержит корректный JSON.',
    });
  });
});
