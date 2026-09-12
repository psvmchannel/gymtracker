import type { SQLiteDatabase } from 'expo-sqlite';

import { BACKUP_VERSION, type BackupSnapshot } from '../domain/backup';
import { normalizeExerciseName } from '../domain/exercise';
import {
  StorageNotEmptyError,
  type DataTransferRepository,
} from './dataTransferRepository';

type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: BackupSnapshot['exercises'][number]['muscleGroup'];
  is_archived: number;
  created_at: string;
  updated_at: string;
};
type WorkoutRow = {
  id: string;
  date: string;
  created_at: string;
  updated_at: string;
};
type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
};
type ExerciseSetRow = {
  id: string;
  workout_exercise_id: string;
  weight: number;
  repetitions: number;
  position: number;
};

export class SQLiteDataTransferRepository implements DataTransferRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async exportSnapshot(now: Date): Promise<BackupSnapshot> {
    let snapshot: BackupSnapshot | null = null;
    await this.db.withTransactionAsync(async () => {
      const exercises = await this.db.getAllAsync<ExerciseRow>(
        'SELECT id, name, muscle_group, is_archived, created_at, updated_at FROM exercises ORDER BY created_at, id',
      );
      const workouts = await this.db.getAllAsync<WorkoutRow>(
        'SELECT id, date, created_at, updated_at FROM workouts ORDER BY date, id',
      );
      const workoutExercises = await this.db.getAllAsync<WorkoutExerciseRow>(
        'SELECT id, workout_id, exercise_id, position FROM workout_exercises ORDER BY workout_id, position',
      );
      const exerciseSets = await this.db.getAllAsync<ExerciseSetRow>(
        'SELECT id, workout_exercise_id, weight, repetitions, position FROM exercise_sets ORDER BY workout_exercise_id, position',
      );
      snapshot = {
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        exercises: exercises.map((row) => ({
          id: row.id,
          name: row.name,
          muscleGroup: row.muscle_group,
          isArchived: row.is_archived === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        workouts: workouts.map((row) => ({
          id: row.id,
          date: row.date,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        workoutExercises: workoutExercises.map((row) => ({
          id: row.id,
          workoutId: row.workout_id,
          exerciseId: row.exercise_id,
          position: row.position,
        })),
        exerciseSets: exerciseSets.map((row) => ({
          id: row.id,
          workoutExerciseId: row.workout_exercise_id,
          weight: row.weight,
          repetitions: row.repetitions,
          position: row.position,
        })),
      };
    });
    if (!snapshot) throw new Error('Не удалось создать резервную копию.');
    return snapshot;
  }

  async importSnapshot(snapshot: BackupSnapshot): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const count = await this.db.getFirstAsync<{ count: number }>(
        `SELECT (SELECT COUNT(*) FROM exercises) +
                (SELECT COUNT(*) FROM workouts) +
                (SELECT COUNT(*) FROM workout_exercises) +
                (SELECT COUNT(*) FROM exercise_sets) AS count`,
      );
      if ((count?.count ?? 0) > 0) throw new StorageNotEmptyError();

      for (const item of snapshot.exercises) {
        await this.db.runAsync(
          `INSERT INTO exercises (id, name, normalized_name, muscle_group, is_archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          item.name,
          normalizeExerciseName(item.name),
          item.muscleGroup,
          item.isArchived ? 1 : 0,
          item.createdAt,
          item.updatedAt,
        );
      }
      for (const item of snapshot.workouts) {
        await this.db.runAsync(
          'INSERT INTO workouts (id, date, created_at, updated_at) VALUES (?, ?, ?, ?)',
          item.id,
          item.date,
          item.createdAt,
          item.updatedAt,
        );
      }
      for (const item of snapshot.workoutExercises) {
        await this.db.runAsync(
          'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)',
          item.id,
          item.workoutId,
          item.exerciseId,
          item.position,
        );
      }
      for (const item of snapshot.exerciseSets) {
        await this.db.runAsync(
          'INSERT INTO exercise_sets (id, workout_exercise_id, weight, repetitions, position) VALUES (?, ?, ?, ?, ?)',
          item.id,
          item.workoutExerciseId,
          item.weight,
          item.repetitions,
          item.position,
        );
      }
    });
  }

  async clearAll(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM workouts');
      await this.db.runAsync('DELETE FROM exercises');
    });
  }
}
