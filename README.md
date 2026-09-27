# Compras

App móvil (Android/iOS) para hacer las compras del negocio en supermercados y mayoristas:
pegas la lista que te mandan por WhatsApp, marcas lo que vas comprando con una mano,
registras precio, comercio y método de pago, y la app va armando el historial de
precios para saber dónde conviene comprar cada cosa. Los precios se anotan en dólares
(o en Bs.) y se convierten con la tasa del día al monto que pagas en bolívares. 100 % offline.

## Funciones

| Pantalla | Qué hace |
| --- | --- |
| **Compra** | Lista activa con *Pendientes* / *Comprados*, progreso (8/15), total pagado en Bs. y en $, y la **tasa del día** (Bs por $), que se descarga sola: BCV oficial o paralelo, una vez al día al abrir la app (con botón para actualizar y opción de escribirla a mano; sin conexión se usa la última guardada). Bajo cada pendiente: último precio pagado (y su equivalente en Bs. a la tasa de hoy) y el comercio más barato conocido. Mantén presionado para **elegir varios productos y registrarlos en una misma factura**. |
| **Factura** | Hoja inferior para registrar uno o varios productos juntos: cantidad (con +/−) vs. pedida, precio por unidad o total en **$ o Bs.**, tasa, comercio, **Tarjeta / Pago Móvil** y foto del ticket. Se pueden sumar más productos pendientes a la misma factura. En *Comprados* se ven agrupados por factura; tocar una la abre para editarla. |
| **Pegar lista** | Pega el mensaje de WhatsApp (se toma del portapapeles automáticamente). Entiende viñetas, emojis, `*negritas*`, prefijos de chat exportado y cantidades como `2 kg de harina`, `Harina x3`, `Queso 1/2 kilo`, `3 cajas de leche`. Puedes descartar líneas antes de crear la lista. |
| **Precios** | Buscador de productos con los comercios ordenados del más barato al más caro (en $, con su equivalente en Bs. hoy). |
| **Ficha de producto** | Cuánto has gastado en total, precio promedio, mínimo y máximo, **cuánto ahorraste o pagaste de más en cada comercio** (frente a tu precio promedio), cuánto te habrías ahorrado comprando siempre en el más barato, y cada compra con su variación (▲/▼ %) frente a la anterior en el mismo comercio. |
| **Historial** | Compras cerradas por fecha con total en Bs. y $, gasto del mes y detalle por factura: desglose por método de pago y por comercio, y los tickets fotografiados. |
| **Comercios** | Alta, edición y baja de comercios (Mayorista / Supermercado / Otro). |

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
  lib/                 parser de WhatsApp, formato Bs./$, cálculo de ahorro, fotos
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

## Generar el APK (Fase 5)

```bash
npx eas-cli@latest login
npm run build:apk       # perfil "preview" de eas.json → .apk instalable
```

EAS compila en la nube y devuelve un enlace para descargar el `.apk` e instalarlo en el teléfono.

## Estado de las fases

- [x] Fase 1 – Proyecto Expo, SQLite y entidades.
- [x] Fase 2 – Importador de WhatsApp y checklist.
- [x] Fase 3 – Registro rápido de compra, pagos y sumatoria en Bs.
- [x] Fase 4 – Historial automático de precios y radar por comercio.
- [x] Extra – Facturas con varios productos, precios en $ con tasa de cambio y ahorro por comercio.
- [ ] Fase 5 – Pruebas en dispositivo y compilación del APK (configurado; falta correr `eas build`).
