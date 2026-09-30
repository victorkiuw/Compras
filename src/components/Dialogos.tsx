import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, colores, estilos, Icono, type NombreIcono } from './ui';

export interface Opcion {
  titulo: string;
  icono: NombreIcono;
  peligro?: boolean;
  onPress: () => void;
}

/** Menú inferior de opciones (Android limita Alert a 3 botones). Montarlo solo cuando está abierto. */
export function MenuOpciones({ titulo, opciones, onCerrar }: { titulo?: string; opciones: Opcion[]; onCerrar: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <Pressable style={s.fondo} onPress={onCerrar} accessibilityLabel="Cerrar" />
      <View style={[s.hoja, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.asa} />
        {titulo && <Text style={s.titulo}>{titulo}</Text>}
        {opciones.map((o) => (
          <Pressable
            key={o.titulo}
            onPress={() => {
              onCerrar();
              o.onPress();
            }}
            style={({ pressed }) => [s.opcion, pressed && { backgroundColor: colores.fondo }]}
          >
            <Icono name={o.icono} color={o.peligro ? colores.peligro : colores.texto} />
            <Text style={[s.opcionTexto, o.peligro && { color: colores.peligro }]}>{o.titulo}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

/** Pide un texto corto (Alert.prompt solo existe en iOS). Montarlo solo cuando está abierto. */
export function PedirTexto({
  titulo,
  mensaje,
  placeholder,
  inicial = '',
  confirmar = 'Guardar',
  onAceptar,
  onCerrar,
}: {
  titulo: string;
  mensaje?: string;
  placeholder?: string;
  inicial?: string;
  confirmar?: string;
  onAceptar: (texto: string) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const aceptar = () => {
    if (!texto.trim()) return;
    onAceptar(texto.trim());
    onCerrar();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={s.centro} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={[estilos.tarjeta, { gap: 12, padding: 20 }]}>
          <Text style={s.titulo}>{titulo}</Text>
          {mensaje && <Text style={s.mensaje}>{mensaje}</Text>}
          <TextInput
            style={[estilos.input, { fontSize: 17 }]}
            value={texto}
            onChangeText={setTexto}
            placeholder={placeholder}
            placeholderTextColor={colores.textoSuave}
            autoFocus
            onSubmitEditing={aceptar}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} style={{ flex: 1 }} />
            <Boton titulo={confirmar} onPress={aceptar} deshabilitado={!texto.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  centro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  hoja: { backgroundColor: colores.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 8, paddingTop: 8 },
  asa: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colores.borde, marginBottom: 6 },
  titulo: { fontSize: 18, fontWeight: '700', color: colores.texto, paddingHorizontal: 12, paddingVertical: 6 },
  mensaje: { fontSize: 15, color: colores.textoSuave, lineHeight: 21 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 14, borderRadius: 12 },
  opcionTexto: { fontSize: 17, color: colores.texto, fontWeight: '500' },
});
