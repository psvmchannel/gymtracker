import { describe, expect, it } from '@jest/globals';

import { layoutProgressPoints } from './progress';

describe('layoutProgressPoints', () => {
  it('возвращает пустой график без данных', () => {
    expect(layoutProgressPoints([], 300, 180)).toEqual([]);
  });

  it('помещает единственную точку в центр', () => {
    expect(
      layoutProgressPoints([{ date: '2026-09-10', maxWeight: 80 }], 300, 180),
    ).toEqual([{ date: '2026-09-10', maxWeight: 80, x: 150, y: 90 }]);
  });

  it('располагает даты слева направо, а больший вес выше', () => {
    expect(
      layoutProgressPoints(
        [
          { date: '2026-09-01', maxWeight: 70 },
          { date: '2026-09-08', maxWeight: 90 },
        ],
        300,
        180,
      ),
    ).toEqual([
      { date: '2026-09-01', maxWeight: 70, x: 20, y: 160 },
      { date: '2026-09-08', maxWeight: 90, x: 280, y: 20 },
    ]);
  });
});
