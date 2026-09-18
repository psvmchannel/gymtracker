import type {
  ParsedExerciseSet,
  Workout,
  WorkoutDetails,
} from '../domain/workout';
import type { ProgressPoint } from '../domain/progress';

export class WorkoutDateConflictError extends Error {
  constructor() {
    super('На эту дату тренировка уже существует.');
    this.name = 'WorkoutDateConflictError';
  }
}

export class WorkoutExerciseConflictError extends Error {
  constructor() {
    super('Это упражнение уже добавлено в тренировку.');
    this.name = 'WorkoutExerciseConflictError';
  }
}

export interface WorkoutRepository {
  list(): Promise<Workout[]>;
  get(id: string): Promise<WorkoutDetails | null>;
  create(date: string, now: Date): Promise<Workout>;
  clone(id: string, date: string, now: Date): Promise<WorkoutDetails>;
  delete(id: string): Promise<void>;
  getProgress(exerciseId: string): Promise<ProgressPoint[]>;
  addExercise(workoutId: string, exerciseId: string, now: Date): Promise<void>;
  removeExercise(workoutExerciseId: string, now: Date): Promise<void>;
  reorderExercises(
    workoutId: string,
    workoutExerciseIds: string[],
    now: Date,
  ): Promise<void>;
  addSet(
    workoutExerciseId: string,
    draft: ParsedExerciseSet,
    now: Date,
  ): Promise<void>;
  updateSet(id: string, draft: ParsedExerciseSet, now: Date): Promise<void>;
  deleteSet(id: string, now: Date): Promise<void>;
}
