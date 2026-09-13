import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  validateExerciseDraft,
  type Exercise,
  type ExerciseDraft,
  type MuscleGroup,
} from '../../domain/exercise';
import { confirmAction } from '../../platform/confirmAction';
import type { ExerciseRepository } from '../../repositories/exerciseRepository';

type Props = {
  repository: ExerciseRepository;
};

const EMPTY_DRAFT: ExerciseDraft = { name: '', muscleGroup: 'chest' };

export function ExerciseCatalog({ repository }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<ExerciseDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExercises = useCallback(async () => {
    try {
      setExercises(await repository.listActive());
      setError(null);
    } catch {
      setError('Не удалось загрузить упражнения.');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    let isCurrent = true;

    repository
      .listActive()
      .then((items) => {
        if (isCurrent) {
          setExercises(items);
          setError(null);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError('Не удалось загрузить упражнения.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [repository]);

  function startEditing(exercise: Exercise) {
    setEditingId(exercise.id);
    setDraft({ name: exercise.name, muscleGroup: exercise.muscleGroup });
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  async function saveExercise() {
    const validation = validateExerciseDraft(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await repository.update(editingId, validation.value, new Date());
      } else {
        await repository.create(validation.value, new Date());
      }
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      await loadExercises();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось сохранить упражнение.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDeleteExercise(exercise: Exercise) {
    confirmAction({
      title: 'Удалить упражнение?',
      message:
        'Если оно использовалось в тренировках, оно будет скрыто из каталога, но останется в истории.',
      confirmLabel: 'Удалить',
      onConfirm: () =>
        void (async () => {
          setIsSaving(true);
          setError(null);
          try {
            await repository.delete(exercise.id, new Date());
            if (editingId === exercise.id) cancelEditing();
            await loadExercises();
          } catch {
            setError('Не удалось удалить упражнение.');
          } finally {
            setIsSaving(false);
          }
        })(),
    });
  }

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
        <Text style={styles.title}>Упражнения</Text>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {editingId ? 'Редактировать упражнение' : 'Новое упражнение'}
          </Text>
          <Text style={styles.label}>Название</Text>
          <TextInput
            accessibilityLabel="Название упражнения"
            autoCapitalize="sentences"
            maxLength={100}
            onChangeText={(name) => setDraft((value) => ({ ...value, name }))}
            placeholder="Например, жим лёжа"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={draft.name}
          />

          <Text style={styles.label}>Мышечная группа</Text>
          <View style={styles.groupList}>
            {MUSCLE_GROUPS.map((group) => (
              <MuscleGroupButton
                group={group}
                isSelected={draft.muscleGroup === group}
                key={group}
                onPress={() =>
                  setDraft((value) => ({ ...value, muscleGroup: group }))
                }
              />
            ))}
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {editingId ? (
              <Pressable onPress={cancelEditing} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Отмена</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={isSaving}
              onPress={() => void saveExercise()}
              style={[styles.primaryButton, isSaving && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {isSaving ? 'Сохраняем…' : editingId ? 'Сохранить' : 'Добавить'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.listTitle}>Активные упражнения</Text>
        {isLoading ? (
          <ActivityIndicator color="#111827" />
        ) : exercises.length === 0 ? (
          <Text style={styles.emptyState}>Пока нет ни одного упражнения.</Text>
        ) : (
          exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseGroup}>
                  {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  disabled={isSaving}
                  onPress={() => startEditing(exercise)}
                >
                  <Text style={styles.editLabel}>Изменить</Text>
                </Pressable>
                <Pressable
                  disabled={isSaving}
                  onPress={() => confirmDeleteExercise(exercise)}
                >
                  <Text style={styles.deleteLabel}>Удалить</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MuscleGroupButton({
  group,
  isSelected,
  onPress,
}: {
  group: MuscleGroup;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.groupButton, isSelected && styles.selectedGroupButton]}
    >
      <Text
        style={[
          styles.groupButtonText,
          isSelected && styles.selectedGroupButtonText,
        ]}
      >
        {MUSCLE_GROUP_LABELS[group]}
      </Text>
    </Pressable>
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
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 24,
    padding: 16,
  },
  formTitle: { color: '#111827', fontSize: 20, fontWeight: '700' },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderColor: '#d1d5db',
    borderRadius: 10,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  groupList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedGroupButton: { backgroundColor: '#111827' },
  groupButtonText: { color: '#4b5563', fontSize: 14, fontWeight: '600' },
  selectedGroupButtonText: { color: '#ffffff' },
  error: { color: '#b91c1c', fontSize: 14, marginTop: 12 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    borderColor: '#d1d5db',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  listTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 28,
  },
  emptyState: { color: '#6b7280', fontSize: 16 },
  exerciseCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 16,
  },
  exerciseName: { color: '#111827', fontSize: 17, fontWeight: '700' },
  exerciseGroup: { color: '#6b7280', fontSize: 14, marginTop: 4 },
  editLabel: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  cardActions: { alignItems: 'flex-end', gap: 10 },
  deleteLabel: { color: '#b91c1c', fontSize: 14, fontWeight: '600' },
});
