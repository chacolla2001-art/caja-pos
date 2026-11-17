// Datos de ejemplo y guardado en el navegador (localStorage). Los precios van en centavos.
const CLAVE = 'caja-pos-v1'

const COLORES = { Bebidas: '#3b82f6', Panadería: '#f59e0b', Abarrotes: '#22c55e', Lácteos: '#a855f7', Limpieza: '#06b6d4', Snacks: '#ef4444' }
export const colorDe = (categoria) => COLORES[categoria] ?? '#64748b'

const p = (id, nombre, categoria, precio, stock) => ({ id, nombre, categoria, precio, stock })
export const PRODUCTOS_EJEMPLO = [
  p('cafe', 'Café molido 250 g', 'Abarrotes', 3200, 14),
  p('azucar', 'Azúcar 1 kg', 'Abarrotes', 750, 30),
  p('arroz', 'Arroz 1 kg', 'Abarrotes', 900, 26),
  p('fideo', 'Fideo 400 g', 'Abarrotes', 650, 4),
  p('pan', 'Pan marraqueta', 'Panadería', 50, 120),
  p('empanada', 'Empanada de queso', 'Panadería', 500, 18),
  p('gaseosa', 'Gaseosa 2 L', 'Bebidas', 1300, 22),
  p('agua', 'Agua 600 ml', 'Bebidas', 400, 40),
  p('jugo', 'Jugo de durazno 1 L', 'Bebidas', 1100, 3),
  p('leche', 'Leche 1 L', 'Lácteos', 700, 20),
  p('yogur', 'Yogur bebible', 'Lácteos', 550, 12),
  p('queso', 'Queso criollo 500 g', 'Lácteos', 2800, 6),
  p('detergente', 'Detergente 1 kg', 'Limpieza', 1900, 9),
  p('jabon', 'Jabón de tocador', 'Limpieza', 450, 25),
  p('galletas', 'Galletas surtidas', 'Snacks', 600, 34),
  p('chocolate', 'Chocolate en barra', 'Snacks', 800, 2),
]

export function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE))
    if (guardado?.productos?.length) return guardado
  } catch {
    /* almacenamiento vacío o dañado: se empieza con los datos de ejemplo */
  }
  return { productos: PRODUCTOS_EJEMPLO.map((x) => ({ ...x })), ventas: [] }
}

export function guardar(estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ productos: estado.productos, ventas: estado.ventas }))
  } catch {
    /* sin almacenamiento (modo privado): la caja sigue funcionando en memoria */
  }
}

export function reiniciar() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada que borrar */
  }
  return cargar()
}
