export const APP_SECTIONS = [
  { id: 'workouts', label: 'Тренировки' },
  { id: 'exercises', label: 'Упражнения' },
  { id: 'statistics', label: 'Статистика' },
] as const;

export type SectionId = (typeof APP_SECTIONS)[number]['id'];

export const DEFAULT_SECTION: SectionId = 'workouts';
