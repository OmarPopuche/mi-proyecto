"use strict";

// ============================================================
// 📦 DashUtils — Sin cambios respecto a versión anterior
// ============================================================
const DashUtils = {

  mostrarMsg(texto, tipo = "ok") {
    const el = document.getElementById("msg-global");
    el.textContent   = texto;
    el.className     = `msg-global msg-${tipo}`;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4500);
  },

  async request(url, method = "GET", body = null) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
  },

  eliminarFilaConAnimacion(filaId) {
    const fila = document.getElementById(filaId);
    if (!fila) return;
    fila.style.transition = "opacity 0.4s, transform 0.4s";
    fila.style.opacity    = "0";
    fila.style.transform  = "translateX(20px)";
    setTimeout(() => fila.remove(), 420);
  },
};


// ============================================================
// 📦 DashPedidos — CORREGIDO
// Ahora envía line_index al backend, no un campo "id" inventado.
// ============================================================
const DashPedidos = {

  /**
   * Cambia el estado de un pedido.
   *
   * @param {number} lineIndex - Índice de línea en pedidos.txt
   *                             (viene de {{ p.line_index }} en el HTML)
   * @param {string} estado    - "confirmado" | "espera"
   * @param {HTMLElement} btnEl - Botón que disparó la acción
   */
  async cambiarEstado(lineIndex, estado, btnEl) {
    // UX: deshabilitar el botón inmediatamente para evitar doble clic
    btnEl.disabled    = true;
    btnEl.textContent = "Procesando...";

    const data = await DashUtils.request("/api/pedido/estado", "POST", {
      line_index: lineIndex,   // ✅ nombre del campo que el backend espera
      estado,
    });

    if (data.ok) {
      DashUtils.mostrarMsg(data.mensaje, "ok");
      // Animar y remover la fila del tab actual
      DashUtils.eliminarFilaConAnimacion(`fila-pedido-${lineIndex}`);
    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
      // Rehabilitar el botón si hubo error
      btnEl.disabled    = false;
      btnEl.textContent = "Confirmar ✅";
    }
  },
};


// ============================================================
// 📦 DashProductos — COMPLETO Y CORREGIDO
// ============================================================
const DashProductos = {

  /**
   * Llama al backend para agregar un producto nuevo.
   * Si tiene éxito, inserta la fila en el DOM sin recargar.
   */
  async agregar() {
    const nombre    = document.getElementById("prod-nombre").value.trim();
    const precioRaw = document.getElementById("prod-precio").value;
    const categoria = document.getElementById("prod-categoria").value;

    // ── Validación en frontend ──
    if (!nombre) {
      DashUtils.mostrarMsg("El nombre del producto es obligatorio.", "error");
      return;
    }

    const precio = parseFloat(precioRaw);
    if (isNaN(precio) || precio <= 0) {
      DashUtils.mostrarMsg("Ingresa un precio válido mayor a 0.", "error");
      return;
    }

    const data = await DashUtils.request("/api/productos", "POST", {
      nombre, precio, categoria,
    });

    if (data.ok) {
      DashUtils.mostrarMsg(data.mensaje, "ok");

      // Limpiar el formulario
      document.getElementById("prod-nombre").value = "";
      document.getElementById("prod-precio").value = "";

      // ✅ Insertar fila dinámicamente con createElement (sin innerHTML)
      this._insertarFila(data.producto);

    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
    }
  },

  /**
   * Inserta una fila nueva en la tabla de productos del DOM.
   * Usa createElement para evitar XSS con datos del formulario.
   *
   * @param {{ line_index, id_producto, nombre, precio, categoria }} producto
   */
  _insertarFila(producto) {
    const tbody = document.getElementById("tbody-productos");

    // Si existía el placeholder "no hay productos", quitarlo
    const placeholder = document.getElementById("fila-sin-productos");
    if (placeholder) placeholder.remove();

    const fila = document.createElement("tr");
    fila.id = `fila-producto-${producto.line_index}`;

    // ── Celda: ID ──
    const tdId   = document.createElement("td");
    const code   = document.createElement("code");
    code.textContent = producto.id_producto;
    tdId.appendChild(code);

    // ── Celda: Nombre ──
    const tdNombre = document.createElement("td");
    tdNombre.textContent = producto.nombre;

    // ── Celda: Precio ──
    const tdPrecio = document.createElement("td");
    tdPrecio.textContent = `S/ ${parseFloat(producto.precio).toFixed(2)}`;

    // ── Celda: Categoría ──
    const tdCat  = document.createElement("td");
    const badge  = document.createElement("span");
    badge.className   = "badge-categoria";
    badge.textContent = producto.categoria;
    tdCat.appendChild(badge);

    // ── Celda: Acción ──
    const tdAccion = document.createElement("td");
    const btn      = document.createElement("button");
    btn.className   = "btn-peligro-sm";
    btn.textContent = "🗑 Eliminar";
    btn.onclick = () => this.eliminar(producto.line_index, producto.nombre);
    tdAccion.appendChild(btn);

    fila.append(tdId, tdNombre, tdPrecio, tdCat, tdAccion);

    // Animación de entrada
    fila.style.opacity   = "0";
    fila.style.transform = "translateY(-8px)";
    fila.style.transition = "opacity 0.35s, transform 0.35s";
    tbody.appendChild(fila);

    // Forzar reflow para que la transición funcione
    requestAnimationFrame(() => {
      fila.style.opacity   = "1";
      fila.style.transform = "translateY(0)";
    });
  },

  /**
   * Elimina un producto llamando a DELETE /api/productos/<line_index>.
   * Usa el line_index que el backend asignó al leer el archivo.
   *
   * ⚠️  Limitación conocida del sistema de IDs por índice de línea:
   * Si eliminas el producto en línea 2, el producto que era línea 3
   * ahora es línea 2. Los botones de la tabla ya renderizada quedan
   * desincronizados. La solución UX es recargar la página después
   * de cada eliminación, o reconstruir toda la tabla vía API.
   * Aquí optamos por recargar: es lo más seguro con archivos txt.
   *
   * @param {number} lineIndex
   * @param {string} nombre
   */
  async eliminar(lineIndex, nombre) {
    if (!confirm(`¿Eliminar "${nombre}" del menú? Esta acción no se puede deshacer.`)) return;

    const data = await DashUtils.request(`/api/productos/${lineIndex}`, "DELETE");

    if (data.ok) {
      DashUtils.mostrarMsg(`${data.mensaje} Actualizando tabla...`, "ok");
      // ✅ Recargar la página para resincronizar todos los line_index
      // Es el comportamiento más correcto con un sistema de IDs por índice.
      setTimeout(() => location.reload(), 1500);
    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
    }
  },
};


// ============================================================
// 📦 DashUsuarios
// ============================================================
const DashUsuarios = {
  async eliminar(codigo, nombre) {
    if (!confirm(`¿Eliminar a ${nombre} (${codigo})? Esta acción no se puede deshacer.`)) return;
    const data = await DashUtils.request("/api/usuario", "POST", {
      accion: "eliminar", codigo_objetivo: codigo,
    });
    if (data.ok) {
      DashUtils.mostrarMsg(data.mensaje, "ok");
      DashUtils.eliminarFilaConAnimacion(`fila-usuario-${codigo}`);
    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
    }
  },
};


// ============================================================
// 🔹 Funciones globales expuestas al HTML
// ============================================================
function activarNav(el)                        { DashUI.activarNav(el); }
function toggleSidebar()                       { DashUI.toggleSidebar(); }
function activarTab(tabId, btnEl)              { DashUI.activarTab(tabId, btnEl); }

// ✅ CORREGIDO: recibe lineIndex (no pedidoId)
function cambiarEstadoPedido(lineIndex, estado, btn) {
  DashPedidos.cambiarEstado(lineIndex, estado, btn);
}

function eliminarUsuario(codigo, nombre)       { DashUsuarios.eliminar(codigo, nombre); }
function agregarProducto()                     { DashProductos.agregar(); }
function eliminarProducto(lineIndex, nombre)   { DashProductos.eliminar(lineIndex, nombre); }


// ============================================================
// 🔹 INICIO — Menú dinámico en index.html
// ============================================================

/**
 * Módulo separado para el sitio público (index.html).
 * Carga los productos desde la API y renderiza las cards del menú.
 * Solo se activa si existe el contenedor #grid-productos en la página.
 */
const MenuDinamico = {

  async init() {
    const grid = document.getElementById("grid-productos");
    if (!grid) return;   // No estamos en index.html, salir

    const data = await fetch("/api/productos").then(r => r.json());

    if (!data.ok || !data.productos.length) {
      grid.innerHTML = '<p class="estado-vacio">Menú no disponible por el momento.</p>';
      return;
    }

    grid.innerHTML = "";   // Limpiar el contenedor

    data.productos.forEach(p => {
      // ✅ createElement para evitar XSS con datos del servidor
      const card = document.createElement("div");
      card.className = "card";

      const img  = document.createElement("img");
      // Imagen genérica por categoría; en producción vendría del txt
      img.src = `/static/img/${this._imagenPorCategoria(p.categoria)}`;
      img.alt = p.nombre;

      const h3   = document.createElement("h3");
      h3.textContent = p.nombre;

      const precio = document.createElement("p");
      precio.className   = "precio";
      precio.textContent = `S/. ${p.precio.toFixed(2)}`;

      const btn  = document.createElement("button");
      btn.className   = "btn-agregar";
      btn.textContent = "Agregar";
      // Pasa nombre y precio real del archivo al carrito
      btn.onclick = () => Carrito.agregar(p.nombre, p.precio);

      card.append(img, h3, precio, btn);
      grid.appendChild(card);
    });
  },

  /** Mapea categoría a nombre de archivo de imagen */
  _imagenPorCategoria(categoria) {
    const mapa = {
      "Principales":  "1a4pollo.webp",
      "Complementos": "Salchipapa.webp",
      "Bebidas":      "bebida.png",
      "Postres":      "postre.png",
      "Combos":       "hamburgesa.jpg",
      "General":      "hamburgesa.jpg",
    };
    return mapa[categoria] || "hamburgesa.jpg";
  },
};


// ============================================================
// 🔹 INICIALIZACIÓN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Dashboard: inicializar gráficos si existen los canvas
  if (typeof DashCharts !== "undefined") {
    DashCharts.initBarras();
    DashCharts.initDoughnut();
  }

  // Index: cargar menú dinámico si hay grid
  MenuDinamico.init();

  // Index: leer usuario de sesión y renderizar carrito
  if (typeof UI !== "undefined")      UI.actualizarNavbar();
  if (typeof Auth !== "undefined")    Auth.cargarDatosEdicion();
  if (typeof Carrito !== "undefined") Carrito.render();
});