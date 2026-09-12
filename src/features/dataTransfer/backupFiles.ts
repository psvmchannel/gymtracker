import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export async function exportBackupFile(json: string, date: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Системное меню экспорта недоступно.');
  }
  const file = new File(Paths.cache, `gymtracker-backup-${date}.json`);
  file.create({ overwrite: true });
  file.write(json);
  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Экспорт данных GymTracker',
    mimeType: 'application/json',
    UTI: 'public.json',
  });
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('Файл не выбран.');
  if (asset.size && asset.size > MAX_BACKUP_BYTES) {
    throw new Error('Файл резервной копии слишком большой.');
  }
  return new File(asset.uri).text();
}
