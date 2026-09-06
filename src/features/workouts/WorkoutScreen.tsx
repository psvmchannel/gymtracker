import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Exercise } from '../../domain/exercise';
import {
  formatLocalDate,
  validateExerciseSet,
  validateWorkoutDate,
  type ExerciseSetDraft,
  type Workout,
  type WorkoutDetails,
} from '../../domain/workout';
import type { ExerciseRepository } from '../../repositories/exerciseRepository';
import type { WorkoutRepository } from '../../repositories/workoutRepository';

type Props = {
  exerciseRepository: ExerciseRepository;
  workoutRepository: WorkoutRepository;
  now?: () => Date;
};

const EMPTY_SET: ExerciseSetDraft = { weight: '', repetitions: '' };

export function WorkoutScreen({
  exerciseRepository,
  workoutRepository,
  now = () => new Date(),
}: Props) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activeExercises, setActiveExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<WorkoutDetails | null>(null);
  const [date, setDate] = useState(() => formatLocalDate(now()));
  const [setDrafts, setSetDrafts] = useState<Record<string, ExerciseSetDraft>>(
    {},
  );
  const [editingSet, setEditingSet] = useState<{
    id: string;
    workoutExerciseId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(
    async (selectedId?: string) => {
      const [nextWorkouts, nextExercises] = await Promise.all([
        workoutRepository.list(),
        exerciseRepository.listActive(),
      ]);
      setWorkouts(nextWorkouts);
      setActiveExercises(nextExercises);

      const id = selectedId ?? selected?.id;
      if (id) setSelected(await workoutRepository.get(id));
    },
    [exerciseRepository, selected?.id, workoutRepository],
  );

  useEffect(() => {
    let isCurrent = true;
    Promise.all([workoutRepository.list(), exerciseRepository.listActive()])
      .then(([nextWorkouts, nextExercises]) => {
        if (isCurrent) {
          setWorkouts(nextWorkouts);
          setActiveExercises(nextExercises);
        }
      })
      .catch(() => {
        if (isCurrent) setError('Не удалось загрузить тренировки.');
      });
    return () => {
      isCurrent = false;
    };
  }, [exerciseRepository, workoutRepository]);

  async function runMutation(action: () => Promise<void>) {
    setIsSaving(true);
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось сохранить изменения.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createWorkout() {
    const validation = validateWorkoutDate(date);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    await runMutation(async () => {
      const created = await workoutRepository.create(validation.value, now());
      await refresh(created.id);
    });
  }

  async function openWorkout(id: string) {
    setError(null);
    setSelected(await workoutRepository.get(id));
  }

  async function addExercise(exerciseId: string) {
    if (!selected) return;
    await runMutation(async () => {
      await workoutRepository.addExercise(selected.id, exerciseId, now());
      await refresh(selected.id);
    });
  }

  async function saveSet(workoutExerciseId: string) {
    const draft = setDrafts[workoutExerciseId] ?? EMPTY_SET;
    const validation = validateExerciseSet(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    if (!selected) return;

    await runMutation(async () => {
      if (editingSet?.workoutExerciseId === workoutExerciseId) {
        await workoutRepository.updateSet(
          editingSet.id,
          validation.value,
          now(),
        );
      } else {
        await workoutRepository.addSet(
          workoutExerciseId,
          validation.value,
          now(),
        );
      }
      setEditingSet(null);
      setSetDrafts((values) => ({
        ...values,
        [workoutExerciseId]: EMPTY_SET,
      }));
      await refresh(selected.id);
    });
  }

  function confirmDeleteSet(id: string) {
    if (!selected) return;
    Alert.alert('Удалить подход?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () =>
          void runMutation(async () => {
            await workoutRepository.deleteSet(id, now());
            await refresh(selected.id);
          }),
      },
    ]);
  }

  const addedExerciseIds = new Set(
    selected?.exercises.map((exercise) => exercise.exerciseId),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>GYMTRACKER</Text>
        <Text style={styles.title}>Тренировки</Text>

        <View style={styles.createRow}>
          <TextInput
            accessibilityLabel="Дата тренировки"
            keyboardType="numbers-and-punctuation"
            onChangeText={setDate}
            placeholder="ГГГГ-ММ-ДД"
            style={[styles.input, styles.dateInput]}
            value={date}
          />
          <Pressable
            disabled={isSaving}
            onPress={() => void createWorkout()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Создать</Text>
          </Pressable>
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        {workouts.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.workoutList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {workouts.map((workout) => (
              <Pressable
                key={workout.id}
                onPress={() => void openWorkout(workout.id)}
                style={[
                  styles.dateButton,
                  selected?.id === workout.id && styles.selectedDateButton,
                ]}
              >
                <Text
                  style={[
                    styles.dateButtonText,
                    selected?.id === workout.id &&
                      styles.selectedDateButtonText,
                  ]}
                >
                  {workout.date}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>Создай первую тренировку.</Text>
        )}

        {selected ? (
          <>
            <Text style={styles.sectionTitle}>Тренировка {selected.date}</Text>

            {selected.exercises.map((workoutExercise) => {
              const draft = setDrafts[workoutExercise.id] ?? EMPTY_SET;
              return (
                <View key={workoutExercise.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {workoutExercise.exerciseName}
                  </Text>
                  {workoutExercise.sets.length === 0 ? (
                    <Text style={styles.empty}>Подходов пока нет.</Text>
                  ) : (
                    workoutExercise.sets.map((set, index) => (
                      <View key={set.id} style={styles.setRow}>
                        <Pressable
                          onPress={() => {
                            setEditingSet({
                              id: set.id,
                              workoutExerciseId: workoutExercise.id,
                            });
                            setSetDrafts((values) => ({
                              ...values,
                              [workoutExercise.id]: {
                                weight: String(set.weight),
                                repetitions: String(set.repetitions),
                              },
                            }));
                          }}
                          style={styles.setSummary}
                        >
                          <Text style={styles.setText}>
                            {index + 1}. {set.weight} кг × {set.repetitions}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => confirmDeleteSet(set.id)}>
                          <Text style={styles.deleteText}>Удалить</Text>
                        </Pressable>
                      </View>
                    ))
                  )}

                  <View style={styles.setForm}>
                    <TextInput
                      accessibilityLabel={`Вес для ${workoutExercise.exerciseName}`}
                      keyboardType="decimal-pad"
                      onChangeText={(weight) =>
                        setSetDrafts((values) => ({
                          ...values,
                          [workoutExercise.id]: { ...draft, weight },
                        }))
                      }
                      placeholder="Вес, кг"
                      style={[styles.input, styles.setInput]}
                      value={draft.weight}
                    />
                    <TextInput
                      accessibilityLabel={`Повторения для ${workoutExercise.exerciseName}`}
                      keyboardType="number-pad"
                      onChangeText={(repetitions) =>
                        setSetDrafts((values) => ({
                          ...values,
                          [workoutExercise.id]: { ...draft, repetitions },
                        }))
                      }
                      placeholder="Повторы"
                      style={[styles.input, styles.setInput]}
                      value={draft.repetitions}
                    />
                    <Pressable
                      onPress={() => void saveSet(workoutExercise.id)}
                      style={styles.smallButton}
                    >
                      <Text style={styles.primaryButtonText}>
                        {editingSet?.workoutExerciseId === workoutExercise.id
                          ? 'Сохранить'
                          : 'Добавить'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>Добавить упражнение</Text>
            {activeExercises.filter(
              (exercise) => !addedExerciseIds.has(exercise.id),
            ).length === 0 ? (
              <Text style={styles.empty}>
                Нет доступных упражнений. Добавь их в разделе «Упражнения».
              </Text>
            ) : (
              activeExercises
                .filter((exercise) => !addedExerciseIds.has(exercise.id))
                .map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => void addExercise(exercise.id)}
                    style={styles.exerciseButton}
                  >
                    <Text style={styles.exerciseButtonText}>
                      {exercise.name}
                    </Text>
                    <Text style={styles.addText}>Добавить</Text>
                  </Pressable>
                ))
            )}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 24, paddingTop: 56 },
  eyebrow: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: { color: '#111827', fontSize: 34, fontWeight: '700', marginTop: 8 },
  createRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderRadius: 10,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dateInput: { flex: 1 },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  smallButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 14, marginTop: 12 },
  workoutList: { gap: 8, paddingVertical: 18 },
  dateButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectedDateButton: { backgroundColor: '#111827' },
  dateButtonText: { color: '#374151', fontWeight: '600' },
  selectedDateButtonText: { color: '#ffffff' },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 22,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
  },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '700' },
  empty: { color: '#6b7280', fontSize: 15, marginTop: 12 },
  setRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12 },
  setSummary: { flex: 1 },
  setText: { color: '#111827', fontSize: 16 },
  deleteText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  setForm: { flexDirection: 'row', gap: 8, marginTop: 14 },
  setInput: { flex: 1, minWidth: 0 },
  exerciseButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 14,
  },
  exerciseButtonText: { color: '#111827', fontSize: 16, fontWeight: '600' },
  addText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
