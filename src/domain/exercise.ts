export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'biceps',
  'triceps',
  'shoulders',
  'abs',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  legs: 'Ноги',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  shoulders: 'Плечи',
  abs: 'Пресс',
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseDraft = {
  name: string;
  muscleGroup: MuscleGroup;
};

export type ExerciseValidationResult =
  { ok: true; value: ExerciseDraft } | { ok: false; message: string };

export function validateExerciseDraft(
  draft: ExerciseDraft,
): ExerciseValidationResult {
  const name = draft.name.trim();

  if (name.length === 0) {
    return { ok: false, message: 'Введите название упражнения.' };
  }

  if (name.length > 100) {
    return {
      ok: false,
      message: 'Название не должно быть длиннее 100 символов.',
    };
  }

  return { ok: true, value: { ...draft, name } };
}

export function normalizeExerciseName(name: string): string {
  return name.trim().toLocaleLowerCase('ru-RU');
}
