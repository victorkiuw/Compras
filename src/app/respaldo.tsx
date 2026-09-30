import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton, colores, estilos, Icono } from '../components/ui';
import { exportarBaseDatos, restaurarBaseDatos } from '../db/database';
import * as repo from '../db/repo';
import { compartirArchivo, elegirArchivo, fechaArchivo } from '../lib/archivos';
import { formatFechaHora } from '../lib/format';
import { useCompraStore } from '../store/useCompraStore';

export default function Respaldo() {
  const { ultimoRespaldo, iniciar } = useCompraStore();
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    setOcupado(true);
    try {
      const bytes = await exportarBaseDatos();
      await compartirArchivo(`compras-respaldo-${fechaArchivo()}.db`, bytes, 'application/octet-stream', 'Guardar respaldo de Compras');
      await repo.setAjuste('ultimo_respaldo', new Date().toISOString());
      await iniciar();
    } catch (e) {
      Alert.alert('No se pudo crear el respaldo', e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = async () => {
    const archivo = await elegirArchivo().catch(() => null);
    if (!archivo) return;
    Alert.alert(
      'Restaurar respaldo',
      `Se reemplazarán TODOS los datos actuales por los de «${archivo.nombre}». Esto no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            setOcupado(true);
            try {
              await restaurarBaseDatos(archivo.bytes);
              await iniciar();
              Alert.alert('Listo', 'Se restauraron tus listas, precios, facturas y créditos.');
            } catch (e) {
              Alert.alert('No se pudo restaurar', e instanceof Error ? e.message : String(e));
            } finally {
              setOcupado(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <View style={[estilos.tarjeta, { gap: 8 }]}>
        <View style={s.fila}>
          <Icono name="shield-checkmark-outline" color={colores.primario} size={28} />
          <Text style={s.titulo}>Tus datos viven solo en este teléfono</Text>
        </View>
        <Text style={s.texto}>
          Si el teléfono se pierde o se daña, se pierde el historial de precios, las facturas y los créditos. Haz un respaldo cada semana y
          guárdalo fuera del teléfono (Google Drive, tu correo o un chat de WhatsApp contigo mismo).
        </Text>
        <Text style={[s.texto, { fontWeight: '700', color: ultimoRespaldo ? colores.primario : colores.aviso }]}>
          {ultimoRespaldo ? `Último respaldo: ${formatFechaHora(ultimoRespaldo)}` : 'Aún no has hecho ningún respaldo.'}
        </Text>
      </View>

      <Boton titulo="Crear y enviar respaldo" icono="cloud-upload-outline" onPress={exportar} deshabilitado={ocupado} />

      <View style={[estilos.tarjeta, { gap: 8, marginTop: 12 }]}>
        <Text style={estilos.etiqueta}>Restaurar</Text>
        <Text style={s.texto}>
          En un teléfono nuevo, instala la app, toca «Restaurar desde archivo» y elige el archivo <Text style={{ fontWeight: '700' }}>.db</Text>{' '}
          del respaldo. Las fotos de los tickets no van en el respaldo.
        </Text>
        <Boton titulo="Restaurar desde archivo" icono="cloud-download-outline" variante="secundario" onPress={restaurar} deshabilitado={ocupado} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { flex: 1, fontSize: 17, fontWeight: '700', color: colores.texto },
  texto: { fontSize: 15, color: colores.textoSuave, lineHeight: 21 },
});
