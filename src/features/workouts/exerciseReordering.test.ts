import { describe, expect, it } from '@jest/globals';

import { getExerciseDragTarget } from './exerciseReordering';

describe('getExerciseDragTarget', () => {
  const ids = ['first', 'second', 'new'];
  const layouts = {
    first: { height: 180, y: 0 },
    second: { height: 80, y: 192 },
    new: { height: 80, y: 284 },
  };

  it('перемещает новое упражнение в середину после пересечения центра', () => {
    expect(getExerciseDragTarget(ids, layouts, 'new', -150)).toBe(1);
  });

  it('не меняет порядок до пересечения соседней карточки', () => {
    expect(getExerciseDragTarget(ids, layouts, 'new', -60)).toBe(2);
  });

  it('перемещает через несколько карточек за один жест', () => {
    expect(getExerciseDragTarget(ids, layouts, 'new', -260)).toBe(0);
  });

  it('безопасно обрабатывает ещё не измеренную новую карточку', () => {
    expect(
      getExerciseDragTarget(ids, { first: layouts.first }, 'new', -100),
    ).toBeUndefined();
  });
});
