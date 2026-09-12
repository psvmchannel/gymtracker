import { IndexedDbRepository } from './indexedDbRepository';
import type { AppRepositories } from './createRepositories';

export async function createRepositories(): Promise<AppRepositories> {
  const repository = await IndexedDbRepository.open();
  return {
    exercises: repository,
    workouts: repository,
    dataTransfer: repository,
  };
}
