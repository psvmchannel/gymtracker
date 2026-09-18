export type ProgressPoint = {
  date: string;
  maxWeight: number;
  totalVolume: number;
};

export type ChartPoint = ProgressPoint & { x: number; y: number };
export type ProgressMetric = 'maxWeight' | 'totalVolume';

export function calculateWorkoutVolume(
  sets: { weight: number; repetitions: number }[],
): number {
  return sets.reduce((total, set) => total + set.weight * set.repetitions, 0);
}

export function layoutProgressPoints(
  points: ProgressPoint[],
  metric: ProgressMetric,
  width: number,
  height: number,
  padding = 20,
): ChartPoint[] {
  if (points.length === 0) return [];
  const usableWidth = Math.max(0, width - padding * 2);
  const usableHeight = Math.max(0, height - padding * 2);
  const values = points.map((point) => point[metric]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue;

  return points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * usableWidth,
    y:
      valueRange === 0
        ? height / 2
        : padding + ((maxValue - point[metric]) / valueRange) * usableHeight,
  }));
}
