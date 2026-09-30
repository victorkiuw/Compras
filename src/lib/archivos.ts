import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Guarda bytes en un archivo temporal y abre el menú de compartir (WhatsApp, Drive, correo…). */
export async function compartirArchivo(nombre: string, bytes: Uint8Array, mimeType: string, titulo: string) {
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos.');
  await Sharing.shareAsync(archivo.uri, { mimeType, dialogTitle: titulo, UTI: mimeType === MIME_XLSX ? 'org.openxmlformats.spreadsheetml.sheet' : undefined });
}

/** Deja elegir un archivo del teléfono y devuelve su contenido, o null si se canceló. */
export async function elegirArchivo(): Promise<{ nombre: string; bytes: Uint8Array } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  const asset = r.assets[0];
  return { nombre: asset.name, bytes: await new File(asset.uri).bytes() };
}

export const fechaArchivo = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
