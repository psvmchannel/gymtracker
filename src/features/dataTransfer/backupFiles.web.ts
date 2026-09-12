import * as DocumentPicker from 'expo-document-picker';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export async function exportBackupFile(json: string, date: string) {
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `gymtracker-backup-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('Файл не выбран.');
  if (asset.size && asset.size > MAX_BACKUP_BYTES) {
    throw new Error('Файл резервной копии слишком большой.');
  }
  if (asset.file) return asset.file.text();
  return fetch(asset.uri).then((response) => response.text());
}
