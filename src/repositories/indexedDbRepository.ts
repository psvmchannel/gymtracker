import { BACKUP_VERSION, type BackupSnapshot } from '../domain/backup';
import {
  normalizeExerciseName,
  type Exercise,
  type ExerciseDraft,
} from '../domain/exercise';
import type { ProgressPoint } from '../domain/progress';
import type {
  ParsedExerciseSet,
  Workout,
  WorkoutDetails,
} from '../domain/workout';
import type { DataTransferRepository } from './dataTransferRepository';
import { StorageNotEmptyError } from './dataTransferRepository';
import {
  DuplicateExerciseNameError,
  type ExerciseRepository,
} from './exerciseRepository';
import {
  WorkoutDateConflictError,
  WorkoutExerciseConflictError,
  type WorkoutRepository,
} from './workoutRepository';

const DATABASE_NAME = 'gym-tracker';
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'current';

function emptySnapshot(): BackupSnapshot {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date(0).toISOString(),
    exercises: [],
    workouts: [],
    workoutExercises: [],
    exerciseSets: [],
  };
}

function newId() {
  return crypto.randomUUID();
}

export class IndexedDbRepository
  implements ExerciseRepository, WorkoutRepository, DataTransferRepository
{
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<IndexedDbRepository> {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME);
    const db = await requestResult(request);
    return new IndexedDbRepository(db);
  }

  async listActive(): Promise<Exercise[]> {
    return (await this.read()).exercises
      .filter((item) => !item.isArchived)
      .sort(compareExercises);
  }

  async listAll(): Promise<Exercise[]> {
    return (await this.read()).exercises
      .slice()
      .sort(
        (a, b) =>
          Number(a.isArchived) - Number(b.isArchived) || compareExercises(a, b),
      );
  }

  async update(id: string, draft: ExerciseDraft, now: Date): Promise<Exercise> {
    return this.updateSnapshot((data) => {
      const exercise = data.exercises.find(
        (item) => item.id === id && !item.isArchived,
      );
      if (!exercise) throw new Error('Упражнение не найдено.');
      assertExerciseNameAvailable(data, draft.name, id);
      Object.assign(exercise, draft, { updatedAt: now.toISOString() });
      return exercise;
    });
  }

  async list(): Promise<Workout[]> {
    return (await this.read()).workouts
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async get(id: string): Promise<WorkoutDetails | null> {
    return detailsFromSnapshot(await this.read(), id);
  }

  async create(date: string, now: Date): Promise<Workout>;
  async create(draft: ExerciseDraft, now: Date): Promise<Exercise>;
  async create(
    value: string | ExerciseDraft,
    now: Date,
  ): Promise<Workout | Exercise> {
    if (typeof value !== 'string') {
      return this.updateSnapshot((data) => {
        assertExerciseNameAvailable(data, value.name);
        const timestamp = now.toISOString();
        const exercise: Exercise = {
          id: newId(),
          ...value,
          isArchived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        data.exercises.push(exercise);
        return exercise;
      });
    }
    return this.updateSnapshot((data) => {
      if (data.workouts.some((item) => item.date === value))
        throw new WorkoutDateConflictError();
      const timestamp = now.toISOString();
      const workout: Workout = {
        id: newId(),
        date: value,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.workouts.push(workout);
      return workout;
    });
  }

  async clone(id: string, date: string, now: Date): Promise<WorkoutDetails> {
    return this.updateSnapshot((data) => {
      const source = detailsFromSnapshot(data, id);
      if (!source) throw new Error('Тренировка не найдена.');
      if (data.workouts.some((item) => item.date === date))
        throw new WorkoutDateConflictError();
      const timestamp = now.toISOString();
      const workout: Workout = {
        id: newId(),
        date,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.workouts.push(workout);
      for (const exercise of source.exercises) {
        const workoutExerciseId = newId();
        data.workoutExercises.push({
          id: workoutExerciseId,
          workoutId: workout.id,
          exerciseId: exercise.exerciseId,
          position: exercise.position,
        });
        for (const set of exercise.sets)
          data.exerciseSets.push({ ...set, id: newId(), workoutExerciseId });
      }
      return detailsFromSnapshot(data, workout.id) as WorkoutDetails;
    });
  }

  async delete(id: string): Promise<void>;
  async delete(id: string, now: Date): Promise<'deleted' | 'archived'>;
  async delete(id: string, now?: Date): Promise<void | 'deleted' | 'archived'> {
    if (now) {
      return this.updateSnapshot((data) => {
        const exercise = data.exercises.find((item) => item.id === id);
        if (!exercise) return 'deleted';
        if (data.workoutExercises.some((item) => item.exerciseId === id)) {
          exercise.isArchived = true;
          exercise.updatedAt = now.toISOString();
          return 'archived';
        }
        data.exercises = data.exercises.filter((item) => item.id !== id);
        return 'deleted';
      });
    }
    await this.updateSnapshot((data) => {
      const relationIds = new Set(
        data.workoutExercises
          .filter((item) => item.workoutId === id)
          .map((item) => item.id),
      );
      data.exerciseSets = data.exerciseSets.filter(
        (item) => !relationIds.has(item.workoutExerciseId),
      );
      data.workoutExercises = data.workoutExercises.filter(
        (item) => item.workoutId !== id,
      );
      data.workouts = data.workouts.filter((item) => item.id !== id);
    });
  }

  async addExercise(
    workoutId: string,
    exerciseId: string,
    now: Date,
  ): Promise<void> {
    await this.updateSnapshot((data) => {
      if (
        data.workoutExercises.some(
          (item) =>
            item.workoutId === workoutId && item.exerciseId === exerciseId,
        )
      )
        throw new WorkoutExerciseConflictError();
      const position = data.workoutExercises.filter(
        (item) => item.workoutId === workoutId,
      ).length;
      data.workoutExercises.push({
        id: newId(),
        workoutId,
        exerciseId,
        position,
      });
      touchWorkout(data, workoutId, now);
    });
  }

  async addSet(
    workoutExerciseId: string,
    draft: ParsedExerciseSet,
    now: Date,
  ): Promise<void> {
    await this.updateSnapshot((data) => {
      const position = data.exerciseSets.filter(
        (item) => item.workoutExerciseId === workoutExerciseId,
      ).length;
      data.exerciseSets.push({
        id: newId(),
        workoutExerciseId,
        ...draft,
        position,
      });
      touchByWorkoutExercise(data, workoutExerciseId, now);
    });
  }

  async updateSet(
    id: string,
    draft: ParsedExerciseSet,
    now: Date,
  ): Promise<void> {
    await this.updateSnapshot((data) => {
      const set = data.exerciseSets.find((item) => item.id === id);
      if (!set) return;
      Object.assign(set, draft);
      touchByWorkoutExercise(data, set.workoutExerciseId, now);
    });
  }

  async deleteSet(id: string, now: Date): Promise<void> {
    await this.updateSnapshot((data) => {
      const set = data.exerciseSets.find((item) => item.id === id);
      if (!set) return;
      data.exerciseSets = data.exerciseSets.filter((item) => item.id !== id);
      data.exerciseSets
        .filter((item) => item.workoutExerciseId === set.workoutExerciseId)
        .sort((a, b) => a.position - b.position)
        .forEach((item, position) => {
          item.position = position;
        });
      touchByWorkoutExercise(data, set.workoutExerciseId, now);
    });
  }

  async getProgress(exerciseId: string): Promise<ProgressPoint[]> {
    const data = await this.read();
    return data.workouts
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((workout) => {
        const relationIds = new Set(
          data.workoutExercises
            .filter(
              (item) =>
                item.workoutId === workout.id && item.exerciseId === exerciseId,
            )
            .map((item) => item.id),
        );
        const weights = data.exerciseSets
          .filter((item) => relationIds.has(item.workoutExerciseId))
          .map((item) => item.weight);
        return weights.length
          ? [{ date: workout.date, maxWeight: Math.max(...weights) }]
          : [];
      });
  }

  async exportSnapshot(now: Date): Promise<BackupSnapshot> {
    return { ...(await this.read()), exportedAt: now.toISOString() };
  }
  async importSnapshot(snapshot: BackupSnapshot): Promise<void> {
    await this.updateSnapshot((data) => {
      if (
        data.exercises.length ||
        data.workouts.length ||
        data.workoutExercises.length ||
        data.exerciseSets.length
      )
        throw new StorageNotEmptyError();
      Object.assign(data, structuredClone(snapshot));
    });
  }
  async clearAll(): Promise<void> {
    await this.write(emptySnapshot());
  }

  private async read(): Promise<BackupSnapshot> {
    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const value = await requestResult(
      transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY),
    );
    await transactionDone(transaction);
    return (value as BackupSnapshot | undefined) ?? emptySnapshot();
  }

  private async write(data: BackupSnapshot) {
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(data, SNAPSHOT_KEY);
    await transactionDone(transaction);
  }

  private async updateSnapshot<T>(
    change: (data: BackupSnapshot) => T,
  ): Promise<T> {
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const data =
      ((await requestResult(store.get(SNAPSHOT_KEY))) as
        BackupSnapshot | undefined) ?? emptySnapshot();
    const result = change(data);
    store.put(data, SNAPSHOT_KEY);
    await transactionDone(transaction);
    return result;
  }
}

function detailsFromSnapshot(
  data: BackupSnapshot,
  id: string,
): WorkoutDetails | null {
  const workout = data.workouts.find((item) => item.id === id);
  if (!workout) return null;
  const exercises = data.workoutExercises
    .filter((item) => item.workoutId === id)
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      exerciseId: item.exerciseId,
      exerciseName:
        data.exercises.find((exercise) => exercise.id === item.exerciseId)
          ?.name ?? 'Удалённое упражнение',
      position: item.position,
      sets: data.exerciseSets
        .filter((set) => set.workoutExerciseId === item.id)
        .sort((a, b) => a.position - b.position)
        .map(({ workoutExerciseId: _, ...set }) => set),
    }));
  return { ...workout, exercises };
}
function compareExercises(a: Exercise, b: Exercise) {
  return (
    a.name.localeCompare(b.name, 'ru') || a.createdAt.localeCompare(b.createdAt)
  );
}
function assertExerciseNameAvailable(
  data: BackupSnapshot,
  name: string,
  exceptId?: string,
) {
  const normalized = normalizeExerciseName(name);
  if (
    data.exercises.some(
      (item) =>
        !item.isArchived &&
        item.id !== exceptId &&
        normalizeExerciseName(item.name) === normalized,
    )
  )
    throw new DuplicateExerciseNameError();
}
function touchWorkout(data: BackupSnapshot, id: string, now: Date) {
  const workout = data.workouts.find((item) => item.id === id);
  if (workout) workout.updatedAt = now.toISOString();
}
function touchByWorkoutExercise(data: BackupSnapshot, id: string, now: Date) {
  const relation = data.workoutExercises.find((item) => item.id === id);
  if (relation) touchWorkout(data, relation.workoutId, now);
}
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
