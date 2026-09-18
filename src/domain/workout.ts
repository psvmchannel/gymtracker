export type ExerciseSet = {
  id: string;
  weight: number;
  repetitions: number;
  position: number;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  position: number;
  sets: ExerciseSet[];
};

export type Workout = {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutDetails = Workout & {
  exercises: WorkoutExercise[];
};

export type ExerciseSetDraft = {
  weight: string;
  repetitions: string;
};

export type ParsedExerciseSet = {
  weight: number;
  repetitions: number;
};

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; message: string };

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function findWorkoutByLocalDate(
  workouts: Workout[],
  localDate: string,
): Workout | null {
  return workouts.find((workout) => workout.date === localDate) ?? null;
}

export function validateWorkoutDate(date: string): ValidationResult<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: 'Введите дату в формате ГГГГ-ММ-ДД.' };
  }

  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(0);
  candidate.setHours(0, 0, 0, 0);
  candidate.setFullYear(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return { ok: false, message: 'Такой календарной даты не существует.' };
  }

  return { ok: true, value: date };
}

export function validateExerciseSet(
  draft: ExerciseSetDraft,
): ValidationResult<ParsedExerciseSet> {
  const normalizedWeight = draft.weight.trim().replace(',', '.');
  const weight = Number(normalizedWeight);
  const repetitions = Number(draft.repetitions.trim());

  if (normalizedWeight.length === 0 || !Number.isFinite(weight) || weight < 0) {
    return { ok: false, message: 'Вес должен быть неотрицательным числом.' };
  }

  if (!Number.isInteger(repetitions) || repetitions <= 0) {
    return {
      ok: false,
      message: 'Повторения должны быть положительным целым числом.',
    };
  }

  return { ok: true, value: { weight, repetitions } };
}
