import type { Exercise, ExerciseDraft } from '../domain/exercise';

export class DuplicateExerciseNameError extends Error {
  constructor() {
    super('Упражнение с таким названием уже существует.');
    this.name = 'DuplicateExerciseNameError';
  }
}

export interface ExerciseRepository {
  listActive(): Promise<Exercise[]>;
  create(draft: ExerciseDraft, now: Date): Promise<Exercise>;
  update(id: string, draft: ExerciseDraft, now: Date): Promise<Exercise>;
}
