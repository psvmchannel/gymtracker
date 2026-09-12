import type { BackupSnapshot } from '../domain/backup';

export class StorageNotEmptyError extends Error {
  constructor() {
    super('Импорт возможен только в пустое хранилище.');
    this.name = 'StorageNotEmptyError';
  }
}

export interface DataTransferRepository {
  exportSnapshot(now: Date): Promise<BackupSnapshot>;
  importSnapshot(snapshot: BackupSnapshot): Promise<void>;
  clearAll(): Promise<void>;
}
