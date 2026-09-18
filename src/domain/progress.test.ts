import { describe, expect, it } from '@jest/globals';

import { calculateWorkoutVolume, layoutProgressPoints } from './progress';

describe('layoutProgressPoints', () => {
  it('возвращает пустой график без данных', () => {
    expect(layoutProgressPoints([], 'maxWeight', 300, 180)).toEqual([]);
  });

  it('помещает единственную точку в центр', () => {
    expect(
      layoutProgressPoints(
        [{ date: '2026-09-10', maxWeight: 80, totalVolume: 2400 }],
        'totalVolume',
        300,
        180,
      ),
    ).toEqual([
      {
        date: '2026-09-10',
        maxWeight: 80,
        totalVolume: 2400,
        x: 150,
        y: 90,
      },
    ]);
  });

  it('располагает даты слева направо, а больший вес выше', () => {
    expect(
      layoutProgressPoints(
        [
          { date: '2026-09-01', maxWeight: 70, totalVolume: 2100 },
          { date: '2026-09-08', maxWeight: 90, totalVolume: 1800 },
        ],
        'maxWeight',
        300,
        180,
      ),
    ).toEqual([
      {
        date: '2026-09-01',
        maxWeight: 70,
        totalVolume: 2100,
        x: 20,
        y: 160,
      },
      {
        date: '2026-09-08',
        maxWeight: 90,
        totalVolume: 1800,
        x: 280,
        y: 20,
      },
    ]);
  });

  it('считает объём без округления дробного веса', () => {
    expect(
      calculateWorkoutVolume([
        { weight: 50, repetitions: 10 },
        { weight: 50, repetitions: 10 },
        { weight: 50, repetitions: 10 },
        { weight: 50, repetitions: 10 },
      ]),
    ).toBe(2000);
    expect(calculateWorkoutVolume([{ weight: 82.5, repetitions: 3 }])).toBe(
      247.5,
    );
  });
});
