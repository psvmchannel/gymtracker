import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  type GestureResponderHandlers,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MUSCLE_GROUP_LABELS, type Exercise } from '../../domain/exercise';
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
import { confirmAction } from '../../platform/confirmAction';

type Props = {
  exerciseRepository: ExerciseRepository;
  workoutRepository: WorkoutRepository;
  now?: () => Date;
};

const EMPTY_SET: ExerciseSetDraft = { weight: '', repetitions: '' };

type ExerciseLayout = { height: number; y: number };
type DragPreview = { id: string; targetIndex: number };

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
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [exerciseLayouts, setExerciseLayouts] = useState<
    Record<string, ExerciseLayout>
  >({});

  const refresh = useCallback(
    async (selectedId?: string | null) => {
      const [nextWorkouts, nextExercises] = await Promise.all([
        workoutRepository.list(),
        exerciseRepository.listActive(),
      ]);
      setWorkouts(nextWorkouts);
      setActiveExercises(nextExercises);

      const id = selectedId === undefined ? selected?.id : selectedId;
      setSelected(id ? await workoutRepository.get(id) : null);
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

  async function cloneWorkout() {
    if (!selected) return;
    const validation = validateWorkoutDate(date);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    await runMutation(async () => {
      const clone = await workoutRepository.clone(
        selected.id,
        validation.value,
        now(),
      );
      await refresh(clone.id);
    });
  }

  function confirmDeleteWorkout() {
    if (!selected) return;
    confirmAction({
      title: 'Удалить тренировку?',
      message: `Тренировка за ${selected.date} и все её подходы будут удалены.`,
      confirmLabel: 'Удалить',
      onConfirm: () =>
        void runMutation(async () => {
          await workoutRepository.delete(selected.id);
          await refresh(null);
        }),
    });
  }

  async function openWorkout(id: string) {
    setError(null);
    try {
      setSelected(await workoutRepository.get(id));
    } catch {
      setError('Не удалось открыть тренировку.');
    }
  }

  async function addExercise(exerciseId: string) {
    if (!selected) return;
    await runMutation(async () => {
      await workoutRepository.addExercise(selected.id, exerciseId, now());
      await refresh(selected.id);
    });
  }

  function moveExercise(workoutExerciseId: string, targetIndex: number) {
    if (!selected || isSaving) return;
    const sourceIndex = selected.exercises.findIndex(
      ({ id }) => id === workoutExerciseId,
    );
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;

    const exercises = [...selected.exercises];
    const [moved] = exercises.splice(sourceIndex, 1);
    if (!moved) return;
    exercises.splice(targetIndex, 0, moved);
    const reordered = exercises.map((exercise, position) => ({
      ...exercise,
      position,
    }));
    const workoutId = selected.id;
    setSelected({ ...selected, exercises: reordered });
    void runMutation(async () => {
      try {
        await workoutRepository.reorderExercises(
          workoutId,
          reordered.map(({ id }) => id),
          now(),
        );
      } finally {
        await refresh(workoutId);
      }
    });
  }

  function getExerciseDragTarget(workoutExerciseId: string, offsetY: number) {
    if (!selected) return;
    const source = exerciseLayouts[workoutExerciseId];
    if (!source) return;
    const draggedCenter = source.y + source.height / 2 + offsetY;
    let targetIndex = selected.exercises.findIndex(
      ({ id }) => id === workoutExerciseId,
    );
    let closestDistance = Number.POSITIVE_INFINITY;

    selected.exercises.forEach((exercise, index) => {
      const layout = exerciseLayouts[exercise.id];
      if (!layout) return;
      const distance = Math.abs(draggedCenter - (layout.y + layout.height / 2));
      if (distance < closestDistance) {
        closestDistance = distance;
        targetIndex = index;
      }
    });
    return targetIndex;
  }

  function previewExerciseDrag(workoutExerciseId: string, offsetY: number) {
    const targetIndex = getExerciseDragTarget(workoutExerciseId, offsetY);
    if (targetIndex === undefined) return;
    setDragPreview((current) =>
      current?.id === workoutExerciseId && current.targetIndex === targetIndex
        ? current
        : { id: workoutExerciseId, targetIndex },
    );
  }

  function finishExerciseDrag(workoutExerciseId: string, offsetY: number) {
    const targetIndex = getExerciseDragTarget(workoutExerciseId, offsetY);
    setDragPreview(null);
    if (targetIndex !== undefined) {
      moveExercise(workoutExerciseId, targetIndex);
    }
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
    confirmAction({
      title: 'Удалить подход?',
      message: 'Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      onConfirm: () =>
        void runMutation(async () => {
          await workoutRepository.deleteSet(id, now());
          await refresh(selected.id);
        }),
    });
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
        scrollEnabled={!dragPreview}
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
            <View style={styles.workoutHeader}>
              <Text style={styles.sectionTitle}>
                Тренировка {selected.date}
              </Text>
              <View style={styles.workoutActions}>
                <Pressable
                  disabled={isSaving}
                  onPress={() => void cloneWorkout()}
                >
                  <Text style={styles.cloneText}>Клонировать на дату выше</Text>
                </Pressable>
                <Pressable disabled={isSaving} onPress={confirmDeleteWorkout}>
                  <Text style={styles.deleteText}>Удалить тренировку</Text>
                </Pressable>
              </View>
            </View>

            {selected.exercises.map((workoutExercise) => {
              const draft = setDrafts[workoutExercise.id] ?? EMPTY_SET;
              const sourceIndex = dragPreview
                ? selected.exercises.findIndex(
                    ({ id }) => id === dragPreview.id,
                  )
                : -1;
              const currentIndex = selected.exercises.findIndex(
                ({ id }) => id === workoutExercise.id,
              );
              const draggedLayout = dragPreview
                ? exerciseLayouts[dragPreview.id]
                : undefined;
              const displacedOffset = draggedLayout
                ? sourceIndex < dragPreview!.targetIndex &&
                  currentIndex > sourceIndex &&
                  currentIndex <= dragPreview!.targetIndex
                  ? -(draggedLayout.height + 12)
                  : sourceIndex > dragPreview!.targetIndex &&
                      currentIndex >= dragPreview!.targetIndex &&
                      currentIndex < sourceIndex
                    ? draggedLayout.height + 12
                    : 0
                : 0;
              return (
                <DraggableExerciseCard
                  disabled={isSaving}
                  exerciseName={workoutExercise.exerciseName}
                  isDragging={dragPreview?.id === workoutExercise.id}
                  key={workoutExercise.id}
                  onDragCancel={() => setDragPreview(null)}
                  onDragEnd={(offsetY) =>
                    finishExerciseDrag(workoutExercise.id, offsetY)
                  }
                  onDragMove={(offsetY) =>
                    previewExerciseDrag(workoutExercise.id, offsetY)
                  }
                  onDragStart={() =>
                    setDragPreview({
                      id: workoutExercise.id,
                      targetIndex: currentIndex,
                    })
                  }
                  onLayout={(event) => {
                    const { height, y } = event.nativeEvent.layout;
                    setExerciseLayouts((current) => {
                      const previous = current[workoutExercise.id];
                      return previous?.height === height && previous.y === y
                        ? current
                        : {
                            ...current,
                            [workoutExercise.id]: { height, y },
                          };
                    });
                  }}
                  previewOffset={displacedOffset}
                >
                  <Text style={styles.cardTitle}>
                    {workoutExercise.exerciseName}
                  </Text>
                  {workoutExercise.sets.length === 0 ? (
                    <Text style={styles.empty}>Подходов пока нет.</Text>
                  ) : (
                    workoutExercise.sets.map((set, index) => (
                      <View key={set.id} style={styles.setRow}>
                        <Pressable
                          disabled={isSaving}
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
                        <Pressable
                          accessibilityLabel={`Удалить подход ${index + 1} упражнения «${workoutExercise.exerciseName}»`}
                          accessibilityRole="button"
                          disabled={isSaving}
                          hitSlop={8}
                          onPress={() => confirmDeleteSet(set.id)}
                          style={({ pressed }) => [
                            styles.deleteSetButton,
                            pressed && styles.pressedIconButton,
                          ]}
                        >
                          <Text style={styles.deleteSetIcon}>×</Text>
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
                      disabled={isSaving}
                      onPress={() => void saveSet(workoutExercise.id)}
                      style={[
                        styles.smallButton,
                        isSaving && styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {editingSet?.workoutExerciseId === workoutExercise.id
                          ? 'Сохранить'
                          : 'Добавить'}
                      </Text>
                    </Pressable>
                  </View>
                </DraggableExerciseCard>
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
                    disabled={isSaving}
                    key={exercise.id}
                    onPress={() => void addExercise(exercise.id)}
                    style={[
                      styles.exerciseButton,
                      isSaving && styles.disabledButton,
                    ]}
                  >
                    <View style={styles.exerciseButtonDetails}>
                      <Text style={styles.exerciseButtonText}>
                        {exercise.name}
                      </Text>
                      <Text style={styles.exerciseButtonGroup}>
                        {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                      </Text>
                    </View>
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

function DraggableExerciseCard({
  children,
  disabled,
  exerciseName,
  isDragging,
  onDragCancel,
  onDragEnd,
  onDragMove,
  onDragStart,
  onLayout,
  previewOffset,
}: {
  children: ReactNode;
  disabled: boolean;
  exerciseName: string;
  isDragging: boolean;
  onDragCancel: () => void;
  onDragEnd: (offsetY: number) => void;
  onDragMove: (offsetY: number) => void;
  onDragStart: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  previewOffset: number;
}) {
  const [translateY] = useState(() => new Animated.Value(0));
  const dragCallbacks = useRef({
    disabled,
    onDragCancel,
    onDragEnd,
    onDragMove,
    onDragStart,
  });
  useEffect(() => {
    dragCallbacks.current = {
      disabled,
      onDragCancel,
      onDragEnd,
      onDragMove,
      onDragStart,
    };
  }, [disabled, onDragCancel, onDragEnd, onDragMove, onDragStart]);
  // Responder callbacks read current props only after a gesture event.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !dragCallbacks.current.disabled,
      onStartShouldSetPanResponderCapture: () =>
        !dragCallbacks.current.disabled,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !dragCallbacks.current.disabled && Math.abs(gesture.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        !dragCallbacks.current.disabled && Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => dragCallbacks.current.onDragStart(),
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(gesture.dy);
        dragCallbacks.current.onDragMove(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        translateY.setValue(0);
        dragCallbacks.current.onDragEnd(gesture.dy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        translateY.setValue(0);
        dragCallbacks.current.onDragCancel();
      },
      onShouldBlockNativeResponder: () => true,
    }),
  );

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.card,
        isDragging && styles.draggingCard,
        {
          transform: [{ translateY }, { translateY: previewOffset }],
        },
      ]}
    >
      {children}
      <DragHandle
        exerciseName={exerciseName}
        panHandlers={panResponder.panHandlers}
      />
    </Animated.View>
  );
}

function DragHandle({
  exerciseName,
  panHandlers,
}: {
  exerciseName: string;
  panHandlers: GestureResponderHandlers;
}) {
  return (
    <View
      {...panHandlers}
      accessibilityHint="Перетащите вверх или вниз"
      accessibilityLabel={`Изменить порядок упражнения «${exerciseName}»`}
      accessibilityRole="button"
      style={styles.dragHandle}
    >
      <Text style={styles.dragHandleText}>≡</Text>
    </View>
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
  disabledButton: { opacity: 0.55 },
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
  workoutHeader: { marginTop: 22 },
  workoutActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 4,
  },
  cloneText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
  },
  draggingCard: { elevation: 8, zIndex: 2 },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    paddingRight: 44,
  },
  dragHandle: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 44,
    zIndex: 1,
  },
  dragHandleText: { color: '#6b7280', fontSize: 28, lineHeight: 30 },
  empty: { color: '#6b7280', fontSize: 15, marginTop: 12 },
  setRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12 },
  setSummary: { flex: 1 },
  setText: { color: '#111827', fontSize: 16 },
  deleteText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  deleteSetButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressedIconButton: { backgroundColor: '#f3f4f6' },
  deleteSetIcon: { color: '#b91c1c', fontSize: 28, lineHeight: 30 },
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
  exerciseButtonDetails: { flex: 1, minWidth: 0 },
  exerciseButtonText: { color: '#111827', fontSize: 16, fontWeight: '600' },
  exerciseButtonGroup: { color: '#6b7280', fontSize: 13, marginTop: 3 },
  addText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
});
