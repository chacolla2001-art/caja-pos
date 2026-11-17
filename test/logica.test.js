import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ErrorCaja, aCentavos, aCsv, agregar, bajoStock, cambiarCantidad, cambio, cerrarVenta, formato, reporteDelDia, totales } from '../src/logica.js'

const cafe = { id: 'cafe', nombre: 'Café', precio: 1200, stock: 3 }
const pan = { id: 'pan', nombre: 'Pan', precio: 50, stock: 100 }

test('convierte y da formato al dinero sin errores de redondeo', () => {
  assert.equal(aCentavos('0.1') + aCentavos('0.2'), 30)
  assert.equal(formato(123456), 'Bs 1.234,56')
  assert.equal(formato(5), 'Bs 0,05')
  assert.equal(formato(-250), '-Bs 2,50')
})

test('agregar suma unidades y respeta el stock', () => {
  let c = agregar([], cafe)
  c = agregar(c, cafe)
  c = agregar(c, pan)
  assert.deepEqual(c.map((l) => [l.id, l.cantidad]), [['cafe', 2], ['pan', 1]])
  c = agregar(c, cafe)
  assert.throws(() => agregar(c, cafe), /Solo quedan 3/)
})

test('cambiar cantidad: quita con cero y valida el stock', () => {
  const c = agregar(agregar([], cafe), pan)
  assert.equal(cambiarCantidad(c, 'cafe', 0, 3).length, 1)
  assert.equal(cambiarCantidad(c, 'pan', 7, 100).find((l) => l.id === 'pan').cantidad, 7)
  assert.throws(() => cambiarCantidad(c, 'cafe', 4, 3), ErrorCaja)
})

test('totales con descuento', () => {
  const c = [{ ...cafe, cantidad: 2 }, { ...pan, cantidad: 3 }]
  assert.deepEqual(totales(c), { subtotal: 2550, descuento: 0, total: 2550, unidades: 5 })
  assert.deepEqual(totales(c, 10), { subtotal: 2550, descuento: 255, total: 2295, unidades: 5 })
  assert.throws(() => totales(c, 120), /entre 0 y 100/)
})

test('cambio: exige que alcance el pago', () => {
  assert.equal(cambio(2295, 3000), 705)
  assert.throws(() => cambio(2295, 2000), /Faltan Bs 2,95/)
})

test('cerrar venta descuenta stock sin modificar los originales', () => {
  const productos = [cafe, pan]
  const carrito = [{ id: 'cafe', nombre: 'Café', precio: 1200, cantidad: 2 }]
  const r = cerrarVenta({ carrito, productos, pagado: 5000, numero: 7, ahora: new Date('2026-11-16T15:00:00') })
  assert.equal(r.venta.total, 2400)
  assert.equal(r.venta.cambio, 2600)
  assert.equal(r.venta.numero, 7)
  assert.equal(r.productos.find((p) => p.id === 'cafe').stock, 1)
  assert.equal(cafe.stock, 3, 'el original no cambia')
})

test('cerrar venta rechaza carrito vacío, stock insuficiente y pago corto', () => {
  assert.throws(() => cerrarVenta({ carrito: [], productos: [cafe], pagado: 0 }), /vacío/)
  assert.throws(() => cerrarVenta({ carrito: [{ ...cafe, cantidad: 9 }], productos: [cafe], pagado: 99999 }), /Stock insuficiente/)
  assert.throws(() => cerrarVenta({ carrito: [{ ...cafe, cantidad: 1 }], productos: [cafe], pagado: 100 }), /Faltan/)
})

test('con QR o tarjeta se cobra exacto, sin cambio', () => {
  const r = cerrarVenta({ carrito: [{ ...pan, cantidad: 4 }], productos: [pan], metodo: 'qr' })
  assert.equal(r.venta.pagado, 200)
  assert.equal(r.venta.cambio, 0)
})

test('reporte del día: totales, métodos y más vendidos', () => {
  const v = (hora, metodo, lineas) => ({ fecha: new Date(`2026-11-16T${hora}:00`).toISOString(), metodo, lineas, total: lineas.reduce((s, l) => s + l.precio * l.cantidad, 0) })
  const ventas = [
    v('09:00', 'efectivo', [{ nombre: 'Café', precio: 1200, cantidad: 2 }]),
    v('10:30', 'qr', [{ nombre: 'Pan', precio: 50, cantidad: 10 }, { nombre: 'Café', precio: 1200, cantidad: 1 }]),
    { ...v('09:00', 'efectivo', [{ nombre: 'Pan', precio: 50, cantidad: 1 }]), fecha: new Date('2026-11-15T09:00:00').toISOString() },
  ]
  const r = reporteDelDia(ventas, '2026-11-16')
  assert.equal(r.ventas, 2)
  assert.equal(r.total, 4100)
  assert.equal(r.ticketPromedio, 2050)
  assert.deepEqual(r.porMetodo, { efectivo: 2400, qr: 1700 })
  assert.deepEqual(r.masVendidos, [['Pan', 10], ['Café', 3]])
  assert.equal(reporteDelDia(ventas, '2026-01-01').ticketPromedio, 0)
})

test('alerta de stock bajo ordenada por urgencia', () => {
  assert.deepEqual(bajoStock([cafe, pan, { id: 'te', nombre: 'Té', precio: 800, stock: 0 }]).map((p) => p.id), ['te', 'cafe'])
})

test('exporta CSV escapando comillas', () => {
  const csv = aCsv([{ numero: 1, fecha: '2026-11-16T15:00:00.000Z', metodo: 'efectivo', lineas: [{ nombre: 'Pan "especial"', precio: 150, cantidad: 2 }] }])
  const [cabecera, fila] = csv.split('\r\n')
  assert.equal(cabecera, '"venta","fecha","producto","cantidad","precio","importe","metodo"')
  assert.match(fila, /"Pan ""especial""","2","1.50","3.00","efectivo"/)
})
