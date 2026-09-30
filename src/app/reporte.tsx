import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton, colores, estilos, Icono } from '../components/ui';
import * as repo from '../db/repo';
import { compartirArchivo, MIME_XLSX } from '../lib/archivos';
import { formatBs, formatUsd } from '../lib/format';
import { hojasReporte, inicioSemana, rangoSemana, resumirSemana, type EntradaReporte } from '../lib/reporte';
import { crearXlsx } from '../lib/xlsx';

export default function Reporte() {
  const [inicio, setInicio] = useState(() => inicioSemana(new Date()));
  const [datos, setDatos] = useState<{ para: number; entrada: EntradaReporte } | null>(null);
  const [exportando, setExportando] = useState(false);
  const rango = rangoSemana(inicio);
  const esActual = inicio.getTime() === inicioSemana(new Date()).getTime();

  useEffect(() => {
    let vigente = true;
    repo.datosReporte(rango.desde.toISOString(), rango.hasta.toISOString()).then((entrada) => {
      if (vigente) setDatos({ para: inicio.getTime(), entrada });
    });
    return () => {
      vigente = false;
    };
    // rango se deriva de inicio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio]);

  const cargando = !datos || datos.para !== inicio.getTime();
  const r = datos && !cargando ? resumirSemana(datos.entrada) : null;

  const mover = (semanas: number) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + semanas * 7);
    setInicio(d);
  };

  const exportar = async () => {
    if (!datos) return;
    setExportando(true);
    try {
      const bytes = crearXlsx(hojasReporte(datos.entrada, rango.titulo));
      const nombre = `Compras semana ${rango.titulo.replace(/\//g, '-')}.xlsx`;
      await compartirArchivo(nombre, bytes, MIME_XLSX, 'Reporte semanal de compras');
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
      <View style={[estilos.tarjeta, s.semana]}>
        <Pressable onPress={() => mover(-1)} hitSlop={12} accessibilityLabel="Semana anterior">
          <Icono name="chevron-back" size={28} color={colores.acento} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.etiqueta}>{esActual ? 'Esta semana' : 'Semana'}</Text>
          <Text style={s.titulo}>{rango.titulo}</Text>
        </View>
        <Pressable onPress={() => mover(1)} hitSlop={12} disabled={esActual} accessibilityLabel="Semana siguiente" style={{ opacity: esActual ? 0.3 : 1 }}>
          <Icono name="chevron-forward" size={28} color={colores.acento} />
        </Pressable>
      </View>

      {!r ? (
        <ActivityIndicator color={colores.primario} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={[estilos.tarjeta, s.total]}>
            <Text style={s.totalEtiqueta}>Pagado</Text>
            <Text style={s.totalMonto}>{formatBs(r.pagadoBs)}</Text>
            <Text style={s.totalUsd}>{formatUsd(r.pagadoUsd)}</Text>
            {r.creditoUsd > 0 && <Text style={s.totalEtiqueta}>+ {formatUsd(r.creditoUsd)} a crédito</Text>}
            <Text style={s.totalEtiqueta}>
              {r.facturas} {r.facturas === 1 ? 'factura' : 'facturas'} · {r.productos} productos
              {datos!.entrada.noHabia.length ? ` · ${datos!.entrada.noHabia.length} no había` : ''}
            </Text>
          </View>

          {r.porComercio.length > 0 && (
            <View style={[estilos.tarjeta, { gap: 8 }]}>
              <Text style={estilos.etiqueta}>Por comercio</Text>
              {r.porComercio.map((c) => (
                <View key={c.comercio} style={s.fila}>
                  <Text style={s.nombre}>{c.comercio}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.monto}>{formatUsd(c.usd + c.creditoUsd)}</Text>
                    {c.creditoUsd > 0 && <Text style={s.meta}>{formatUsd(c.creditoUsd)} a crédito</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {r.porProducto.length > 0 && (
            <View style={[estilos.tarjeta, { gap: 8 }]}>
              <Text style={estilos.etiqueta}>Lo que más costó</Text>
              {r.porProducto.slice(0, 5).map((p) => (
                <View key={`${p.producto}|${p.unidad}`} style={s.fila}>
                  <Text style={s.nombre} numberOfLines={1}>
                    {p.producto}
                  </Text>
                  <Text style={s.monto}>{formatUsd(p.usd)}</Text>
                </View>
              ))}
            </View>
          )}

          <Boton
            titulo={exportando ? 'Generando…' : 'Exportar a Excel'}
            icono="download-outline"
            onPress={exportar}
            deshabilitado={exportando}
          />
          <Text style={s.ayuda}>
            El archivo trae 5 hojas: Resumen, Compras (cada producto), Productos, Créditos (deudas y pagos) y No había. Se puede enviar por
            WhatsApp, correo o guardar en Drive.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  semana: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  etiqueta: { fontSize: 13, color: colores.textoSuave },
  titulo: { fontSize: 17, fontWeight: '700', color: colores.texto },
  total: { backgroundColor: colores.primario, borderColor: colores.primario, gap: 2 },
  totalEtiqueta: { color: '#D6F0E4', fontSize: 14 },
  totalMonto: { color: '#fff', fontSize: 28, fontWeight: '800' },
  totalUsd: { color: '#fff', fontSize: 17, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { flex: 1, fontSize: 16, color: colores.texto },
  monto: { fontSize: 16, fontWeight: '700', color: colores.texto },
  meta: { fontSize: 13, color: colores.aviso },
  ayuda: { fontSize: 13, color: colores.textoSuave, textAlign: 'center' },
});
