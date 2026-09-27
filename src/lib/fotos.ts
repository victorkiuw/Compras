import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

// Las fotos del picker quedan en caché y el sistema puede borrarlas:
// se copian a la carpeta de documentos de la app.
function guardarEnDocumentos(uriTemporal: string): string {
  if (Platform.OS === 'web') return uriTemporal;
  const carpeta = new Directory(Paths.document, 'facturas');
  if (!carpeta.exists) carpeta.create({ intermediates: true });
  const extension = uriTemporal.split('.').pop()?.split('?')[0] || 'jpg';
  const destino = new File(carpeta, `factura_${Date.now()}.${extension}`);
  new File(uriTemporal).copySync(destino);
  return destino.uri;
}

export async function obtenerFotoFactura(origen: 'camara' | 'galeria'): Promise<string | null> {
  const permiso =
    origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert('Permiso necesario', origen === 'camara' ? 'Activa el permiso de cámara en los ajustes del teléfono.' : 'Activa el permiso de fotos en los ajustes del teléfono.');
    return null;
  }
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5 };
  const resultado =
    origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (resultado.canceled || !resultado.assets?.length) return null;
  try {
    return guardarEnDocumentos(resultado.assets[0].uri);
  } catch {
    return resultado.assets[0].uri;
  }
}
