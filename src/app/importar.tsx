import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorProducto } from '../components/EditorProducto';
import { Boton, Chip, colores, estilos, Icono } from '../components/ui';
import * as repo from '../db/repo';
import type { Plantilla } from '../db/repo';
import { formatCantidad } from '../lib/format';
import { parseLista, type ItemParseado } from '../lib/parser';
import { useCompraStore } from '../store/useCompraStore';

/** Texto que llegó con "Compartir → Compras" desde WhatsApp u otra app (se consume una vez). */
function textoCompartido(): string {
  try {
    const texto = Sharing.getSharedPayloads()
      .filter((p) => p.shareType === 'text' || p.shareType === 'url')
      .map((p) => p.value)
      .join('\n')
      .trim();
    if (texto) Sharing.clearSharedPayloads();
    return texto;
  } catch {
    return '';
  }
}

const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function Importar() {
  const insets = useSafeAreaInsets();
  const { lista, items, importar } = useCompraStore();
  const [compartido] = useState(textoCompartido);
  const [texto, setTextoCrudo] = useState(compartido);
  const [descartados, setDescartados] = useState<Set<number>>(new Set());
  const [ediciones, setEdiciones] = useState<Map<number, ItemParseado>>(new Map());
  const [editando, setEditando] = useState<number | null>(null);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Al cambiar el texto se reinician descartes y ediciones (los índices ya no corresponden).
  const setTexto = (valor: string | ((actual: string) => string)) => {
    setTextoCrudo(valor);
    setDescartados(new Set());
    setEdiciones(new Map());
  };

  const parseados = useMemo(() => parseLista(texto), [texto]);
  const finales = parseados.map((p, i) => ediciones.get(i) ?? p);
  const seleccionados = finales.filter((_, i) => !descartados.has(i));

  useFocusEffect(
    useCallback(() => {
      repo.listarPlantillas().then(setPlantillas);
    }, []),
  );

  // Si no llegó nada compartido y el portapapeles tiene texto, se pega automáticamente.
  useEffect(() => {
    if (compartido) return;
    Clipboard.hasStringAsync()
      .then(async (hay) => {
        if (!hay) return;
        const contenido = await Clipboard.getStringAsync();
        if (contenido.trim()) setTextoCrudo((actual) => actual || contenido);
      })
      .catch(() => {});
  }, [compartido]);

  const pegar = async () => {
    const contenido = await Clipboard.getStringAsync();
    if (!contenido.trim()) return Alert.alert('Portapapeles vacío', 'Copia primero el mensaje en WhatsApp (mantén presionado → Copiar).');
    setTexto(contenido);
  };

  const alternar = (i: number) =>
    setDescartados((prev) => {
      const sig = new Set(prev);
      if (sig.has(i)) sig.delete(i);
      else sig.add(i);
      return sig;
    });

  const borrarPlantilla = (p: Plantilla) =>
    Alert.alert('Lista frecuente', `¿Eliminar «${p.nombre}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await repo.eliminarPlantilla(p.id);
          setPlantillas(await repo.listarPlantillas());
        },
      },
    ]);

  const crear = async (modo: 'nueva' | 'agregar') => {
    setGuardando(true);
    try {
      await importar(seleccionados, modo);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      volver();
    } catch (e) {
      setGuardando(false);
      Alert.alert('No se pudo importar', e instanceof Error ? e.message : String(e));
    }
  };

  const confirmar = () => {
    if (!seleccionados.length) return;
    if (!lista || items.length === 0) return crear(lista ? 'agregar' : 'nueva');
    Alert.alert('Ya hay una compra activa', `La compra actual tiene ${items.length} productos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Agregar a la compra actual', onPress: () => crear('agregar') },
      { text: 'Nueva compra (cierra la actual)', style: 'destructive', onPress: () => crear('nueva') },
    ]);
  };

  const enEdicion = editando != null ? finales[editando] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {compartido ? (
          <View style={s.aviso}>
            <Icono name="logo-whatsapp" size={18} color={colores.primario} />
            <Text style={s.avisoTexto}>Lista recibida desde otra app. Revísala y crea la lista.</Text>
          </View>
        ) : null}

        {plantillas.length > 0 && !texto && (
          <View style={{ gap: 6 }}>
            <Text style={estilos.etiqueta}>Listas frecuentes</Text>
            <View style={s.chips}>
              {plantillas.map((p) => (
                <Chip
                  key={p.id}
                  texto={p.nombre}
                  icono="bookmark-outline"
                  activo={false}
                  onPress={() => setTexto(p.texto)}
                  onLongPress={() => borrarPlantilla(p)}
                />
              ))}
            </View>
            <Text style={s.ayuda}>Mantén presionada una lista para eliminarla.</Text>
          </View>
        )}

        <View style={s.fila}>
          <Text style={[estilos.etiqueta, { flex: 1 }]}>Mensaje de WhatsApp</Text>
          <Boton titulo="Pegar" variante="secundario" icono="clipboard-outline" onPress={pegar} style={{ minHeight: 40 }} />
          {texto ? <Boton titulo="Borrar" variante="texto" onPress={() => setTexto('')} style={{ minHeight: 40 }} /> : null}
        </View>
        <TextInput
          style={[estilos.input, s.area]}
          multiline
          value={texto}
          onChangeText={setTexto}
          placeholder={'Ejemplo:\n- 2 kg de harina\n- Queso blanco 1 kg\n- 3 cajas de leche\n- Servilletas'}
          placeholderTextColor={colores.textoSuave}
          textAlignVertical="top"
        />
        <Text style={s.ayuda}>Consejo: en WhatsApp mantén presionado el mensaje → Compartir → Compras, y llega directo aquí.</Text>

        {parseados.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={estilos.etiqueta}>
              {seleccionados.length} de {parseados.length} productos · toca para corregir
            </Text>
            {finales.map((p, i) => {
              const fuera = descartados.has(i);
              return (
                <Pressable
                  key={`${i}-${p.original}`}
                  onPress={() => (fuera ? alternar(i) : setEditando(i))}
                  style={[estilos.tarjeta, s.item, fuera && { opacity: 0.4 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nombre, fuera && { textDecorationLine: 'line-through' }]}>{p.nombre}</Text>
                    {p.nota ? <Text style={s.nota}>📝 {p.nota}</Text> : null}
                  </View>
                  {p.cantidad != null || p.unidad ? (
                    <Text style={s.cantidad}>
                      {p.cantidad != null ? formatCantidad(p.cantidad) : ''}
                      {p.unidad ? ` ${p.unidad}` : ''}
                    </Text>
                  ) : (
                    <Text style={s.sinUnidad}>sin unidad</Text>
                  )}
                  <Pressable onPress={() => alternar(i)} hitSlop={10} accessibilityLabel={fuera ? 'Volver a incluir' : 'Descartar'}>
                    <Icono name={fuera ? 'add-circle-outline' : 'close-circle-outline'} color={fuera ? colores.primario : colores.textoSuave} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[s.pie, { paddingBottom: insets.bottom + 12 }]}>
        <Boton
          titulo={seleccionados.length ? `Crear lista con ${seleccionados.length} productos` : 'Pega un mensaje para empezar'}
          icono="list-outline"
          onPress={confirmar}
          deshabilitado={!seleccionados.length || guardando}
        />
      </View>

      {enEdicion && editando != null && (
        <EditorProducto
          titulo="Corregir producto"
          inicial={{ nombre: enEdicion.nombre, cantidad: enEdicion.cantidad, unidad: enEdicion.unidad, nota: enEdicion.nota ?? null }}
          onGuardar={(c) => {
            setEdiciones((prev) => new Map(prev).set(editando, { ...enEdicion, ...c }));
            setEditando(null);
          }}
          onCerrar={() => setEditando(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  area: { minHeight: 140, maxHeight: 240, fontSize: 16, paddingTop: 12, paddingBottom: 12 },
  ayuda: { fontSize: 13, color: colores.textoSuave },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colores.primarioSuave },
  avisoTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: colores.primario },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  nombre: { fontSize: 16, color: colores.texto, fontWeight: '500' },
  nota: { fontSize: 13, color: colores.textoSuave, fontStyle: 'italic' },
  cantidad: { fontSize: 15, fontWeight: '700', color: colores.texto },
  sinUnidad: { fontSize: 13, color: colores.aviso, fontWeight: '600' },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colores.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
});
