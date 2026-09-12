import { openDatabaseAsync } from 'expo-sqlite';

import type { DataTransferRepository } from './dataTransferRepository';
import type { ExerciseRepository } from './exerciseRepository';
import { SQLiteDataTransferRepository } from './sqliteDataTransferRepository';
import {
  migrateDatabase,
  SQLiteExerciseRepository,
} from './sqliteExerciseRepository';
import { SQLiteWorkoutRepository } from './sqliteWorkoutRepository';
import type { WorkoutRepository } from './workoutRepository';

export type AppRepositories = {
  exercises: ExerciseRepository;
  workouts: WorkoutRepository;
  dataTransfer: DataTransferRepository;
};

export async function createRepositories(): Promise<AppRepositories> {
  const db = await openDatabaseAsync('gym-tracker.db');
  await migrateDatabase(db);
  return {
    exercises: new SQLiteExerciseRepository(db),
    workouts: new SQLiteWorkoutRepository(db),
    dataTransfer: new SQLiteDataTransferRepository(db),
  };
}
