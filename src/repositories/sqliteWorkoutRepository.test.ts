import { describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { SQLiteWorkoutRepository } from './sqliteWorkoutRepository';
import { WorkoutDateConflictError } from './workoutRepository';

describe('SQLiteWorkoutRepository', () => {
  it('возвращает максимальный вес упражнения по датам', async () => {
    const db = {
      getAllAsync: jest.fn(async () => [
        { date: '2026-09-01', max_weight: 80 },
        { date: '2026-09-08', max_weight: 82.5 },
      ]),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteWorkoutRepository(db).getProgress('exercise-1'),
    ).resolves.toEqual([
      { date: '2026-09-01', maxWeight: 80 },
      { date: '2026-09-08', maxWeight: 82.5 },
    ]);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('MAX(es.weight)'),
      'exercise-1',
    );
  });

  it('собирает упражнения и подходы в сохранённом порядке', async () => {
    const queryResults = [
      [
        {
          id: 'workout-exercise-1',
          exercise_id: 'exercise-1',
          exercise_name: 'Жим лёжа',
          position: 0,
        },
      ],
      [
        {
          id: 'set-1',
          workout_exercise_id: 'workout-exercise-1',
          weight: 80,
          repetitions: 8,
          position: 0,
        },
        {
          id: 'set-2',
          workout_exercise_id: 'workout-exercise-1',
          weight: 82.5,
          repetitions: 6,
          position: 1,
        },
      ],
    ];
    const db = {
      getFirstAsync: jest.fn(async () => ({
        id: 'workout-1',
        date: '2026-09-06',
        created_at: 'created',
        updated_at: 'updated',
      })),
      getAllAsync: jest.fn(async () => queryResults.shift() ?? []),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteWorkoutRepository(db).get('workout-1'),
    ).resolves.toEqual({
      id: 'workout-1',
      date: '2026-09-06',
      createdAt: 'created',
      updatedAt: 'updated',
      exercises: [
        {
          id: 'workout-exercise-1',
          exerciseId: 'exercise-1',
          exerciseName: 'Жим лёжа',
          position: 0,
          sets: [
            { id: 'set-1', weight: 80, repetitions: 8, position: 0 },
            { id: 'set-2', weight: 82.5, repetitions: 6, position: 1 },
          ],
        },
      ],
    });
  });

  it('не перезаписывает тренировку на существующую дату', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ id: 'existing' })),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteWorkoutRepository(db).create(
        '2026-09-06',
        new Date('2026-09-06T10:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(WorkoutDateConflictError);
  });

  it('атомарно сохраняет полный новый порядок упражнений', async () => {
    const db = {
      getAllAsync: jest.fn(async () => [{ id: 'first' }, { id: 'second' }]),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (action: () => Promise<void>) =>
        action(),
      ),
    } as unknown as SQLiteDatabase;
    const now = new Date('2026-09-16T12:00:00.000Z');

    await new SQLiteWorkoutRepository(db).reorderExercises(
      'workout-1',
      ['second', 'first'],
      now,
    );

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET position = position + ?'),
      2,
      'workout-1',
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET position = ?'),
      0,
      'second',
      'workout-1',
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workouts SET updated_at'),
      now.toISOString(),
      'workout-1',
    );
  });

  it('не сохраняет неполный порядок упражнений', async () => {
    const db = {
      getAllAsync: jest.fn(async () => [{ id: 'first' }, { id: 'second' }]),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (action: () => Promise<void>) =>
        action(),
      ),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteWorkoutRepository(db).reorderExercises(
        'workout-1',
        ['first'],
        new Date(),
      ),
    ).rejects.toThrow('Некорректный порядок упражнений.');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('клонирует тренировку с упражнениями и подходами в одной транзакции', async () => {
    const firstResults = [
      {
        id: 'source',
        date: '2026-09-06',
        created_at: 'created',
        updated_at: 'updated',
      },
      null,
      { id: 'clone' },
      { id: 'clone-exercise' },
      {
        id: 'clone',
        date: '2026-09-08',
        created_at: '2026-09-07T10:00:00.000Z',
        updated_at: '2026-09-07T10:00:00.000Z',
      },
    ];
    const allResults = [
      [
        {
          id: 'source-exercise',
          exercise_id: 'exercise-1',
          exercise_name: 'Жим лёжа',
          position: 0,
        },
      ],
      [
        {
          id: 'source-set',
          workout_exercise_id: 'source-exercise',
          weight: 82.5,
          repetitions: 6,
          position: 0,
        },
      ],
      [
        {
          id: 'clone-exercise',
          exercise_id: 'exercise-1',
          exercise_name: 'Жим лёжа',
          position: 0,
        },
      ],
      [
        {
          id: 'clone-set',
          workout_exercise_id: 'clone-exercise',
          weight: 82.5,
          repetitions: 6,
          position: 0,
        },
      ],
    ];
    const db = {
      getFirstAsync: jest.fn(async () => firstResults.shift() ?? null),
      getAllAsync: jest.fn(async () => allResults.shift() ?? []),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (action: () => Promise<void>) =>
        action(),
      ),
    } as unknown as SQLiteDatabase;

    const clone = await new SQLiteWorkoutRepository(db).clone(
      'source',
      '2026-09-08',
      new Date('2026-09-07T10:00:00.000Z'),
    );

    expect(clone.id).toBe('clone');
    expect(clone.exercises[0]?.sets[0]).toMatchObject({
      weight: 82.5,
      repetitions: 6,
    });
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO exercise_sets'),
      'clone-exercise',
      82.5,
      6,
      0,
    );
  });
});
