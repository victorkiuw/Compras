import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as repo from '../db/repo';
import type { CambiosItem, SugerenciaProducto } from '../db/repo';
import { formatBs, formatCantidad, formatUsd, parseMonto } from '../lib/format';
import { UNIDADES_COMUNES } from '../lib/parser';
import { Boton, Chip, colores, estilos, Icono } from './ui';

const VISIBLES = 9;

export interface AccionExtra {
  titulo: string;
  icono: Parameters<typeof Icono>[0]['name'];
  peligro?: boolean;
  onPress: () => void;
}

/**
 * Hoja para editar un producto de la lista: nombre, cantidad, unidad y nota.
 * Se monta solo mientras está abierta (el padre la renderiza condicionalmente).
 */
export function EditorProducto({
  titulo,
  inicial,
  acciones = [],
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  inicial: CambiosItem;
  acciones?: AccionExtra[];
  onGuardar: (c: CambiosItem) => void;
  onCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState(inicial.nombre);
  const [cantidadTxt, setCantidadTxt] = useState(formatCantidad(inicial.cantidad));
  const [unidad, setUnidad] = useState<string | null>(inicial.unidad);
  const [nota, setNota] = useState(inicial.nota ?? '');
  const [todas, setTodas] = useState(inicial.unidad != null && UNIDADES_COMUNES.indexOf(inicial.unidad) >= VISIBLES);
  const [sugerencias, setSugerencias] = useState<SugerenciaProducto[]>([]);

  // Sugiere productos ya conocidos mientras se corrige el nombre.
  useEffect(() => {
    if (nombre.trim() === inicial.nombre.trim()) return;
    let vigente = true;
    const t = setTimeout(() => {
      repo.sugerirProductos(nombre, 4).then((r) => {
        if (vigente) setSugerencias(r.filter((p) => p.nombre.toLowerCase() !== nombre.trim().toLowerCase()));
      });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [nombre, inicial.nombre]);

  const cantidad = parseMonto(cantidadTxt);
  const paso = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setCantidadTxt(formatCantidad(Math.max(0, Math.round(((cantidad ?? 0) + delta) * 100) / 100)));
  };

  const elegirSugerencia = (p: SugerenciaProducto) => {
    setNombre(p.nombre);
    if (p.unidad && !unidad) setUnidad(p.unidad);
    setSugerencias([]);
  };

  const guardar = () => {
    if (!nombre.trim()) return;
    onGuardar({ nombre: nombre.trim(), cantidad: cantidad && cantidad > 0 ? cantidad : null, unidad, nota: nota.trim() || null });
  };

  const unidades = todas ? UNIDADES_COMUNES : UNIDADES_COMUNES.slice(0, VISIBLES);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.fondo} onPress={onCerrar} accessibilityLabel="Cerrar" />
        <View style={[s.hoja, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.asa} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            <Text style={s.titulo}>{titulo}</Text>

            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Producto</Text>
              <TextInput
                style={[estilos.input, { fontSize: 17 }]}
                value={nombre}
                onChangeText={(t) => {
                  setNombre(t);
                  if (t.trim().length < 2 || t.trim() === inicial.nombre.trim()) setSugerencias([]);
                }}
                placeholder="Nombre"
              />
              {sugerencias.map((p) => (
                <Pressable key={p.id} onPress={() => elegirSugerencia(p)} style={s.sugerencia}>
                  <Icono name="return-down-forward" size={16} color={colores.acento} />
                  <Text style={s.sugerenciaTexto} numberOfLines={1}>
                    {p.nombre}
                    {p.unidad ? ` · ${p.unidad}` : ''}
                    {p.precio_usd != null ? ` · ${formatUsd(p.precio_usd)}` : p.precio_bs != null ? ` · ${formatBs(p.precio_bs)}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Cantidad{unidad ? ` (${unidad})` : ''}</Text>
              <View style={s.fila}>
                <Pressable style={s.paso} onPress={() => paso(-1)} accessibilityLabel="Restar uno">
                  <Icono name="remove" size={26} />
                </Pressable>
                <TextInput
                  style={[estilos.input, s.inputCantidad]}
                  value={cantidadTxt}
                  onChangeText={setCantidadTxt}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colores.textoSuave}
                  selectTextOnFocus
                />
                <Pressable style={s.paso} onPress={() => paso(1)} accessibilityLabel="Sumar uno">
                  <Icono name="add" size={26} />
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Unidad</Text>
              <View style={s.chips}>
                {unidades.map((u) => (
                  <Chip key={u} texto={u} activo={unidad === u} onPress={() => setUnidad(unidad === u ? null : u)} />
                ))}
                {!todas && <Chip texto="Más…" activo={false} onPress={() => setTodas(true)} />}
                <Chip texto="Sin unidad" activo={unidad == null} onPress={() => setUnidad(null)} />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Nota (opcional)</Text>
              <TextInput
                style={[estilos.input, { fontSize: 16 }]}
                value={nota}
                onChangeText={setNota}
                placeholder="Ej. marca PAN, la más grande, sin sal…"
                placeholderTextColor={colores.textoSuave}
              />
            </View>

            {acciones.length > 0 && (
              <View style={{ gap: 4 }}>
                {acciones.map((a) => (
                  <Boton key={a.titulo} titulo={a.titulo} icono={a.icono} variante={a.peligro ? 'texto' : 'secundario'} onPress={a.onPress} />
                ))}
              </View>
            )}
          </ScrollView>
          <View style={[s.fila, { paddingTop: 10 }]}>
            <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} />
            <Boton titulo="Guardar" icono="checkmark" onPress={guardar} deshabilitado={!nombre.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: {
    backgroundColor: colores.fondo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '94%',
  },
  asa: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colores.borde, marginBottom: 10 },
  titulo: { fontSize: 22, fontWeight: '700', color: colores.texto },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paso: {
    width: 56,
    height: 52,
    borderRadius: 12,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCantidad: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '600' },
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colores.acentoSuave,
  },
  sugerenciaTexto: { flex: 1, fontSize: 15, color: colores.acento },
});
