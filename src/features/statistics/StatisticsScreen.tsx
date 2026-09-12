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

export function StatisticsScreen({
  exerciseRepository,
  workoutRepository,
  dataTransferRepository,
  onImported,
}: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [chartWidth, setChartWidth] = useState(0);
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
    () => layoutProgressPoints(progress, chartWidth, CHART_HEIGHT, 26),
    [chartWidth, progress],
  );
  const selected = exercises.find(({ id }) => id === selectedId);

  function selectExercise(id: string) {
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
          <Text style={styles.cardTitle}>Максимальный вес, кг</Text>
          <View
            accessibilityLabel={`График прогресса: ${progress.map((point) => `${point.date} — ${point.maxWeight} кг`).join(', ')}`}
            accessibilityRole="image"
            onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
            style={styles.chart}
          >
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
                <Text style={styles.weight}>{point.maxWeight} кг</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
    borderBottomColor: '#d1d5db',
    borderBottomWidth: 1,
    height: CHART_HEIGHT,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
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
  weight: { color: '#111827', fontSize: 14, fontWeight: '700' },
});
