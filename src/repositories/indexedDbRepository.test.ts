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
    const workout = await repository.create('2026-09-12', now);
    await repository.addExercise(workout.id, exercise.id, now);
    const details = await repository.get(workout.id);
    const workoutExercise = details?.exercises[0];
    expect(workoutExercise).toBeDefined();
    await repository.addSet(
      workoutExercise!.id,
      { weight: 82.5, repetitions: 6 },
      now,
    );

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
          exerciseName: 'Жим лёжа',
          sets: [{ weight: 82.5, repetitions: 6 }],
        },
      ],
    });
  });
});
