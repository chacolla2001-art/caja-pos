// Pantalla de la caja: dibuja el estado y delega las reglas en logica.js.
import { ErrorCaja, aCentavos, aCsv, agregar, bajoStock, cambiarCantidad, cerrarVenta, diaLocal, formato, reporteDelDia, totales } from './logica.js'
import { cargar, colorDe, guardar, reiniciar } from './datos.js'

const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const iniciales = (nombre) => nombre.slice(0, 2).toUpperCase()

let estado = cargar()
let carrito = []
let metodo = 'efectivo'
let categoria = 'Todas'

// ---------- avisos ----------
let temporizador
function avisar(texto, error = false) {
  document.querySelector('.aviso-flotante')?.remove()
  const caja = document.createElement('div')
  caja.className = `aviso-flotante${error ? ' error' : ''}`
  caja.setAttribute('role', 'status')
  caja.textContent = texto
  document.body.append(caja)
  clearTimeout(temporizador)
  temporizador = setTimeout(() => caja.remove(), 2600)
}
const intentar = (fn) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ErrorCaja) avisar(e.message, true)
    else throw e
  }
}

// ---------- vender ----------
function dibujarCatalogo() {
  const categorias = ['Todas', ...new Set(estado.productos.map((p) => p.categoria))]
  $('#categorias').innerHTML = categorias.map((c) => `<button aria-pressed="${c === categoria}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')
  const q = $('#buscar').value.trim().toLowerCase()
  const visibles = estado.productos.filter((p) => (categoria === 'Todas' || p.categoria === categoria) && (!q || p.nombre.toLowerCase().includes(q)))
  $('#rejilla').innerHTML =
    visibles
      .map(
        (p, i) => `<button class="producto entra ${p.stock === 0 ? 'agotado' : ''}" style="--c:${colorDe(p.categoria)}; animation-delay:${Math.min(i, 12) * 25}ms" data-id="${esc(p.id)}" ${p.stock === 0 ? 'disabled' : ''}>
          <span class="color">${esc(iniciales(p.nombre))}</span>
          <span class="info"><span class="nombre">${esc(p.nombre)}</span><span class="precio">${formato(p.precio)}</span>
          <small>${p.stock === 0 ? 'Agotado' : `${p.stock} en stock`}</small></span></button>`,
      )
      .join('') || '<p class="suave">Ningún producto coincide.</p>'
}

function dibujarCarrito(pulsar = false) {
  $('#lineas').innerHTML = carrito
    .map(
      (l) => `<li><span>${esc(l.nombre)}<br><small class="suave">${formato(l.precio)} c/u</small></span>
        <span class="cant"><button data-menos="${esc(l.id)}" aria-label="Quitar uno">−</button><b>${l.cantidad}</b><button data-mas="${esc(l.id)}" aria-label="Agregar uno">+</button></span>
        <b>${formato(l.precio * l.cantidad)}</b></li>`,
    )
    .join('')
  $('#vacio').hidden = carrito.length > 0
  let t
  try {
    t = totales(carrito, Number($('#descuento').value) || 0)
  } catch {
    t = totales(carrito, 0)
  }
  $('#t-subtotal').textContent = formato(t.subtotal)
  $('#t-descuento').textContent = `− ${formato(t.descuento)}`
  $('#t-total').textContent = formato(t.total)
  if (pulsar) {
    $('#t-total').classList.remove('pulso')
    void $('#t-total').offsetWidth
    $('#t-total').classList.add('pulso')
  }
  $('#caja-pagado').hidden = metodo !== 'efectivo'
  const pagado = aCentavos($('#pagado').value || 0)
  const cambio = $('#t-cambio')
  cambio.className = 'cambio'
  if (metodo !== 'efectivo' || !carrito.length || !$('#pagado').value) cambio.textContent = ''
  else if (pagado < t.total) {
    cambio.textContent = `Faltan ${formato(t.total - pagado)}`
    cambio.classList.add('falta')
  } else cambio.textContent = `Cambio: ${formato(pagado - t.total)}`
  $('#cobrar').disabled = !carrito.length
  $('#cobrar').textContent = carrito.length ? `Cobrar ${formato(t.total)}` : 'Cobrar'
}

function cobrar() {
  intentar(() => {
    const r = cerrarVenta({
      carrito,
      productos: estado.productos,
      descuentoPct: Number($('#descuento').value) || 0,
      metodo,
      pagado: aCentavos($('#pagado').value || 0),
      numero: estado.ventas.length + 1,
    })
    estado = { productos: r.productos, ventas: [...estado.ventas, r.venta] }
    guardar(estado)
    mostrarTicket(r.venta)
    carrito = []
    $('#pagado').value = ''
    $('#descuento').value = 0
    dibujarCatalogo()
    dibujarCarrito()
  })
}

function mostrarTicket(v) {
  const f = new Date(v.fecha)
  $('#ticket').innerHTML = `<h3>MI TIENDA</h3><p>Ticket N.º ${String(v.numero).padStart(5, '0')}</p><p>${f.toLocaleDateString('es')} ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p><hr>
    <table>${v.lineas.map((l) => `<tr><td>${l.cantidad} × ${esc(l.nombre)}</td><td class="num">${formato(l.precio * l.cantidad)}</td></tr>`).join('')}</table><hr>
    <table><tr><td>Subtotal</td><td class="num">${formato(v.subtotal)}</td></tr>
    ${v.descuento ? `<tr><td>Descuento ${v.descuentoPct} %</td><td class="num">− ${formato(v.descuento)}</td></tr>` : ''}
    <tr class="fuerte"><td>TOTAL</td><td class="num">${formato(v.total)}</td></tr>
    <tr><td>Pago (${esc(v.metodo)})</td><td class="num">${formato(v.pagado)}</td></tr>
    ${v.cambio ? `<tr><td>Cambio</td><td class="num">${formato(v.cambio)}</td></tr>` : ''}</table><hr><p>¡Gracias por su compra!</p>`
  $('#modal-ticket').hidden = false
}

// ---------- ventas ----------
function dibujarVentas() {
  const hoy = diaLocal(new Date().toISOString())
  const r = reporteDelDia(estado.ventas, hoy)
  $('#kpis').innerHTML = [
    [r.ventas, 'ventas de hoy'],
    [formato(r.total), 'total vendido'],
    [formato(r.ticketPromedio), 'ticket promedio'],
    [Object.entries(r.porMetodo).map(([m, t]) => `${m}: ${formato(t)}`).join(' · ') || '—', 'por método de pago', true],
  ]
    .map(([valor, etiqueta, chico], i) => `<div class="kpi entra" style="animation-delay:${i * 60}ms"><b${chico ? ' style="font-size:1rem"' : ''}>${esc(valor)}</b><span>${etiqueta}</span></div>`)
    .join('')
  const delDia = estado.ventas.filter((v) => diaLocal(v.fecha) === hoy).reverse()
  $('#tabla-ventas').innerHTML =
    delDia
      .map(
        (v) => `<tr><td>${v.numero}</td><td>${new Date(v.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${esc(v.lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(', '))}</td><td><span class="chip">${esc(v.metodo)}</span></td><td class="num">${formato(v.total)}</td></tr>`,
      )
      .join('') || '<tr><td colspan="5" class="suave">Todavía no hay ventas hoy. Ve a «Vender» y cobra la primera.</td></tr>'
  const max = r.masVendidos[0]?.[1] || 1
  $('#mas-vendidos').innerHTML = r.masVendidos.map(([n, c]) => `<div class="barra-h" style="--p:${(c / max) * 100}%"><span>${esc(n)}</span><b>${c}</b><i></i></div>`).join('') || '<p class="suave">Sin datos todavía.</p>'
  $('#por-reponer').innerHTML =
    bajoStock(estado.productos)
      .map((p) => `<div class="fila" style="justify-content:space-between;margin-bottom:6px"><span>${esc(p.nombre)}</span><span class="chip ${p.stock === 0 ? 'peligro' : 'aviso'}">${p.stock === 0 ? 'Agotado' : `quedan ${p.stock}`}</span></div>`)
      .join('') || '<p class="suave">Todo con buen stock.</p>'
}

function exportar() {
  if (!estado.ventas.length) return avisar('No hay ventas para exportar.', true)
  const url = URL.createObjectURL(new Blob(['﻿' + aCsv(estado.ventas)], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `ventas-${diaLocal(new Date().toISOString())}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- productos ----------
function dibujarProductos() {
  $('#lista-categorias').innerHTML = [...new Set(estado.productos.map((p) => p.categoria))].map((c) => `<option value="${esc(c)}">`).join('')
  $('#tabla-productos').innerHTML = estado.productos
    .map(
      (p) => `<tr><td>${esc(p.nombre)}</td><td><span class="chip" style="--acento:${colorDe(p.categoria)}">${esc(p.categoria)}</span></td><td class="num">${formato(p.precio)}</td>
      <td class="num"><input type="number" min="0" value="${p.stock}" data-stock="${esc(p.id)}" aria-label="Stock de ${esc(p.nombre)}" style="width:80px;text-align:right"></td>
      <td class="num"><button class="chico fantasma" data-borrar="${esc(p.id)}">Quitar</button></td></tr>`,
    )
    .join('')
}

// ---------- eventos ----------
document.querySelectorAll('[data-vista]').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-selected', String(x === b)))
    for (const v of ['vender', 'ventas', 'productos']) $(`#vista-${v}`).hidden = v !== b.dataset.vista
    if (b.dataset.vista === 'ventas') dibujarVentas()
    if (b.dataset.vista === 'productos') dibujarProductos()
    if (b.dataset.vista === 'vender') dibujarCatalogo()
  }),
)
$('#buscar').addEventListener('input', dibujarCatalogo)
$('#categorias').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]')
  if (!b) return
  categoria = b.dataset.cat
  dibujarCatalogo()
})
$('#rejilla').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]')
  if (!b) return
  intentar(() => {
    carrito = agregar(carrito, estado.productos.find((p) => p.id === b.dataset.id))
    dibujarCarrito(true)
  })
})
$('#lineas').addEventListener('click', (e) => {
  const mas = e.target.closest('[data-mas]')?.dataset.mas
  const menos = e.target.closest('[data-menos]')?.dataset.menos
  const id = mas || menos
  if (!id) return
  intentar(() => {
    const linea = carrito.find((l) => l.id === id)
    carrito = cambiarCantidad(carrito, id, linea.cantidad + (mas ? 1 : -1), estado.productos.find((p) => p.id === id).stock)
    dibujarCarrito(true)
  })
})
$('#descuento').addEventListener('input', () => dibujarCarrito(true))
$('#pagado').addEventListener('input', () => dibujarCarrito())
document.querySelectorAll('[data-metodo]').forEach((b) =>
  b.addEventListener('click', () => {
    metodo = b.dataset.metodo
    document.querySelectorAll('[data-metodo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    dibujarCarrito()
  }),
)
$('#vaciar').addEventListener('click', () => {
  carrito = []
  dibujarCarrito()
})
$('#cobrar').addEventListener('click', cobrar)
$('#cerrar-ticket').addEventListener('click', () => ($('#modal-ticket').hidden = true))
$('#imprimir').addEventListener('click', () => window.print())
$('#exportar').addEventListener('click', exportar)
$('#form-producto').addEventListener('submit', (e) => {
  e.preventDefault()
  const d = Object.fromEntries(new FormData(e.target))
  const id = `${d.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`
  estado.productos = [...estado.productos, { id, nombre: d.nombre.trim(), categoria: d.categoria.trim(), precio: aCentavos(d.precio), stock: Math.max(0, Math.floor(Number(d.stock))) }]
  guardar(estado)
  e.target.reset()
  dibujarProductos()
  avisar('Producto agregado.')
})
$('#tabla-productos').addEventListener('change', (e) => {
  const id = e.target.dataset.stock
  if (!id) return
  estado.productos = estado.productos.map((p) => (p.id === id ? { ...p, stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : p))
  guardar(estado)
  avisar('Stock actualizado.')
})
$('#tabla-productos').addEventListener('click', (e) => {
  const id = e.target.closest('[data-borrar]')?.dataset.borrar
  if (!id) return
  estado.productos = estado.productos.filter((p) => p.id !== id)
  carrito = carrito.filter((l) => l.id !== id)
  guardar(estado)
  dibujarProductos()
})
$('#reiniciar').addEventListener('click', () => {
  if (!confirm('Se borrarán los productos y las ventas guardadas en este navegador y volverán los datos de ejemplo. ¿Continuar?')) return
  estado = reiniciar()
  carrito = []
  dibujarProductos()
  avisar('Datos de ejemplo restaurados.')
})

const reloj = () => ($('#reloj').textContent = new Date().toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
reloj()
setInterval(reloj, 30000)
dibujarCatalogo()
dibujarCarrito()

// Enlace de demostración (…/#demo): arranca con una venta a medio hacer para ver la caja en uso.
if (location.hash === '#demo') {
  for (const id of ['cafe', 'cafe', 'pan', 'pan', 'pan', 'leche', 'galletas']) {
    const prod = estado.productos.find((x) => x.id === id)
    if (prod) intentar(() => (carrito = agregar(carrito, prod)))
  }
  $('#pagado').value = 100
  dibujarCarrito()
}
