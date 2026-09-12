export type ProgressPoint = {
  date: string;
  maxWeight: number;
};

export type ChartPoint = ProgressPoint & { x: number; y: number };

export function layoutProgressPoints(
  points: ProgressPoint[],
  width: number,
  height: number,
  padding = 20,
): ChartPoint[] {
  if (points.length === 0) return [];
  const usableWidth = Math.max(0, width - padding * 2);
  const usableHeight = Math.max(0, height - padding * 2);
  const weights = points.map(({ maxWeight }) => maxWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = maxWeight - minWeight;

  return points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * usableWidth,
    y:
      weightRange === 0
        ? height / 2
        : padding +
          ((maxWeight - point.maxWeight) / weightRange) * usableHeight,
  }));
}
