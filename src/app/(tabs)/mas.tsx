import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colores, estilos, Icono, type NombreIcono } from '../../components/ui';
import { formatFechaHora } from '../../lib/format';
import { useCompraStore } from '../../store/useCompraStore';

interface Entrada {
  titulo: string;
  detalle: string;
  icono: NombreIcono;
  ruta: Href;
}

export default function Mas() {
  const ultimoRespaldo = useCompraStore((s) => s.ultimoRespaldo);
  const entradas: Entrada[] = [
    { titulo: 'Reporte semanal', detalle: 'Compras de la semana exportables a Excel', icono: 'document-text-outline', ruta: '/reporte' },
    {
      titulo: 'Respaldo de datos',
      detalle: ultimoRespaldo ? `Último: ${formatFechaHora(ultimoRespaldo)}` : 'Aún no has hecho ninguno',
      icono: 'cloud-upload-outline',
      ruta: '/respaldo',
    },
    { titulo: 'Comercios', detalle: 'Agregar, renombrar o eliminar', icono: 'storefront-outline', ruta: '/comercios' },
    { titulo: 'Listas frecuentes', detalle: 'Se usan y eliminan desde «Pegar lista»', icono: 'bookmark-outline', ruta: '/importar' },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
      {entradas.map((e) => (
        <Pressable key={e.titulo} onPress={() => router.push(e.ruta)} style={({ pressed }) => [estilos.tarjeta, s.fila, pressed && { opacity: 0.85 }]}>
          <View style={s.icono}>
            <Icono name={e.icono} color={colores.primario} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>{e.titulo}</Text>
            <Text style={s.detalle}>{e.detalle}</Text>
          </View>
          <Icono name="chevron-forward" size={20} color={colores.textoSuave} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  icono: { width: 40, height: 40, borderRadius: 20, backgroundColor: colores.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 17, fontWeight: '600', color: colores.texto },
  detalle: { fontSize: 14, color: colores.textoSuave },
});
