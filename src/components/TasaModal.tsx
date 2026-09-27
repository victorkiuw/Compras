import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatFechaHora, formatNumero, formatTasa, parseMonto } from '../lib/format';
import { useCompraStore } from '../store/useCompraStore';
import { Boton, colores, estilos, Segmentado } from './ui';

/** Diálogo de la tasa del día: automática (oficial BCV o paralelo) o escrita a mano. */
export function TasaModal({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  // Se monta al abrir para que el campo manual arranque vacío (mostrando la tasa actual).
  if (!visible) return null;
  return <DialogoTasa onCerrar={onCerrar} />;
}

function DialogoTasa({ onCerrar }: { onCerrar: () => void }) {
  const { tasaBs, tasaFecha, tasaOrigen, tasaFuente, tasaTipo, actualizandoTasa, tasaSinConexion, setTasa, actualizarTasa, setTasaTipo } =
    useCompraStore();
  // null = mostrar la tasa actual (se refresca sola si llega una automática).
  const [editado, setTexto] = useState<string | null>(null);
  const texto = editado ?? (tasaBs ? formatNumero(tasaBs) : '');

  const tasaManual = parseMonto(texto);
  const cambiada = !!tasaManual && tasaManual !== tasaBs;

  const guardarManual = () => {
    if (!tasaManual || tasaManual <= 0) return;
    setTasa(tasaManual);
    onCerrar();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={s.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={[estilos.tarjeta, s.caja]}>
          <Text style={s.titulo}>Tasa del día</Text>

          <View style={s.estado}>
            <Text style={s.tasaGrande}>{formatTasa(tasaBs)}</Text>
            <Text style={s.texto}>
              {tasaFecha
                ? `${tasaOrigen === 'manual' ? 'Escrita a mano' : `Automática · ${tasaFuente ?? ''}`} · ${formatFechaHora(tasaFecha)}`
                : 'Aún no hay tasa guardada'}
            </Text>
            {tasaSinConexion && !actualizandoTasa && (
              <Text style={[s.texto, { color: colores.aviso }]}>No se pudo descargar (sin conexión). Se usa la última guardada.</Text>
            )}
          </View>

          <Text style={estilos.etiqueta}>Buscar automáticamente</Text>
          <Segmentado
            opciones={[
              { valor: 'oficial', etiqueta: 'Oficial BCV' },
              { valor: 'paralelo', etiqueta: 'Paralelo' },
            ]}
            valor={tasaTipo}
            onCambio={setTasaTipo}
          />
          <Boton
            titulo={actualizandoTasa ? 'Buscando…' : 'Actualizar ahora'}
            icono="refresh"
            variante="secundario"
            onPress={() => actualizarTasa(true)}
            deshabilitado={actualizandoTasa}
          />
          {actualizandoTasa && <ActivityIndicator color={colores.primario} />}

          <Text style={estilos.etiqueta}>O escríbela a mano</Text>
          <View style={s.fila}>
            <Text style={s.prefijo}>1 $ =</Text>
            <TextInput
              style={[estilos.input, { flex: 1, fontSize: 20, fontWeight: '600' }]}
              value={texto}
              onChangeText={setTexto}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colores.borde}
              selectTextOnFocus
              onSubmitEditing={guardarManual}
            />
            <Text style={s.prefijo}>Bs.</Text>
          </View>
          <View style={s.fila}>
            <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} style={{ flex: 1 }} />
            <Boton titulo="Usar esta" onPress={guardarManual} deshabilitado={!cambiada} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  caja: { gap: 12, padding: 20 },
  titulo: { fontSize: 20, fontWeight: '700', color: colores.texto },
  estado: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: colores.acentoSuave },
  tasaGrande: { fontSize: 24, fontWeight: '800', color: colores.acento },
  texto: { fontSize: 14, color: colores.textoSuave, lineHeight: 20 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefijo: { fontSize: 18, fontWeight: '600', color: colores.textoSuave },
});
