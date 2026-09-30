# Compras

App móvil (Android/iOS) para hacer las compras del negocio en supermercados y mayoristas:
pegas la lista que te mandan por WhatsApp, marcas lo que vas comprando con una mano,
registras precio, comercio y método de pago, y la app va armando el historial de
precios para saber dónde conviene comprar cada cosa. Los precios se anotan en dólares
(o en Bs.) y se convierten con la tasa del día al monto que pagas en bolívares. 100 % offline.

## Funciones

| Pantalla | Qué hace |
| --- | --- |
| **Compra** | Lista activa con *Pendientes* / *Comprados*, progreso, total pagado en Bs. y $ (y lo que va a crédito aparte) y la **tasa del día** automática (BCV o paralelo). Cada producto tiene ✏️ para **editar nombre, cantidad, unidad (Kg, Unidad, Caja, Bulto…) y nota**; si no trae unidad muestra «Elegir unidad» y la app la recuerda para la próxima vez. Mantén presionado para elegir varios y registrarlos en **una factura**, marcarlos como **«No había»** o eliminarlos. Vista **por comercio** (dónde estuvo más barato cada cosa). Campo para agregar productos con **autocompletado**. Menú ⋮: **enviar resumen por WhatsApp**, guardar como **lista frecuente**, cerrar compra. |
| **Factura** | Uno o varios productos: cantidad, precio por unidad o total en **$ o Bs.**, tasa, comercio, método **Tarjeta / Pago Móvil / Efectivo / Crédito** (con vencimiento), foto del ticket. **Alerta** si el precio subió 15 % o más frente a la última vez. |
| **Pegar lista** | Pega el mensaje (o en WhatsApp: mantener presionado → **Compartir → Compras**). Cada línea se puede **corregir** antes de crear la lista. Acceso a las **listas frecuentes**. |
| **Precios** | Comercios ordenados del más barato al más caro por producto, con ficha de ahorro por comercio. |
| **Por pagar** | Deudas a crédito (en $) que paga el negocio, agrupadas por comercio, con vencidas resaltadas, **abonos o pago total** y envío por WhatsApp. |
| **Historial** | Compras cerradas con lo pagado y lo que fue a crédito, detalle por factura y lo que no había. |
| **Más** | **Reporte semanal en Excel** (Resumen, Compras, Productos, Créditos, No había), **respaldo** y restauración de datos (con recordatorio semanal), comercios. |

Los cálculos de ahorro se hacen en dólares para que la inflación del bolívar no distorsione la comparación.

Al cerrar una compra con pendientes puedes pasarlos automáticamente a una lista nueva.

## Stack

- Expo SDK 57 + React Native + TypeScript, navegación con Expo Router (`src/app/`).
- SQLite local (`expo-sqlite`) con migraciones por `PRAGMA user_version` (`src/db/database.ts`).
- Zustand para el estado de la compra activa (`src/store/useCompraStore.ts`).
- `expo-image-picker` + `expo-file-system` para los tickets (se copian a la carpeta de la app).
- `expo-clipboard` y `expo-haptics`.

```
src/
  app/                 pantallas (Expo Router)
    (tabs)/            Compra, Precios, Historial, Comercios
    importar.tsx       pegar lista de WhatsApp
    historial/[id].tsx detalle de una compra
    producto/[id].tsx  ficha de producto con ahorro por comercio
  components/          UI compartida y hoja de registro
  db/                  esquema SQLite y consultas
  lib/                 parser de WhatsApp, formato Bs./$, ahorro, resúmenes, Excel (xlsx.ts), tasa, fotos
  store/               estado (Zustand)
```

### Modelo de datos

Sigue la especificación (`comercio`, `producto`, `lista_compra`, `item_compra`,
`registro_precio_historico`) más una tabla `factura` (comercio, método de pago, tasa, foto
y totales en Bs. y $ de un grupo de productos). Cada ítem comprado y cada registro de precio
guardan el monto en Bs., en $ y la tasa usada. Otros campos extra: `producto.nombre_normalizado`
(para reconocer "Azúcar" y "azucar" como el mismo producto), `item_compra.unidad`,
`texto_original`, `comprado_en` y `orden`, `registro_precio_historico.item_id` (una
compra editada reemplaza su precio en vez de duplicarlo) y una tabla `ajuste` que
recuerda el último comercio y método de pago usados.

## Desarrollo

```bash
npm install
npx expo start          # escanea el QR con Expo Go en el teléfono
npm test                # pruebas del parser, montos y cálculo de ahorro
npm run typecheck
npm run lint
```

Todas las librerías usadas vienen incluidas en Expo Go, así que no hace falta una build
nativa para probar.

## Instalar en el teléfono (APK)

Cada cambio subido compila el APK en GitHub Actions (`.github/workflows/apk.yml`) y lo
publica en **Releases** (`Compras-N.apk`). Desde el teléfono: abrir la Release más reciente,
descargar el `.apk`, permitir "instalar apps de fuentes desconocidas" e instalar. Las versiones
nuevas se instalan encima sin perder los datos.

También se puede compilar con EAS: `npx eas-cli@latest login` y `npm run build:apk`.

## Estado de las fases

- [x] Fase 1 – Proyecto Expo, SQLite y entidades.
- [x] Fase 2 – Importador de WhatsApp y checklist.
- [x] Fase 3 – Registro rápido de compra, pagos y sumatoria en Bs.
- [x] Fase 4 – Historial automático de precios y radar por comercio.
- [x] Extra – Facturas con varios productos, precios en $ con tasa de cambio y ahorro por comercio.
- [x] Fase 5 – Compilación del APK (GitHub Actions → Releases).
- [x] Extra 2 – Edición de lista y unidades, crédito y cuentas por pagar, efectivo, no había, resumen por WhatsApp, listas frecuentes, alerta de precio, vista por comercio, autocompletado, respaldo y reporte semanal en Excel.
- [ ] Pruebas en dispositivo real.
