import { describe, expect, it } from '@jest/globals';

import type { Exercise } from '../../domain/exercise';
import { groupExercises } from './groupExercises';

function exercise(
  id: string,
  name: string,
  muscleGroup: Exercise['muscleGroup'],
): Exercise {
  return {
    id,
    name,
    muscleGroup,
    isArchived: false,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
  };
}

describe('группировка упражнений', () => {
  it('создаёт только непустые секции в продуктовом порядке групп', () => {
    const result = groupExercises([
      exercise('legs-1', 'Приседания', 'legs'),
      exercise('chest-1', 'Жим лёжа', 'chest'),
      exercise('back-1', 'Тяга блока', 'back'),
    ]);

    expect(result.map(({ muscleGroup }) => muscleGroup)).toEqual([
      'chest',
      'back',
      'legs',
    ]);
  });

  it('помещает каждое упражнение ровно в одну секцию и сохраняет порядок внутри неё', () => {
    const exercises = [
      exercise('back-1', 'Подтягивания', 'back'),
      exercise('chest-1', 'Жим лёжа', 'chest'),
      exercise('back-2', 'Тяга блока', 'back'),
    ];

    const result = groupExercises(exercises);

    expect(result).toEqual([
      { muscleGroup: 'chest', exercises: [exercises[1]] },
      { muscleGroup: 'back', exercises: [exercises[0], exercises[2]] },
    ]);
    expect(result.flatMap((group) => group.exercises)).toHaveLength(
      exercises.length,
    );
  });

  it('возвращает пустой список секций для пустого каталога', () => {
    expect(groupExercises([])).toEqual([]);
  });
});
