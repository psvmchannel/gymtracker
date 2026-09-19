import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Exercise } from '../../domain/exercise';
import {
  layoutProgressPoints,
  type ProgressMetric,
  type ProgressPoint,
} from '../../domain/progress';
import type { ExerciseRepository } from '../../repositories/exerciseRepository';
import type { WorkoutRepository } from '../../repositories/workoutRepository';
import type { DataTransferRepository } from '../../repositories/dataTransferRepository';
import { DataTransferPanel } from '../dataTransfer/DataTransferPanel';

type Props = {
  exerciseRepository: ExerciseRepository;
  workoutRepository: WorkoutRepository;
  dataTransferRepository: DataTransferRepository;
  onImported: () => void;
};

const CHART_HEIGHT = 220;
const CHART_INSETS = { bottom: 42, left: 28, right: 16, top: 26 } as const;
const METRICS: { id: ProgressMetric; label: string; title: string }[] = [
  { id: 'maxWeight', label: 'Макс. вес', title: 'Максимальный вес, кг' },
  { id: 'totalVolume', label: 'Объём', title: 'Объём нагрузки, кг' },
];

export function StatisticsScreen({
  exerciseRepository,
  workoutRepository,
  dataTransferRepository,
  onImported,
}: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [metric, setMetric] = useState<ProgressMetric>('maxWeight');
  const [chartWidth, setChartWidth] = useState(0);
  const [resultHeight, setResultHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    exerciseRepository
      .listAll()
      .then((items) => {
        if (!isCurrent) return;
        setExercises(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
        if (items.length === 0) setIsLoading(false);
        setError(null);
      })
      .catch(() => {
        if (isCurrent) {
          setError('Не удалось загрузить упражнения.');
          setIsLoading(false);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [exerciseRepository]);

  useEffect(() => {
    let isCurrent = true;
    if (!selectedId) return;
    workoutRepository
      .getProgress(selectedId)
      .then((points) => {
        if (isCurrent) {
          setProgress(points);
          setError(null);
        }
      })
      .catch(() => {
        if (isCurrent) setError('Не удалось загрузить статистику.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedId, workoutRepository]);

  const chartPoints = useMemo(
    () =>
      layoutProgressPoints(
        progress,
        metric,
        chartWidth,
        CHART_HEIGHT,
        CHART_INSETS,
      ),
    [chartWidth, metric, progress],
  );
  const yAxisTicks = useMemo(() => {
    const values = progress.map((point) => point[metric]);
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return [
        {
          value: min,
          y:
            CHART_INSETS.top +
            (CHART_HEIGHT - CHART_INSETS.top - CHART_INSETS.bottom) / 2,
        },
      ];
    }
    return [
      { value: max, y: CHART_INSETS.top },
      {
        value: (min + max) / 2,
        y:
          CHART_INSETS.top +
          (CHART_HEIGHT - CHART_INSETS.top - CHART_INSETS.bottom) / 2,
      },
      { value: min, y: CHART_HEIGHT - CHART_INSETS.bottom },
    ];
  }, [metric, progress]);
  const xAxisTicks = useMemo(() => {
    if (chartPoints.length <= 2) return chartPoints;
    return [
      chartPoints[0]!,
      chartPoints[Math.floor((chartPoints.length - 1) / 2)]!,
      chartPoints[chartPoints.length - 1]!,
    ];
  }, [chartPoints]);
  const selected = exercises.find(({ id }) => id === selectedId);
  const metricDetails = METRICS.find(({ id }) => id === metric)!;

  function selectExercise(id: string) {
    if (id === selectedId) return;
    setIsLoading(true);
    setSelectedId(id);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>GYMTRACKER</Text>
      <Text style={styles.title}>Статистика</Text>
      <Text style={styles.label}>Упражнение</Text>
      {exercises.length === 0 && !isLoading ? (
        <Text style={styles.empty}>Сначала добавь упражнение.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.exerciseList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {exercises.map((exercise) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: exercise.id === selectedId }}
              key={exercise.id}
              onPress={() => selectExercise(exercise.id)}
              style={[
                styles.exerciseButton,
                exercise.id === selectedId && styles.selectedExerciseButton,
              ]}
            >
              <Text
                style={[
                  styles.exerciseText,
                  exercise.id === selectedId && styles.selectedExerciseText,
                ]}
              >
                {exercise.name}
                {exercise.isArchived ? ' · архив' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {selected ? (
        <>
          <Text style={styles.metricLabel}>Метрика</Text>
          <View accessibilityRole="radiogroup" style={styles.metricSwitch}>
            {METRICS.map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: item.id === metric }}
                key={item.id}
                onPress={() => setMetric(item.id)}
                style={[
                  styles.metricButton,
                  item.id === metric && styles.selectedMetricButton,
                ]}
              >
                <Text
                  style={[
                    styles.metricButtonText,
                    item.id === metric && styles.selectedMetricButtonText,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View
        onLayout={(event) => {
          if (!isLoading) setResultHeight(event.nativeEvent.layout.height);
        }}
        style={
          isLoading && resultHeight > 0 ? { height: resultHeight } : undefined
        }
      >
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : isLoading ? (
          <ActivityIndicator color="#111827" style={styles.loader} />
        ) : selected && progress.length === 0 ? (
          <Text style={styles.empty}>
            Для этого упражнения пока нет подходов.
          </Text>
        ) : selected ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{metricDetails.title}</Text>
            <View
              accessibilityLabel={`График прогресса, ${metricDetails.title.toLowerCase()}: ${progress.map((point) => `${point.date} — ${point[metric]} кг`).join(', ')}`}
              accessibilityRole="image"
              onLayout={(event) =>
                setChartWidth(event.nativeEvent.layout.width)
              }
              style={styles.chart}
            >
              <View accessibilityElementsHidden style={styles.yAxis} />
              <View accessibilityElementsHidden style={styles.xAxis} />
              {yAxisTicks.map((tick) => (
                <View
                  accessibilityElementsHidden
                  key={tick.y}
                  style={[styles.yTick, { top: tick.y }]}
                >
                  <Text style={styles.yTickLabel}>
                    {formatAxisValue(tick.value)}
                  </Text>
                  <View style={styles.yTickMark} />
                </View>
              ))}
              {xAxisTicks.map((tick) => (
                <View
                  accessibilityElementsHidden
                  key={tick.date}
                  style={[styles.xTick, { left: tick.x }]}
                >
                  <View style={styles.xTickMark} />
                  <Text style={styles.xTickLabel}>
                    {formatAxisDate(tick.date)}
                  </Text>
                </View>
              ))}
              {chartPoints.slice(1).map((point, index) => {
                const previous = chartPoints[index];
                if (!previous) return null;
                const dx = point.x - previous.x;
                const dy = point.y - previous.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = `${Math.atan2(dy, dx)}rad`;
                return (
                  <View
                    key={`${previous.date}-${point.date}`}
                    style={[
                      styles.line,
                      {
                        left: (previous.x + point.x - length) / 2,
                        top: (previous.y + point.y) / 2,
                        transform: [{ rotate: angle }],
                        width: length,
                      },
                    ]}
                  />
                );
              })}
              {chartPoints.map((point) => (
                <View
                  key={point.date}
                  style={[styles.dot, { left: point.x - 5, top: point.y - 5 }]}
                />
              ))}
            </View>
            <View style={styles.values}>
              {progress.map((point) => (
                <View key={point.date} style={styles.valueRow}>
                  <Text style={styles.date}>{point.date}</Text>
                  <Text style={styles.value}>{point[metric]} кг</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
      <DataTransferPanel
        repository={dataTransferRepository}
        onImported={onImported}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 24, paddingTop: 56 },
  eyebrow: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: { color: '#111827', fontSize: 34, fontWeight: '700', marginTop: 8 },
  label: { color: '#374151', fontSize: 14, fontWeight: '600', marginTop: 24 },
  exerciseList: { gap: 8, paddingVertical: 12 },
  exerciseButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectedExerciseButton: { backgroundColor: '#111827' },
  exerciseText: { color: '#374151', fontWeight: '600' },
  selectedExerciseText: { color: '#ffffff' },
  metricLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  metricSwitch: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    flexDirection: 'row',
    marginTop: 8,
    padding: 3,
  },
  metricButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedMetricButton: { backgroundColor: '#ffffff' },
  metricButtonText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  selectedMetricButtonText: { color: '#111827' },
  loader: { marginTop: 36 },
  error: { color: '#b91c1c', fontSize: 15, marginTop: 20 },
  empty: { color: '#6b7280', fontSize: 16, lineHeight: 23, marginTop: 24 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 12,
    padding: 16,
  },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '700' },
  chart: {
    height: CHART_HEIGHT,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  yAxis: {
    backgroundColor: '#9ca3af',
    bottom: CHART_INSETS.bottom,
    left: CHART_INSETS.left,
    position: 'absolute',
    top: CHART_INSETS.top,
    width: 1,
  },
  xAxis: {
    backgroundColor: '#9ca3af',
    bottom: CHART_INSETS.bottom,
    height: 1,
    left: CHART_INSETS.left,
    position: 'absolute',
    right: CHART_INSETS.right,
  },
  yTick: {
    height: 16,
    left: 0,
    position: 'absolute',
    transform: [{ translateY: -8 }],
    width: CHART_INSETS.left + 4,
  },
  yTickLabel: {
    color: '#6b7280',
    fontSize: 10,
    paddingRight: 8,
    textAlign: 'right',
  },
  yTickMark: {
    backgroundColor: '#9ca3af',
    height: 1,
    position: 'absolute',
    right: 0,
    top: 8,
    width: 5,
  },
  xTick: {
    position: 'absolute',
    top: CHART_HEIGHT - CHART_INSETS.bottom,
    transform: [{ translateX: -16 }],
    width: 32,
  },
  xTickMark: {
    alignSelf: 'center',
    backgroundColor: '#9ca3af',
    height: 5,
    width: 1,
  },
  xTickLabel: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
  },
  line: { backgroundColor: '#2563eb', height: 3, position: 'absolute' },
  dot: {
    backgroundColor: '#2563eb',
    borderColor: '#ffffff',
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    width: 10,
  },
  values: {
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 8,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  date: { color: '#6b7280', fontSize: 14 },
  value: { color: '#111827', fontSize: 14, fontWeight: '700' },
});

function formatAxisValue(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatAxisDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
}
