import 'fake-indexeddb/auto';

import { describe, expect, it } from '@jest/globals';

import { IndexedDbRepository } from './indexedDbRepository';
import { StorageNotEmptyError } from './dataTransferRepository';

describe('IndexedDbRepository', () => {
  it('выполняет основной сценарий и переносит полный снимок', async () => {
    const repository = await IndexedDbRepository.open();
    const now = new Date('2026-09-12T12:00:00.000Z');
    const exercise = await repository.create(
      { name: 'Жим лёжа', muscleGroup: 'chest' },
      now,
    );
    const secondExercise = await repository.create(
      { name: 'Тяга блока', muscleGroup: 'back' },
      now,
    );
    const workout = await repository.create('2026-09-12', now);
    await repository.addExercise(workout.id, exercise.id, now);
    await repository.addExercise(workout.id, secondExercise.id, now);
    const details = await repository.get(workout.id);
    const workoutExercise = details?.exercises[0];
    expect(workoutExercise).toBeDefined();
    await repository.addSet(
      workoutExercise!.id,
      { weight: 82.5, repetitions: 6 },
      now,
    );
    await repository.reorderExercises(
      workout.id,
      details!.exercises.map(({ id }) => id).reverse(),
      now,
    );

    expect(
      (await repository.get(workout.id))?.exercises.map(
        ({ exerciseName, position }) => ({ exerciseName, position }),
      ),
    ).toEqual([
      { exerciseName: 'Тяга блока', position: 0 },
      { exerciseName: 'Жим лёжа', position: 1 },
    ]);

    expect(await repository.getProgress(exercise.id)).toEqual([
      { date: '2026-09-12', maxWeight: 82.5 },
    ]);
    const snapshot = await repository.exportSnapshot(now);
    await expect(repository.importSnapshot(snapshot)).rejects.toBeInstanceOf(
      StorageNotEmptyError,
    );

    await repository.clearAll();
    await repository.importSnapshot(snapshot);
    expect(await repository.get(workout.id)).toMatchObject({
      date: '2026-09-12',
      exercises: [
        {
          exerciseName: 'Тяга блока',
          sets: [],
        },
        {
          exerciseName: 'Жим лёжа',
          sets: [{ weight: 82.5, repetitions: 6 }],
        },
      ],
    });
  });
});
