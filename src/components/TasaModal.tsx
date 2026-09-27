import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatNumero, parseMonto } from '../lib/format';
import { Boton, colores, estilos } from './ui';

/** Diálogo para fijar la tasa del día (Bs por dólar). */
export function TasaModal({
  visible,
  tasaActual,
  onGuardar,
  onCerrar,
}: {
  visible: boolean;
  tasaActual: number | null;
  onGuardar: (tasa: number) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (visible) setTexto(tasaActual ? formatNumero(tasaActual) : '');
  }, [visible, tasaActual]);

  const tasa = parseMonto(texto);
  const guardar = () => {
    if (!tasa || tasa <= 0) return;
    onGuardar(tasa);
    onCerrar();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={s.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={[estilos.tarjeta, s.caja]}>
          <Text style={s.titulo}>Tasa del día</Text>
          <Text style={s.texto}>¿Cuántos bolívares vale 1 dólar hoy? Se usa para convertir los precios que anotas en $ al monto que pagas en Bs.</Text>
          <View style={s.fila}>
            <Text style={s.prefijo}>1 $ =</Text>
            <TextInput
              style={[estilos.input, { flex: 1, fontSize: 22, fontWeight: '600' }]}
              value={texto}
              onChangeText={setTexto}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colores.borde}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={guardar}
            />
            <Text style={s.prefijo}>Bs.</Text>
          </View>
          <View style={s.fila}>
            <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} style={{ flex: 1 }} />
            <Boton titulo="Guardar" onPress={guardar} deshabilitado={!tasa} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  caja: { gap: 14, padding: 20 },
  titulo: { fontSize: 20, fontWeight: '700', color: colores.texto },
  texto: { fontSize: 15, color: colores.textoSuave, lineHeight: 21 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefijo: { fontSize: 18, fontWeight: '600', color: colores.textoSuave },
});
