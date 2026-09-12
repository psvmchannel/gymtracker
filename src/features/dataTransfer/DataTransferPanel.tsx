import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { parseBackupJson } from '../../domain/backup';
import type { DataTransferRepository } from '../../repositories/dataTransferRepository';
import { exportBackupFile, pickBackupFile } from './backupFiles';

type Props = {
  repository: DataTransferRepository;
  onImported: () => void;
};

export function DataTransferPanel({ repository, onImported }: Props) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setIsBusy(true);
    setError(null);
    try {
      const snapshot = await repository.exportSnapshot(new Date());
      const date = snapshot.exportedAt.slice(0, 10);
      await exportBackupFile(JSON.stringify(snapshot, null, 2), date);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось экспортировать данные.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function chooseImport() {
    setIsBusy(true);
    setError(null);
    try {
      const json = await pickBackupFile();
      if (json === null) return;
      const validation = parseBackupJson(json);
      if (!validation.ok) throw new Error(validation.message);

      Alert.alert(
        'Импортировать резервную копию?',
        'Импорт сработает только в пустом хранилище. Все записи из файла будут добавлены одной операцией.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Импортировать',
            onPress: () =>
              void importValidated(validation.value).finally(() =>
                setIsBusy(false),
              ),
          },
        ],
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось прочитать резервную копию.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function importValidated(
    snapshot: Parameters<DataTransferRepository['importSnapshot']>[0],
  ) {
    setIsBusy(true);
    setError(null);
    try {
      await repository.importSnapshot(snapshot);
      onImported();
      Alert.alert('Готово', 'Данные успешно импортированы.');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось импортировать данные.',
      );
    }
  }

  function confirmClear() {
    Alert.alert(
      'Очистить все данные?',
      'Все упражнения, тренировки и подходы будут удалены без возможности отмены. Сначала сохрани резервную копию.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setIsBusy(true);
              setError(null);
              try {
                await repository.clearAll();
                onImported();
                Alert.alert('Готово', 'Локальное хранилище очищено.');
              } catch {
                setError('Не удалось очистить локальное хранилище.');
              } finally {
                setIsBusy(false);
              }
            })(),
        },
      ],
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Резервная копия</Text>
      <Text style={styles.description}>
        Экспортируй все локальные данные в JSON. Импорт доступен только в пустое
        хранилище и никогда не объединяет записи.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          disabled={isBusy}
          onPress={() => void exportData()}
          style={[styles.primaryButton, isBusy && styles.disabled]}
        >
          <Text style={styles.primaryText}>Экспортировать</Text>
        </Pressable>
        <Pressable
          disabled={isBusy}
          onPress={() => void chooseImport()}
          style={[styles.secondaryButton, isBusy && styles.disabled]}
        >
          <Text style={styles.secondaryText}>Импортировать</Text>
        </Pressable>
        <Pressable
          disabled={isBusy}
          onPress={confirmClear}
          style={[styles.dangerButton, isBusy && styles.disabled]}
        >
          <Text style={styles.dangerText}>Очистить данные</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 24,
    padding: 16,
  },
  title: { color: '#111827', fontSize: 20, fontWeight: '700' },
  description: { color: '#6b7280', fontSize: 14, lineHeight: 20, marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 14, marginTop: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    borderColor: '#d1d5db',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  dangerButton: {
    borderColor: '#fecaca',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dangerText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
});
