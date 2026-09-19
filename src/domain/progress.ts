export type ProgressPoint = {
  date: string;
  maxWeight: number;
  totalVolume: number;
};

export type ChartPoint = ProgressPoint & { x: number; y: number };
export type ProgressMetric = 'maxWeight' | 'totalVolume';
export type ChartInsets = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

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
  padding: number | ChartInsets = 20,
): ChartPoint[] {
  if (points.length === 0) return [];
  const insets =
    typeof padding === 'number'
      ? { bottom: padding, left: padding, right: padding, top: padding }
      : padding;
  const usableWidth = Math.max(0, width - insets.left - insets.right);
  const usableHeight = Math.max(0, height - insets.top - insets.bottom);
  const values = points.map((point) => point[metric]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue;

  return points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? width / 2
        : insets.left + (index / (points.length - 1)) * usableWidth,
    y:
      valueRange === 0
        ? insets.top + usableHeight / 2
        : insets.top + ((maxValue - point[metric]) / valueRange) * usableHeight,
  }));
}
