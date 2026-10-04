import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ParsedExerciseSet } from '../domain/workout';
import type { ExerciseRepository } from './exerciseRepository';
import { IndexedDbRepository } from './indexedDbRepository';
import {
  migrateDatabase,
  SQLiteExerciseRepository,
} from './sqliteExerciseRepository';
import { SQLiteWorkoutRepository } from './sqliteWorkoutRepository';
import type { WorkoutRepository } from './workoutRepository';

const now = new Date('2026-10-04T12:00:00Z');
const copiedAt = new Date('2026-10-04T13:00:00Z');
const previousSets = [
  { weight: 82.5, repetitions: 8 },
  { weight: 0, repetitions: 12 },
  { weight: 77.25, repetitions: 6 },
];

async function openSQLite() {
  const connection = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => {
      connection.exec(sql);
    },
    getAllAsync: async (sql: string, ...params: SQLInputValue[]) =>
      connection.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: SQLInputValue[]) =>
      connection.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, ...params: SQLInputValue[]) =>
      connection.prepare(sql).run(...params),
    withTransactionAsync: async (action: () => Promise<void>) => {
      connection.exec('BEGIN');
      try {
        await action();
        connection.exec('COMMIT');
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  await migrateDatabase(db);
  return {
    exercises: new SQLiteExerciseRepository(db),
    workouts: new SQLiteWorkoutRepository(db),
    close: () => connection.close(),
    connection,
  };
}

describe.each(['SQLite', 'IndexedDB'])('Предыдущие подходы: %s', (adapter) => {
  let exercises: ExerciseRepository;
  let workouts: WorkoutRepository;
  let close: () => void;
  let exerciseId: string;

  beforeEach(async () => {
    if (adapter === 'SQLite') {
      ({ exercises, workouts, close } = await openSQLite());
    } else {
      const repository = await IndexedDbRepository.open();
      await repository.clearAll();
      exercises = repository;
      workouts = repository;
      close = () => {};
    }
    exerciseId = (
      await exercises.create({ name: 'Жим лёжа', muscleGroup: 'chest' }, now)
    ).id;
  });

  afterEach(() => close());

  async function addWorkout(
    date: string,
    sets: ParsedExerciseSet[] = [],
    id = exerciseId,
  ) {
    const workout = await workouts.create(date, now);
    await workouts.addExercise(workout.id, id, now);
    const relation = (await workouts.get(workout.id))!.exercises[0]!;
    for (const set of sets) await workouts.addSet(relation.id, set, now);
    return { workoutId: workout.id, id: relation.id };
  }

  it('выбирает последнее заполненное упражнение до даты тренировки и точно копирует подходы', async () => {
    await addWorkout('2026-10-10', [{ weight: 100, repetitions: 1 }]);
    const source = await addWorkout('2026-10-02', previousSets);
    await addWorkout('2026-09-01', [{ weight: 10, repetitions: 2 }]);
    const target = await addWorkout('2026-10-04');
    await addWorkout('2026-10-03');
    const sourceBefore = await workouts.get(source.workoutId);

    expect(await workouts.getPreviousSets(target.id)).toEqual(previousSets);
    await workouts.copyPreviousSets(target.id, copiedAt);
    const copied = (await workouts.get(target.workoutId))!;
    expect(copied.updatedAt).toBe(copiedAt.toISOString());
    expect(copied.exercises[0]!.sets).toEqual(
      previousSets.map((set, position) => ({
        ...set,
        position,
        id: expect.any(String),
      })),
    );
    const sourceIds = sourceBefore!.exercises[0]!.sets.map(({ id }) => id);
    expect(
      copied.exercises[0]!.sets.every(({ id }) => !sourceIds.includes(id)),
    ).toBe(true);
    expect(await workouts.getPreviousSets(target.id)).toEqual([]);
    await workouts.copyPreviousSets(target.id, now);
    expect(await workouts.get(target.workoutId)).toEqual(copied);
    await workouts.updateSet(
      copied.exercises[0]!.sets[0]!.id,
      { weight: 90, repetitions: 5 },
      copiedAt,
    );
    expect(await workouts.get(source.workoutId)).toEqual(sourceBefore);
  });

  it('не предлагает копирование без истории, из будущего или от другого упражнения', async () => {
    const target = await addWorkout('2026-10-04');
    expect(await workouts.getPreviousSets(target.id)).toEqual([]);
    await addWorkout('2026-10-05', previousSets);
    await addWorkout('2026-10-02');
    const otherId = (
      await exercises.create({ name: 'Тяга', muscleGroup: 'back' }, now)
    ).id;
    await addWorkout('2026-10-03', previousSets, otherId);
    expect(await workouts.getPreviousSets(target.id)).toEqual([]);
    const before = await workouts.get(target.workoutId);
    await workouts.copyPreviousSets(target.id, copiedAt);
    expect(await workouts.get(target.workoutId)).toEqual(before);
    expect(await workouts.getPreviousSets('missing')).toEqual([]);
    await expect(
      workouts.copyPreviousSets('missing', copiedAt),
    ).resolves.toBeUndefined();
  });

  it('защищает первый введённый подход даже после ранее доступного предложения', async () => {
    await addWorkout('2026-10-02', previousSets);
    const target = await addWorkout('2026-10-04');
    expect(await workouts.getPreviousSets(target.id)).toEqual(previousSets);
    await workouts.addSet(target.id, { weight: 15.5, repetitions: 3 }, now);
    const before = await workouts.get(target.workoutId);
    expect(await workouts.getPreviousSets(target.id)).toEqual([]);
    await workouts.copyPreviousSets(target.id, copiedAt);
    expect(await workouts.get(target.workoutId)).toEqual(before);
    await workouts.deleteSet(before!.exercises[0]!.sets[0]!.id, now);
    expect(await workouts.getPreviousSets(target.id)).toEqual(previousSets);
  });

  it('перечитывает историю при нажатии и сохраняет результат при повторном открытии', async () => {
    const source = await addWorkout('2026-10-02', previousSets);
    const target = await addWorkout('2026-10-04');
    expect(await workouts.getPreviousSets(target.id)).toEqual(previousSets);
    const sourceSet = (await workouts.get(source.workoutId))!.exercises[0]!
      .sets[1]!;
    await workouts.updateSet(
      sourceSet.id,
      { weight: 12.75, repetitions: 9 },
      now,
    );
    await workouts.copyPreviousSets(target.id, copiedAt);
    const copied = await workouts.get(target.workoutId);
    expect(copied!.exercises[0]!.sets[1]).toMatchObject({
      weight: 12.75,
      repetitions: 9,
    });
    if (adapter === 'IndexedDB') workouts = await IndexedDbRepository.open();
    expect(await workouts.get(target.workoutId)).toEqual(copied);
  });
});

it('SQLite откатывает все подходы при ошибке записи', async () => {
  const { exercises, workouts, connection, close } = await openSQLite();
  try {
    const exercise = await exercises.create(
      { name: 'Жим', muscleGroup: 'chest' },
      now,
    );
    const source = await workouts.create('2026-10-02', now);
    const target = await workouts.create('2026-10-04', now);
    await workouts.addExercise(source.id, exercise.id, now);
    await workouts.addExercise(target.id, exercise.id, now);
    const sourceId = (await workouts.get(source.id))!.exercises[0]!.id;
    const targetId = (await workouts.get(target.id))!.exercises[0]!.id;
    for (const set of previousSets) await workouts.addSet(sourceId, set, now);
    const before = await workouts.get(target.id);
    connection.exec(`CREATE TRIGGER fail_copy BEFORE INSERT ON exercise_sets
      WHEN NEW.position = 1 BEGIN SELECT RAISE(ABORT, 'write failed'); END`);
    await expect(workouts.copyPreviousSets(targetId, copiedAt)).rejects.toThrow(
      'write failed',
    );
    expect(await workouts.get(target.id)).toEqual(before);
    expect(await workouts.getPreviousSets(targetId)).toEqual(previousSets);
  } finally {
    close();
  }
});
