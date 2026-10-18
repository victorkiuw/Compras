import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Alert, Platform } from 'react-native';
import { conMismaHora } from './format';

/**
 * Abre el calendario del teléfono para elegir otro día. Devuelve la fecha ISO con la misma hora
 * que tenía (`actual`), o null si se canceló. No permite fechas futuras.
 */
export function elegirFecha(actual: string): Promise<string | null> {
  if (Platform.OS !== 'android') {
    Alert.alert('No disponible', 'Cambiar la fecha solo está disponible en Android por ahora.');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: new Date(actual),
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_e, dia) => resolve(conMismaHora(actual, dia)),
      onDismiss: () => resolve(null),
    });
  });
}
