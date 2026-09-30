import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, SectionList, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton, colores, estilos, Icono, Segmentado, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Abono, Credito } from '../../db/repo';
import { formatBs, formatFecha, formatNumero, formatUsd, parseMonto } from '../../lib/format';
import { diasParaVencer, textoDeudas, textoVence } from '../../lib/resumen';
import { useCompraStore } from '../../store/useCompraStore';

type Filtro = 'pendientes' | 'pagadas';

export default function PorPagar() {
  const tasa = useCompraStore((s) => s.tasaBs);
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [pagando, setPagando] = useState<Credito | null>(null);

  const cargar = useCallback(async () => {
    setCreditos(await repo.listarCreditos(filtro === 'pendientes'));
  }, [filtro]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const total = creditos.reduce((s, c) => s + c.saldo_usd, 0);
  const vencidas = creditos.filter((c) => (diasParaVencer(c.vence) ?? 1) < 0).length;

  const grupos = new Map<string, Credito[]>();
  for (const c of creditos) {
    const k = c.comercio_nombre ?? 'Sin comercio';
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const secciones = [...grupos.entries()]
    .map(([titulo, data]) => ({ titulo, data, saldo: data.reduce((s, c) => s + c.saldo_usd, 0) }))
    .sort((a, b) => b.saldo - a.saldo);

  const compartir = () => Share.share({ message: textoDeudas(creditos, tasa) }).catch(() => {});

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={secciones}
        keyExtractor={(c) => String(c.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 6 }}>
            <Segmentado
              opciones={[
                { valor: 'pendientes', etiqueta: 'Por pagar' },
                { valor: 'pagadas', etiqueta: 'Pagadas' },
              ]}
              valor={filtro}
              onCambio={(f) => {
                setAbierto(null);
                setFiltro(f);
              }}
            />
            {filtro === 'pendientes' && creditos.length > 0 && (
              <View style={[estilos.tarjeta, s.resumen]}>
                <Text style={s.resumenEtiqueta}>El negocio debe</Text>
                <Text style={s.resumenTotal}>{formatUsd(total)}</Text>
                {tasa ? <Text style={s.resumenEtiqueta}>≈ {formatBs(total * tasa)} a la tasa de hoy</Text> : null}
                <Text style={s.resumenEtiqueta}>
                  {creditos.length} {creditos.length === 1 ? 'factura' : 'facturas'}
                  {vencidas ? ` · ${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}` : ''}
                </Text>
                <Boton titulo="Enviar por WhatsApp" icono="share-social-outline" variante="secundario" onPress={compartir} style={{ marginTop: 6 }} />
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={s.seccion}>
            {section.titulo}
            {filtro === 'pendientes' ? ` · ${formatUsd(section.saldo)}` : ''}
          </Text>
        )}
        renderItem={({ item }) => (
          <TarjetaCredito
            credito={item}
            abierto={abierto === item.id}
            onAlternar={() => setAbierto(abierto === item.id ? null : item.id)}
            onPagar={() => setPagando(item)}
            onCambio={cargar}
          />
        )}
        ListEmptyComponent={
          <Vacio
            icono={filtro === 'pendientes' ? 'checkmark-circle-outline' : 'time-outline'}
            titulo={filtro === 'pendientes' ? 'No hay deudas pendientes' : 'Aún no hay créditos pagados'}
            texto={
              filtro === 'pendientes'
                ? 'Cuando registres una factura con método «Crédito», aparecerá aquí hasta que el negocio la pague.'
                : 'Las facturas a crédito ya saldadas se muestran aquí.'
            }
          />
        }
      />

      {pagando && (
        <DialogoPago
          credito={pagando}
          onCerrar={() => setPagando(null)}
          onGuardar={async (monto, nota) => {
            await repo.registrarAbono(pagando.id, monto, nota);
            setPagando(null);
            await cargar();
          }}
        />
      )}
    </View>
  );
}

function TarjetaCredito({
  credito: c,
  abierto,
  onAlternar,
  onPagar,
  onCambio,
}: {
  credito: Credito;
  abierto: boolean;
  onAlternar: () => void;
  onPagar: () => void;
  onCambio: () => void;
}) {
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const dias = diasParaVencer(c.vence);
  const pagada = !!c.pagada_en;
  const colorVence = pagada ? colores.primario : dias != null && dias < 0 ? colores.peligro : dias != null && dias <= 3 ? colores.aviso : colores.textoSuave;

  const alternar = async () => {
    if (!abierto) setAbonos(await repo.listarAbonos(c.id));
    onAlternar();
  };

  const borrarAbono = (a: Abono) =>
    Alert.alert('Eliminar pago', `¿Eliminar el pago de ${formatUsd(a.monto_usd)} del ${formatFecha(a.fecha)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await repo.eliminarAbono(a.id);
          setAbonos(await repo.listarAbonos(c.id));
          onCambio();
        },
      },
    ]);

  return (
    <Pressable onPress={alternar} style={[estilos.tarjeta, { gap: 6 }, dias != null && dias < 0 && !pagada && { borderColor: colores.peligro, borderWidth: 1 }]}>
      <View style={s.filaEntre}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Compra del {formatFecha(c.fecha)}</Text>
          <Text style={[s.vence, { color: colorVence }]}>{pagada ? `Pagada el ${formatFecha(c.pagada_en!)}` : textoVence(c.vence)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.saldo, pagada && { color: colores.primario }]}>{formatUsd(pagada ? c.total_usd : c.saldo_usd)}</Text>
          {c.abonado_usd > 0.005 && !pagada && <Text style={s.meta}>de {formatUsd(c.total_usd)}</Text>}
        </View>
      </View>
      {c.productos && (
        <Text style={s.meta} numberOfLines={abierto ? undefined : 1}>
          {c.productos}
        </Text>
      )}
      {abierto && (
        <View style={s.detalle}>
          <Text style={s.meta}>
            Total factura: {formatUsd(c.total_usd)} ({formatBs(c.total_bs)} a {formatNumero(c.tasa_bs ?? 0)} Bs/$)
          </Text>
          {abonos.length === 0 ? (
            <Text style={s.meta}>Sin pagos registrados.</Text>
          ) : (
            abonos.map((a) => (
              <Pressable key={a.id} onLongPress={() => borrarAbono(a)} style={s.abono}>
                <Icono name="checkmark-circle-outline" size={16} color={colores.primario} />
                <Text style={[s.meta, { flex: 1 }]}>
                  {formatFecha(a.fecha)}
                  {a.nota ? ` · ${a.nota}` : ''}
                </Text>
                <Text style={s.abonoMonto}>{formatUsd(a.monto_usd)}</Text>
              </Pressable>
            ))
          )}
          {abonos.length > 0 && <Text style={s.ayuda}>Mantén presionado un pago para eliminarlo.</Text>}
        </View>
      )}
      {!pagada && <Boton titulo="Registrar pago del negocio" icono="cash-outline" variante="secundario" onPress={onPagar} style={{ minHeight: 44 }} />}
    </Pressable>
  );
}

function DialogoPago({
  credito,
  onGuardar,
  onCerrar,
}: {
  credito: Credito;
  onGuardar: (monto: number, nota: string | null) => void;
  onCerrar: () => void;
}) {
  const [montoTxt, setMontoTxt] = useState(formatNumero(credito.saldo_usd));
  const [nota, setNota] = useState('');
  const monto = parseMonto(montoTxt) ?? 0;
  const guardar = () => {
    if (monto <= 0) return;
    if (monto > credito.saldo_usd + 0.005)
      return Alert.alert('Monto mayor a la deuda', `El saldo pendiente es ${formatUsd(credito.saldo_usd)}.`);
    onGuardar(monto, nota);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={s.centro} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={[estilos.tarjeta, { gap: 12, padding: 20 }]}>
          <Text style={s.titulo}>Pago a {credito.comercio_nombre ?? 'comercio'}</Text>
          <Text style={s.meta}>
            Saldo: {formatUsd(credito.saldo_usd)}. Si el negocio pagó todo, deja el monto como está; si fue un abono, escribe cuánto.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.prefijo}>$</Text>
            <TextInput
              style={[estilos.input, { flex: 1, fontSize: 22, fontWeight: '600' }]}
              value={montoTxt}
              onChangeText={setMontoTxt}
              keyboardType="decimal-pad"
              selectTextOnFocus
              autoFocus
            />
          </View>
          <TextInput
            style={[estilos.input, { fontSize: 16 }]}
            value={nota}
            onChangeText={setNota}
            placeholder="Nota (opcional): transferencia, efectivo…"
            placeholderTextColor={colores.textoSuave}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} style={{ flex: 1 }} />
            <Boton
              titulo={monto >= credito.saldo_usd - 0.005 ? 'Saldar deuda' : 'Registrar abono'}
              onPress={guardar}
              deshabilitado={monto <= 0}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  resumen: { backgroundColor: colores.aviso, borderColor: colores.aviso, gap: 2 },
  resumenEtiqueta: { color: '#FFF3E0', fontSize: 14 },
  resumenTotal: { color: '#fff', fontSize: 28, fontWeight: '800' },
  seccion: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 2,
  },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titulo: { fontSize: 17, fontWeight: '700', color: colores.texto },
  vence: { fontSize: 14, fontWeight: '700' },
  saldo: { fontSize: 20, fontWeight: '800', color: colores.aviso },
  meta: { fontSize: 14, color: colores.textoSuave },
  ayuda: { fontSize: 12, color: colores.textoSuave },
  detalle: { gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colores.borde },
  abono: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  abonoMonto: { fontSize: 15, fontWeight: '700', color: colores.primario },
  centro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  prefijo: { fontSize: 20, fontWeight: '600', color: colores.textoSuave },
});
