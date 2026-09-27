import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colores, estilos, Icono, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { ProductoRadar, RegistroHistorico } from '../../db/repo';
import { formatBs, formatFecha, formatNumero, haceCuanto } from '../../lib/format';

export default function Radar() {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ProductoRadar[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const busquedaRef = useRef(busqueda);
  busquedaRef.current = busqueda;

  const buscar = useCallback(async (texto: string) => {
    setResultados(await repo.buscarPrecios(texto));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscar(busqueda), 200);
    return () => clearTimeout(t);
  }, [busqueda, buscar]);

  // Al volver a la pestaña se refresca por si hubo compras nuevas.
  useFocusEffect(
    useCallback(() => {
      buscar(busquedaRef.current);
    }, [buscar]),
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.buscador}>
        <Icono name="search" color={colores.textoSuave} />
        <TextInput
          style={s.buscadorInput}
          placeholder="Buscar producto (harina, queso…)"
          placeholderTextColor={colores.textoSuave}
          value={busqueda}
          onChangeText={setBusqueda}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={resultados}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TarjetaProducto producto={item} abierto={abierto === item.id} onAlternar={() => setAbierto(abierto === item.id ? null : item.id)} />
        )}
        ListEmptyComponent={
          <Vacio
            icono="pricetags-outline"
            titulo={busqueda ? 'Sin resultados' : 'Todavía no hay precios'}
            texto={busqueda ? 'No hay precios registrados para esa búsqueda.' : 'Los precios se guardan solos cada vez que marcas un producto como comprado.'}
          />
        }
      />
    </View>
  );
}

function TarjetaProducto({ producto, abierto, onAlternar }: { producto: ProductoRadar; abierto: boolean; onAlternar: () => void }) {
  const [historial, setHistorial] = useState<RegistroHistorico[]>([]);

  useEffect(() => {
    if (abierto) repo.historialProducto(producto.id).then(setHistorial);
  }, [abierto, producto.id]);

  const mejor = producto.precios[0];
  const peor = producto.precios[producto.precios.length - 1];
  const ahorro = producto.precios.length > 1 ? ((peor.precio_unitario_bs - mejor.precio_unitario_bs) / peor.precio_unitario_bs) * 100 : 0;
  const unidad = producto.unidad ?? mejor?.unidad;

  return (
    <View style={estilos.tarjeta}>
      <Pressable onPress={onAlternar} style={{ gap: 10 }}>
        <View style={s.filaEntre}>
          <Text style={s.nombre}>{producto.nombre}</Text>
          <Icono name={abierto ? 'chevron-up' : 'chevron-down'} color={colores.textoSuave} />
        </View>

        {producto.precios.map((p, i) => (
          <View key={p.comercio_id} style={[s.precioFila, i === 0 && s.mejor]}>
            <View style={{ flex: 1 }}>
              <View style={s.fila}>
                {i === 0 && <Icono name="trophy" size={16} color={colores.primario} />}
                <Text style={[s.comercio, i === 0 && { color: colores.primario }]}>{p.comercio_nombre}</Text>
              </View>
              <Text style={s.meta}>
                {haceCuanto(p.fecha)} · {p.registros} {p.registros === 1 ? 'compra' : 'compras'}
                {p.minimo_bs < p.precio_unitario_bs ? ` · mín. ${formatBs(p.minimo_bs)}` : ''}
              </Text>
            </View>
            <Text style={[s.precio, i === 0 && { color: colores.primario }]}>
              {formatBs(p.precio_unitario_bs)}
              {unidad ? <Text style={s.unidad}>/{unidad}</Text> : null}
            </Text>
          </View>
        ))}

        {ahorro >= 1 && (
          <Text style={s.ahorro}>
            Comprando en {mejor.comercio_nombre} ahorras ~{formatNumero(ahorro, 0)}% frente a {peor.comercio_nombre}
          </Text>
        )}
      </Pressable>

      {abierto && (
        <View style={s.historial}>
          <Text style={estilos.etiqueta}>Últimos registros</Text>
          {historial.map((h) => (
            <View key={h.id} style={s.filaEntre}>
              <Text style={s.meta}>
                {formatFecha(h.fecha)} · {h.comercio_nombre}
              </Text>
              <Text style={s.historialPrecio}>{formatBs(h.precio_unitario_bs)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    marginBottom: 0,
    paddingHorizontal: 14,
    backgroundColor: colores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  buscadorInput: { flex: 1, minHeight: 52, fontSize: 17, color: colores.texto },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  nombre: { flex: 1, fontSize: 18, fontWeight: '700', color: colores.texto },
  precioFila: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colores.fondo },
  mejor: { backgroundColor: colores.primarioSuave },
  comercio: { fontSize: 16, fontWeight: '600', color: colores.texto },
  meta: { fontSize: 13, color: colores.textoSuave },
  precio: { fontSize: 17, fontWeight: '700', color: colores.texto },
  unidad: { fontSize: 13, fontWeight: '500', color: colores.textoSuave },
  ahorro: { fontSize: 13, color: colores.primario, fontWeight: '600' },
  historial: { marginTop: 12, paddingTop: 12, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colores.borde },
  historialPrecio: { fontSize: 14, fontWeight: '600', color: colores.texto },
});
