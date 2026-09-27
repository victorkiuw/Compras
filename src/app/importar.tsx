import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, colores, estilos, Icono } from '../components/ui';
import { formatCantidad } from '../lib/format';
import { parseLista } from '../lib/parser';
import { useCompraStore } from '../store/useCompraStore';

export default function Importar() {
  const insets = useSafeAreaInsets();
  const { lista, items, importar } = useCompraStore();
  const [texto, setTexto] = useState('');
  const [descartados, setDescartados] = useState<Set<number>>(new Set());
  const [guardando, setGuardando] = useState(false);

  const parseados = useMemo(() => parseLista(texto), [texto]);
  const seleccionados = parseados.filter((_, i) => !descartados.has(i));

  useEffect(() => setDescartados(new Set()), [texto]);

  // Si el portapapeles tiene texto al abrir, se pega automáticamente.
  useEffect(() => {
    Clipboard.hasStringAsync()
      .then(async (hay) => {
        if (!hay) return;
        const contenido = await Clipboard.getStringAsync();
        if (contenido.trim()) setTexto((actual) => actual || contenido);
      })
      .catch(() => {});
  }, []);

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

  const crear = async (modo: 'nueva' | 'agregar') => {
    setGuardando(true);
    try {
      await importar(seleccionados, modo);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
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

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
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

        {parseados.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={estilos.etiqueta}>
              {seleccionados.length} de {parseados.length} productos · toca para descartar
            </Text>
            {parseados.map((p, i) => {
              const fuera = descartados.has(i);
              return (
                <Pressable key={`${i}-${p.original}`} onPress={() => alternar(i)} style={[estilos.tarjeta, s.item, fuera && { opacity: 0.4 }]}>
                  <Icono name={fuera ? 'close-circle-outline' : 'checkbox-outline'} color={fuera ? colores.textoSuave : colores.primario} />
                  <Text style={[s.nombre, fuera && { textDecorationLine: 'line-through' }]}>{p.nombre}</Text>
                  {p.cantidad != null && (
                    <Text style={s.cantidad}>
                      {formatCantidad(p.cantidad)}
                      {p.unidad ? ` ${p.unidad}` : ''}
                    </Text>
                  )}
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
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  area: { minHeight: 160, maxHeight: 260, fontSize: 16, paddingTop: 12, paddingBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  nombre: { flex: 1, fontSize: 16, color: colores.texto, fontWeight: '500' },
  cantidad: { fontSize: 15, fontWeight: '700', color: colores.texto },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colores.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
});
