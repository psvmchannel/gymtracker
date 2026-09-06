import type { SQLiteDatabase } from 'expo-sqlite';

import {
  normalizeExerciseName,
  type Exercise,
  type ExerciseDraft,
  type MuscleGroup,
} from '../domain/exercise';
import {
  DuplicateExerciseNameError,
  type ExerciseRepository,
} from './exerciseRepository';

type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      muscle_group TEXT NOT NULL CHECK (
        muscle_group IN ('chest', 'back', 'legs', 'biceps', 'triceps', 'shoulders', 'abs')
      ),
      is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(exercises)',
  );
  if (!columns.some((column) => column.name === 'normalized_name')) {
    await db.execAsync(
      "ALTER TABLE exercises ADD COLUMN normalized_name TEXT NOT NULL DEFAULT ''",
    );
    const exercises = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT id, name FROM exercises',
    );
    for (const exercise of exercises) {
      await db.runAsync(
        'UPDATE exercises SET normalized_name = ? WHERE id = ?',
        normalizeExerciseName(exercise.name),
        exercise.id,
      );
    }
  }

  await db.execAsync(`
    DROP INDEX IF EXISTS exercises_active_name_unique;
    CREATE UNIQUE INDEX exercises_active_name_unique
      ON exercises (normalized_name)
      WHERE is_archived = 0;
  `);
}

export class SQLiteExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listActive(): Promise<Exercise[]> {
    const rows = await this.db.getAllAsync<ExerciseRow>(
      `SELECT id, name, muscle_group, is_archived, created_at, updated_at
       FROM exercises
       WHERE is_archived = 0
       ORDER BY name COLLATE NOCASE, created_at`,
    );

    return rows.map(mapExercise);
  }

  async create(draft: ExerciseDraft, now: Date): Promise<Exercise> {
    await this.assertNameAvailable(draft.name);
    const timestamp = now.toISOString();
    const row = await this.db.getFirstAsync<ExerciseRow>(
      `INSERT INTO exercises (
         id, name, normalized_name, muscle_group, is_archived, created_at, updated_at
       ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 0, ?, ?)
       RETURNING id, name, muscle_group, is_archived, created_at, updated_at`,
      draft.name,
      normalizeExerciseName(draft.name),
      draft.muscleGroup,
      timestamp,
      timestamp,
    );

    if (!row) {
      throw new Error('Не удалось создать упражнение.');
    }

    return mapExercise(row);
  }

  async update(id: string, draft: ExerciseDraft, now: Date): Promise<Exercise> {
    await this.assertNameAvailable(draft.name, id);
    const row = await this.db.getFirstAsync<ExerciseRow>(
      `UPDATE exercises
       SET name = ?, normalized_name = ?, muscle_group = ?, updated_at = ?
       WHERE id = ? AND is_archived = 0
       RETURNING id, name, muscle_group, is_archived, created_at, updated_at`,
      draft.name,
      normalizeExerciseName(draft.name),
      draft.muscleGroup,
      now.toISOString(),
      id,
    );

    if (!row) {
      throw new Error('Упражнение не найдено.');
    }

    return mapExercise(row);
  }

  private async assertNameAvailable(name: string, exceptId?: string) {
    const duplicate = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM exercises
       WHERE is_archived = 0
         AND normalized_name = ?
         AND (? IS NULL OR id <> ?)
       LIMIT 1`,
      normalizeExerciseName(name),
      exceptId ?? null,
      exceptId ?? null,
    );

    if (duplicate) {
      throw new DuplicateExerciseNameError();
    }
  }
}
