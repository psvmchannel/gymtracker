import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ExerciseSet,
  ParsedExerciseSet,
  Workout,
  WorkoutDetails,
  WorkoutExercise,
} from '../domain/workout';
import type { ProgressPoint } from '../domain/progress';
import {
  WorkoutDateConflictError,
  WorkoutExerciseConflictError,
  type WorkoutRepository,
} from './workoutRepository';

type WorkoutRow = {
  id: string;
  date: string;
  created_at: string;
  updated_at: string;
};

type WorkoutExerciseRow = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  position: number;
};

type ExerciseSetRow = {
  id: string;
  workout_exercise_id: string;
  weight: number;
  repetitions: number;
  position: number;
};

function mapWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<Workout[]> {
    const rows = await this.db.getAllAsync<WorkoutRow>(
      `SELECT id, date, created_at, updated_at
       FROM workouts ORDER BY date DESC`,
    );
    return rows.map(mapWorkout);
  }

  async get(id: string): Promise<WorkoutDetails | null> {
    const workoutRow = await this.db.getFirstAsync<WorkoutRow>(
      'SELECT id, date, created_at, updated_at FROM workouts WHERE id = ?',
      id,
    );
    if (!workoutRow) return null;

    const exerciseRows = await this.db.getAllAsync<WorkoutExerciseRow>(
      `SELECT we.id, we.exercise_id, e.name AS exercise_name, we.position
       FROM workout_exercises we
       JOIN exercises e ON e.id = we.exercise_id
       WHERE we.workout_id = ? ORDER BY we.position`,
      id,
    );
    const setRows = await this.db.getAllAsync<ExerciseSetRow>(
      `SELECT es.id, es.workout_exercise_id, es.weight, es.repetitions, es.position
       FROM exercise_sets es
       JOIN workout_exercises we ON we.id = es.workout_exercise_id
       WHERE we.workout_id = ? ORDER BY we.position, es.position`,
      id,
    );

    const setsByExercise = new Map<string, ExerciseSet[]>();
    for (const row of setRows) {
      const sets = setsByExercise.get(row.workout_exercise_id) ?? [];
      sets.push({
        id: row.id,
        weight: row.weight,
        repetitions: row.repetitions,
        position: row.position,
      });
      setsByExercise.set(row.workout_exercise_id, sets);
    }

    const exercises: WorkoutExercise[] = exerciseRows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      position: row.position,
      sets: setsByExercise.get(row.id) ?? [],
    }));
    return { ...mapWorkout(workoutRow), exercises };
  }

  async create(date: string, now: Date): Promise<Workout> {
    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workouts WHERE date = ?',
      date,
    );
    if (existing) throw new WorkoutDateConflictError();

    const timestamp = now.toISOString();
    const row = await this.db.getFirstAsync<WorkoutRow>(
      `INSERT INTO workouts (id, date, created_at, updated_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?)
       RETURNING id, date, created_at, updated_at`,
      date,
      timestamp,
      timestamp,
    );
    if (!row) throw new Error('Не удалось создать тренировку.');
    return mapWorkout(row);
  }

  async clone(id: string, date: string, now: Date): Promise<WorkoutDetails> {
    const source = await this.get(id);
    if (!source) throw new Error('Тренировка не найдена.');
    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workouts WHERE date = ?',
      date,
    );
    if (existing) throw new WorkoutDateConflictError();

    const timestamp = now.toISOString();
    let clonedId: string | null = null;
    await this.db.withTransactionAsync(async () => {
      const workout = await this.db.getFirstAsync<{ id: string }>(
        `INSERT INTO workouts (id, date, created_at, updated_at)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?) RETURNING id`,
        date,
        timestamp,
        timestamp,
      );
      if (!workout) throw new Error('Не удалось клонировать тренировку.');
      clonedId = workout.id;

      for (const exercise of source.exercises) {
        const clonedExercise = await this.db.getFirstAsync<{ id: string }>(
          `INSERT INTO workout_exercises (id, workout_id, exercise_id, position)
           VALUES (lower(hex(randomblob(16))), ?, ?, ?) RETURNING id`,
          workout.id,
          exercise.exerciseId,
          exercise.position,
        );
        if (!clonedExercise)
          throw new Error('Не удалось клонировать упражнение.');
        for (const set of exercise.sets) {
          await this.db.runAsync(
            `INSERT INTO exercise_sets (
               id, workout_exercise_id, weight, repetitions, position
             ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`,
            clonedExercise.id,
            set.weight,
            set.repetitions,
            set.position,
          );
        }
      }
    });

    const clone = clonedId ? await this.get(clonedId) : null;
    if (!clone) throw new Error('Не удалось открыть клонированную тренировку.');
    return clone;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM workouts WHERE id = ?', id);
  }

  async getProgress(exerciseId: string): Promise<ProgressPoint[]> {
    const rows = await this.db.getAllAsync<{
      date: string;
      max_weight: number;
      total_volume: number;
    }>(
      `SELECT w.date,
              MAX(es.weight) AS max_weight,
              SUM(es.weight * es.repetitions) AS total_volume
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN exercise_sets es ON es.workout_exercise_id = we.id
       WHERE we.exercise_id = ?
       GROUP BY w.id, w.date
       ORDER BY w.date`,
      exerciseId,
    );
    return rows.map((row) => ({
      date: row.date,
      maxWeight: row.max_weight,
      totalVolume: row.total_volume,
    }));
  }

  async addExercise(
    workoutId: string,
    exerciseId: string,
    now: Date,
  ): Promise<void> {
    const existing = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_exercises
       WHERE workout_id = ? AND exercise_id = ?`,
      workoutId,
      exerciseId,
    );
    if (existing) throw new WorkoutExerciseConflictError();

    await this.db.runAsync(
      `INSERT INTO workout_exercises (id, workout_id, exercise_id, position)
       VALUES (
         lower(hex(randomblob(16))), ?, ?,
         COALESCE((SELECT MAX(position) + 1 FROM workout_exercises WHERE workout_id = ?), 0)
       )`,
      workoutId,
      exerciseId,
      workoutId,
    );
    await this.touchWorkout(workoutId, now);
  }

  async removeExercise(workoutExerciseId: string, now: Date): Promise<void> {
    const relation = await this.db.getFirstAsync<{ workout_id: string }>(
      'SELECT workout_id FROM workout_exercises WHERE id = ?',
      workoutExerciseId,
    );
    if (!relation) return;

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'DELETE FROM workout_exercises WHERE id = ?',
        workoutExerciseId,
      );
      const remaining = await this.db.getAllAsync<{ id: string }>(
        `SELECT id FROM workout_exercises
         WHERE workout_id = ? ORDER BY position`,
        relation.workout_id,
      );
      for (const [position, exercise] of remaining.entries()) {
        await this.db.runAsync(
          'UPDATE workout_exercises SET position = ? WHERE id = ?',
          position,
          exercise.id,
        );
      }
      await this.touchWorkout(relation.workout_id, now);
    });
  }

  async reorderExercises(
    workoutId: string,
    workoutExerciseIds: string[],
    now: Date,
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const current = await this.db.getAllAsync<{ id: string }>(
        `SELECT id FROM workout_exercises
         WHERE workout_id = ? ORDER BY position`,
        workoutId,
      );
      const currentIds = new Set(current.map(({ id }) => id));
      if (
        current.length !== workoutExerciseIds.length ||
        new Set(workoutExerciseIds).size !== workoutExerciseIds.length ||
        workoutExerciseIds.some((id) => !currentIds.has(id))
      ) {
        throw new Error('Некорректный порядок упражнений.');
      }

      if (current.length > 0) {
        await this.db.runAsync(
          `UPDATE workout_exercises SET position = position + ?
           WHERE workout_id = ?`,
          current.length,
          workoutId,
        );
      }
      for (const [position, id] of workoutExerciseIds.entries()) {
        await this.db.runAsync(
          `UPDATE workout_exercises SET position = ?
           WHERE id = ? AND workout_id = ?`,
          position,
          id,
          workoutId,
        );
      }
      await this.touchWorkout(workoutId, now);
    });
  }

  async addSet(
    workoutExerciseId: string,
    draft: ParsedExerciseSet,
    now: Date,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO exercise_sets (
         id, workout_exercise_id, weight, repetitions, position
       ) VALUES (
         lower(hex(randomblob(16))), ?, ?, ?,
         COALESCE((SELECT MAX(position) + 1 FROM exercise_sets WHERE workout_exercise_id = ?), 0)
       )`,
      workoutExerciseId,
      draft.weight,
      draft.repetitions,
      workoutExerciseId,
    );
    await this.touchWorkoutByExercise(workoutExerciseId, now);
  }

  async updateSet(
    id: string,
    draft: ParsedExerciseSet,
    now: Date,
  ): Promise<void> {
    await this.db.runAsync(
      'UPDATE exercise_sets SET weight = ?, repetitions = ? WHERE id = ?',
      draft.weight,
      draft.repetitions,
      id,
    );
    await this.touchWorkoutBySet(id, now);
  }

  async deleteSet(id: string, now: Date): Promise<void> {
    const row = await this.db.getFirstAsync<{ workout_exercise_id: string }>(
      'SELECT workout_exercise_id FROM exercise_sets WHERE id = ?',
      id,
    );
    if (!row) return;

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM exercise_sets WHERE id = ?', id);
      const remaining = await this.db.getAllAsync<{ id: string }>(
        `SELECT id FROM exercise_sets
         WHERE workout_exercise_id = ? ORDER BY position`,
        row.workout_exercise_id,
      );
      for (const [position, set] of remaining.entries()) {
        await this.db.runAsync(
          'UPDATE exercise_sets SET position = ? WHERE id = ?',
          position,
          set.id,
        );
      }
    });
    await this.touchWorkoutByExercise(row.workout_exercise_id, now);
  }

  private async touchWorkout(id: string, now: Date) {
    await this.db.runAsync(
      'UPDATE workouts SET updated_at = ? WHERE id = ?',
      now.toISOString(),
      id,
    );
  }

  private async touchWorkoutByExercise(id: string, now: Date) {
    await this.db.runAsync(
      `UPDATE workouts SET updated_at = ? WHERE id = (
         SELECT workout_id FROM workout_exercises WHERE id = ?
       )`,
      now.toISOString(),
      id,
    );
  }

  private async touchWorkoutBySet(id: string, now: Date) {
    await this.db.runAsync(
      `UPDATE workouts SET updated_at = ? WHERE id = (
         SELECT we.workout_id FROM workout_exercises we
         JOIN exercise_sets es ON es.workout_exercise_id = we.id
         WHERE es.id = ?
       )`,
      now.toISOString(),
      id,
    );
  }
}
