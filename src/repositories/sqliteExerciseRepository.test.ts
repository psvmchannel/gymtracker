import { describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DuplicateExerciseNameError } from './exerciseRepository';
import { SQLiteExerciseRepository } from './sqliteExerciseRepository';

function databaseWithGetFirstResults(...results: unknown[]): SQLiteDatabase {
  return {
    getFirstAsync: jest
      .fn<SQLiteDatabase['getFirstAsync']>()
      .mockImplementation(async () => results.shift() as never),
  } as unknown as SQLiteDatabase;
}

describe('SQLiteExerciseRepository', () => {
  it('запрещает дубликат русского имени без учёта регистра', async () => {
    const db = databaseWithGetFirstResults({ id: 'existing' });
    const repository = new SQLiteExerciseRepository(db);

    await expect(
      repository.create(
        { name: 'ЖИМ ЛЁЖА', muscleGroup: 'chest' },
        new Date('2026-09-06T10:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(DuplicateExerciseNameError);
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.any(String),
      'жим лёжа',
      null,
      null,
    );
  });

  it('сохраняет переданную дату и возвращает созданное упражнение', async () => {
    const row = {
      id: 'exercise-1',
      name: 'Приседания',
      muscle_group: 'legs',
      is_archived: 0,
      created_at: '2026-09-06T10:00:00.000Z',
      updated_at: '2026-09-06T10:00:00.000Z',
    };
    const db = databaseWithGetFirstResults(null, row);
    const repository = new SQLiteExerciseRepository(db);

    await expect(
      repository.create(
        { name: 'Приседания', muscleGroup: 'legs' },
        new Date('2026-09-06T10:00:00.000Z'),
      ),
    ).resolves.toEqual({
      id: 'exercise-1',
      name: 'Приседания',
      muscleGroup: 'legs',
      isArchived: false,
      createdAt: '2026-09-06T10:00:00.000Z',
      updatedAt: '2026-09-06T10:00:00.000Z',
    });
    expect(db.getFirstAsync).toHaveBeenLastCalledWith(
      expect.any(String),
      'Приседания',
      'приседания',
      'legs',
      '2026-09-06T10:00:00.000Z',
      '2026-09-06T10:00:00.000Z',
    );
  });

  it('удаляет упражнение без истории окончательно', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ is_used: 0 })),
      runAsync: jest.fn(async () => ({ changes: 1 })),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteExerciseRepository(db).delete(
        'exercise-1',
        new Date('2026-09-07T10:00:00.000Z'),
      ),
    ).resolves.toBe('deleted');
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM exercises'),
      'exercise-1',
    );
  });

  it('архивирует упражнение, которое есть в истории', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ is_used: 1 })),
      runAsync: jest.fn(async () => ({ changes: 1 })),
    } as unknown as SQLiteDatabase;

    await expect(
      new SQLiteExerciseRepository(db).delete(
        'exercise-1',
        new Date('2026-09-07T10:00:00.000Z'),
      ),
    ).resolves.toBe('archived');
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET is_archived = 1'),
      '2026-09-07T10:00:00.000Z',
      'exercise-1',
    );
  });
});
