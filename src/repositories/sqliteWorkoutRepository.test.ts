import { describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { SQLiteWorkoutRepository } from './sqliteWorkoutRepository';
import { WorkoutDateConflictError } from './workoutRepository';

describe('SQLiteWorkoutRepository', () => {
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
});
