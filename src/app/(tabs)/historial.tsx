import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colores, estilos, Icono, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { ResumenLista } from '../../db/repo';
import { formatBs, formatFechaHora } from '../../lib/format';

export default function Historial() {
  const [listas, setListas] = useState<ResumenLista[]>([]);

  useFocusEffect(
    useCallback(() => {
      repo.listarListasCerradas().then(setListas);
    }, []),
  );

  // Total del mes en curso para tener una idea rápida del gasto.
  const mes = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const mesActual = mes(new Date());
  const gastoMes = listas.filter((l) => mes(new Date(l.fecha)) === mesActual).reduce((s, l) => s + l.total_gastado_bs, 0);

  return (
    <FlatList
      data={listas}
      keyExtractor={(l) => String(l.id)}
      contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 32 }}
      ListHeaderComponent={
        listas.length ? (
          <View style={[estilos.tarjeta, s.resumen]}>
            <Text style={s.resumenEtiqueta}>Gastado este mes</Text>
            <Text style={s.resumenTotal}>{formatBs(gastoMes)}</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/historial/[id]', params: { id: String(item.id) } })}
          style={({ pressed }) => [estilos.tarjeta, s.fila, pressed && { backgroundColor: '#F0F3F6' }]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.fecha}>{formatFechaHora(item.fecha)}</Text>
            <Text style={s.meta}>
              {item.comprados}/{item.items} productos
              {item.fotos ? ` · ${item.fotos} ${item.fotos === 1 ? 'ticket' : 'tickets'}` : ''}
            </Text>
          </View>
          <Text style={s.total}>{formatBs(item.total_gastado_bs)}</Text>
          <Icono name="chevron-forward" color={colores.textoSuave} size={20} />
        </Pressable>
      )}
      ListEmptyComponent={
        <Vacio icono="calendar-outline" titulo="Sin compras cerradas" texto="Cuando cierres una compra aparecerá aquí con su total y sus comprobantes." />
      }
    />
  );
}

const s = StyleSheet.create({
  resumen: { backgroundColor: colores.primario, borderColor: colores.primario, gap: 2 },
  resumenEtiqueta: { color: '#D6F0E4', fontSize: 14 },
  resumenTotal: { color: '#fff', fontSize: 26, fontWeight: '800' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fecha: { fontSize: 16, fontWeight: '700', color: colores.texto, textTransform: 'capitalize' },
  meta: { fontSize: 14, color: colores.textoSuave },
  total: { fontSize: 17, fontWeight: '700', color: colores.primario },
});
