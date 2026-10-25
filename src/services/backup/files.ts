import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { ensure } from '../accounting/ledger';
import { parseBackup } from './validation';
export async function shareFile(content: string, extension: 'json' | 'csv') {
  ensure(
    await Sharing.isAvailableAsync(),
    'Thiết bị không hỗ trợ chia sẻ tệp.',
  );
  const file = new File(
    Paths.cache,
    `Moni-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
  );
  await file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: extension === 'json' ? 'application/json' : 'text/csv',
    dialogTitle: 'Lưu hoặc chia sẻ tệp Moni',
  });
}
export async function pickBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  ensure((asset.size ?? 0) <= 20 * 1024 * 1024, 'Bản sao lưu vượt quá 20 MB.');
  const file = new File(asset.uri);
  ensure((await file.size) <= 20 * 1024 * 1024, 'Bản sao lưu vượt quá 20 MB.');
  return parseBackup(await file.text());
}
