// Reglas de la caja, sin nada de pantalla: se pueden probar solas con `npm test`.
// Todo el dinero va en centavos enteros para no arrastrar errores de redondeo.

export const aCentavos = (monto) => Math.round(Number(monto) * 100)

export function formato(centavos) {
  const signo = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const entero = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${signo}Bs ${entero},${String(abs % 100).padStart(2, '0')}`
}

export class ErrorCaja extends Error {}

/** Agrega una unidad del producto al carrito, sin pasar del stock disponible. */
export function agregar(carrito, producto) {
  const linea = carrito.find((l) => l.id === producto.id)
  const cantidad = (linea?.cantidad ?? 0) + 1
  if (cantidad > producto.stock) throw new ErrorCaja(`Solo quedan ${producto.stock} de «${producto.nombre}».`)
  if (linea) return carrito.map((l) => (l.id === producto.id ? { ...l, cantidad } : l))
  return [...carrito, { id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 }]
}

/** Cambia la cantidad de una línea; con 0 o menos la quita. */
export function cambiarCantidad(carrito, id, cantidad, stock) {
  if (cantidad <= 0) return carrito.filter((l) => l.id !== id)
  if (cantidad > stock) throw new ErrorCaja(`Solo hay ${stock} en stock.`)
  return carrito.map((l) => (l.id === id ? { ...l, cantidad } : l))
}

export function totales(carrito, descuentoPct = 0) {
  if (descuentoPct < 0 || descuentoPct > 100) throw new ErrorCaja('El descuento debe estar entre 0 y 100.')
  const subtotal = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0)
  const descuento = Math.round((subtotal * descuentoPct) / 100)
  return { subtotal, descuento, total: subtotal - descuento, unidades: carrito.reduce((s, l) => s + l.cantidad, 0) }
}

export function cambio(total, pagado) {
  if (pagado < total) throw new ErrorCaja(`Faltan ${formato(total - pagado)}.`)
  return pagado - total
}

/** Cierra la venta: valida, descuenta el stock y devuelve la venta y los productos actualizados (no modifica los originales). */
export function cerrarVenta({ carrito, productos, descuentoPct = 0, metodo = 'efectivo', pagado, ahora = new Date(), numero = 1 }) {
  if (!carrito.length) throw new ErrorCaja('El carrito está vacío.')
  const porId = new Map(productos.map((p) => [p.id, p]))
  for (const l of carrito) {
    const p = porId.get(l.id)
    if (!p) throw new ErrorCaja(`El producto «${l.nombre}» ya no existe.`)
    if (l.cantidad > p.stock) throw new ErrorCaja(`Stock insuficiente de «${p.nombre}»: quedan ${p.stock}.`)
  }
  const t = totales(carrito, descuentoPct)
  // Con QR o tarjeta se cobra el monto exacto; en efectivo puede haber cambio.
  const recibido = metodo === 'efectivo' ? pagado : t.total
  const vuelto = cambio(t.total, recibido)
  const venta = {
    numero,
    fecha: ahora.toISOString(),
    lineas: carrito.map((l) => ({ ...l })),
    descuentoPct,
    ...t,
    metodo,
    pagado: recibido,
    cambio: vuelto,
  }
  const actualizados = productos.map((p) => {
    const l = carrito.find((x) => x.id === p.id)
    return l ? { ...p, stock: p.stock - l.cantidad } : p
  })
  return { venta, productos: actualizados }
}

const diaLocal = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Resumen de un día: cantidad de ventas, total, ticket promedio, total por método de pago y productos más vendidos. */
export function reporteDelDia(ventas, dia) {
  const delDia = ventas.filter((v) => diaLocal(v.fecha) === dia)
  const total = delDia.reduce((s, v) => s + v.total, 0)
  const porMetodo = {}
  const unidades = new Map()
  for (const v of delDia) {
    porMetodo[v.metodo] = (porMetodo[v.metodo] ?? 0) + v.total
    for (const l of v.lineas) unidades.set(l.nombre, (unidades.get(l.nombre) ?? 0) + l.cantidad)
  }
  const masVendidos = [...unidades.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
  return { ventas: delDia.length, total, ticketPromedio: delDia.length ? Math.round(total / delDia.length) : 0, porMetodo, masVendidos }
}

export const bajoStock = (productos, minimo = 5) => productos.filter((p) => p.stock <= minimo).sort((a, b) => a.stock - b.stock)

const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

/** Ventas en CSV (una fila por línea vendida), listo para abrir en Excel. */
export function aCsv(ventas) {
  const filas = [['venta', 'fecha', 'producto', 'cantidad', 'precio', 'importe', 'metodo']]
  for (const v of ventas) {
    for (const l of v.lineas) filas.push([v.numero, v.fecha, l.nombre, l.cantidad, (l.precio / 100).toFixed(2), ((l.precio * l.cantidad) / 100).toFixed(2), v.metodo])
  }
  return filas.map((f) => f.map(celda).join(',')).join('\r\n')
}

export { diaLocal }
