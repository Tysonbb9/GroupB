import * as DocumentPicker from 'expo-document-picker';

/**
 * US-29: let the student choose a PDF from their device, and hand back its
 * bytes for extractSyllabusText. Resolves to null when they cancel.
 *
 * On the web the picker gives a File, which already is a Blob. On a phone it
 * gives a local file URI, and fetch can read that into a Blob.
 */
export async function pickPdf(): Promise<Blob | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset.file) return asset.file;

  const response = await fetch(asset.uri);
  return response.blob();
}