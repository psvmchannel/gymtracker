import {
  MUSCLE_GROUPS,
  normalizeExerciseName,
  type MuscleGroup,
} from './exercise';
import { validateWorkoutDate } from './workout';

export const BACKUP_VERSION = 1 as const;

export type BackupExercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackupWorkout = {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type BackupWorkoutExercise = {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
};

export type BackupExerciseSet = {
  id: string;
  workoutExerciseId: string;
  weight: number;
  repetitions: number;
  position: number;
};

export type BackupSnapshot = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  exercises: BackupExercise[];
  workouts: BackupWorkout[];
  workoutExercises: BackupWorkoutExercise[];
  exerciseSets: BackupExerciseSet[];
};

export type BackupValidationResult =
  { ok: true; value: BackupSnapshot } | { ok: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const isTimestamp = (value: unknown): value is string =>
  isText(value) && !Number.isNaN(Date.parse(value));
const isPosition = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

export function parseBackupJson(json: string): BackupValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Файл не содержит корректный JSON.' };
  }
  return validateBackup(value);
}

export function validateBackup(value: unknown): BackupValidationResult {
  if (!isRecord(value)) return invalid('Некорректная структура файла.');
  if (value.version !== BACKUP_VERSION) {
    return invalid('Версия резервной копии не поддерживается.');
  }
  if (!isTimestamp(value.exportedAt))
    return invalid('Некорректная дата экспорта.');
  if (
    !Array.isArray(value.exercises) ||
    !Array.isArray(value.workouts) ||
    !Array.isArray(value.workoutExercises) ||
    !Array.isArray(value.exerciseSets)
  ) {
    return invalid('В резервной копии отсутствуют обязательные разделы.');
  }

  const exercises: BackupExercise[] = [];
  for (const item of value.exercises) {
    if (
      !isRecord(item) ||
      !isText(item.id) ||
      !isText(item.name) ||
      item.name.trim() !== item.name ||
      item.name.length > 100 ||
      !MUSCLE_GROUPS.includes(item.muscleGroup as MuscleGroup) ||
      typeof item.isArchived !== 'boolean' ||
      !isTimestamp(item.createdAt) ||
      !isTimestamp(item.updatedAt)
    )
      return invalid('Некорректная запись упражнения.');
    exercises.push(item as BackupExercise);
  }

  const workouts: BackupWorkout[] = [];
  for (const item of value.workouts) {
    if (
      !isRecord(item) ||
      !isText(item.id) ||
      typeof item.date !== 'string' ||
      !validateWorkoutDate(item.date).ok ||
      !isTimestamp(item.createdAt) ||
      !isTimestamp(item.updatedAt)
    )
      return invalid('Некорректная запись тренировки.');
    workouts.push(item as BackupWorkout);
  }

  const workoutExercises: BackupWorkoutExercise[] = [];
  for (const item of value.workoutExercises) {
    if (
      !isRecord(item) ||
      !isText(item.id) ||
      !isText(item.workoutId) ||
      !isText(item.exerciseId) ||
      !isPosition(item.position)
    )
      return invalid('Некорректная связь упражнения с тренировкой.');
    workoutExercises.push(item as BackupWorkoutExercise);
  }

  const exerciseSets: BackupExerciseSet[] = [];
  for (const item of value.exerciseSets) {
    if (
      !isRecord(item) ||
      !isText(item.id) ||
      !isText(item.workoutExerciseId) ||
      typeof item.weight !== 'number' ||
      !Number.isFinite(item.weight) ||
      item.weight < 0 ||
      !Number.isInteger(item.repetitions) ||
      Number(item.repetitions) <= 0 ||
      !isPosition(item.position)
    )
      return invalid('Некорректная запись подхода.');
    exerciseSets.push(item as BackupExerciseSet);
  }

  if (
    !hasUniqueValues(exercises.map(({ id }) => id)) ||
    !hasUniqueValues(workouts.map(({ id }) => id)) ||
    !hasUniqueValues(workoutExercises.map(({ id }) => id)) ||
    !hasUniqueValues(exerciseSets.map(({ id }) => id))
  ) {
    return invalid('В резервной копии повторяются идентификаторы.');
  }
  if (!hasUniqueValues(workouts.map(({ date }) => date))) {
    return invalid('В резервной копии повторяются даты тренировок.');
  }
  if (
    !hasUniqueValues(
      workoutExercises.map(
        ({ workoutId, exerciseId }) => `${workoutId}\u0000${exerciseId}`,
      ),
    )
  ) {
    return invalid('Упражнение повторяется в одной тренировке.');
  }
  const activeNames = exercises
    .filter(({ isArchived }) => !isArchived)
    .map(({ name }) => normalizeExerciseName(name));
  if (!hasUniqueValues(activeNames))
    return invalid('Повторяются названия активных упражнений.');

  const exerciseIds = new Set(exercises.map(({ id }) => id));
  const workoutIds = new Set(workouts.map(({ id }) => id));
  if (
    workoutExercises.some(
      (item) =>
        !exerciseIds.has(item.exerciseId) || !workoutIds.has(item.workoutId),
    )
  ) {
    return invalid('Резервная копия содержит повреждённые ссылки.');
  }
  const workoutExerciseIds = new Set(workoutExercises.map(({ id }) => id));
  if (
    exerciseSets.some((item) => !workoutExerciseIds.has(item.workoutExerciseId))
  ) {
    return invalid('Резервная копия содержит повреждённые ссылки.');
  }
  if (
    !positionsAreValid(workoutExercises, 'workoutId') ||
    !positionsAreValid(exerciseSets, 'workoutExerciseId')
  ) {
    return invalid('Нарушен порядок упражнений или подходов.');
  }

  return {
    ok: true,
    value: {
      version: BACKUP_VERSION,
      exportedAt: value.exportedAt,
      exercises,
      workouts,
      workoutExercises,
      exerciseSets,
    },
  };
}

function positionsAreValid<T extends { position: number }>(
  items: T[],
  parentKey: keyof T,
) {
  const groups = new Map<unknown, number[]>();
  for (const item of items) {
    const positions = groups.get(item[parentKey]) ?? [];
    positions.push(item.position);
    groups.set(item[parentKey], positions);
  }
  return [...groups.values()].every((positions) =>
    positions
      .sort((a, b) => a - b)
      .every((position, index) => position === index),
  );
}

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length;
}

function invalid(message: string): BackupValidationResult {
  return { ok: false, message };
}
