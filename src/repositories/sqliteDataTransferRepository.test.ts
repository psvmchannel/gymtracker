import { describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { BACKUP_VERSION, type BackupSnapshot } from '../domain/backup';
import { StorageNotEmptyError } from './dataTransferRepository';
import { SQLiteDataTransferRepository } from './sqliteDataTransferRepository';

const emptySnapshot: BackupSnapshot = {
  version: BACKUP_VERSION,
  exportedAt: '2026-09-12T12:00:00.000Z',
  exercises: [],
  workouts: [],
  workoutExercises: [],
  exerciseSets: [],
};

describe('SQLiteDataTransferRepository', () => {
  it('очищает тренировки перед упражнениями в одной транзакции', async () => {
    const db = {
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (action: () => Promise<void>) =>
        action(),
      ),
    } as unknown as SQLiteDatabase;

    await new SQLiteDataTransferRepository(db).clearAll();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM workouts');
    expect(db.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM exercises');
  });

  it('запрещает импорт в непустое хранилище внутри транзакции', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ count: 1 })),
      withTransactionAsync: jest.fn(async (action: () => Promise<void>) =>
        action(),
      ),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteDataTransferRepository(db).importSnapshot(emptySnapshot),
    ).rejects.toBeInstanceOf(StorageNotEmptyError);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('применяет валидированный снимок одной транзакцией', async () => {
    const snapshot: BackupSnapshot = {
      ...emptySnapshot,
      exercises: [
        {
          id: 'exercise-1',
          name: 'Жим лёжа',
          muscleGroup: 'chest',
          isArchived: false,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
      ],
    };
    const db = {
      getFirstAsync: jest.fn(async () => ({ count: 0 })),
      runAsync: jest.fn(async () => ({ changes: 1 })),
      withTransactionAsync: jest.fn(async (action: () => Promise<void>) =>
        action(),
      ),
    } as unknown as SQLiteDatabase;

    await new SQLiteDataTransferRepository(db).importSnapshot(snapshot);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO exercises'),
      'exercise-1',
      'Жим лёжа',
      'жим лёжа',
      'chest',
      0,
      '2026-09-01T10:00:00.000Z',
      '2026-09-01T10:00:00.000Z',
    );
  });
});
