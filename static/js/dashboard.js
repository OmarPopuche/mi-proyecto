// ============================================================
// dashboard.js — FastFoot Admin Panel
// CAMBIOS EN ESTA VERSIÓN:
//   1. DashCharts RESTAURADO con initBarras() e initDoughnut()
//   2. DashProductos.agregar() ahora lee "prod-imagen" (URL)
//      y elimina toda referencia a categoria/_imagenPorCategoria
//   3. DashProductos._insertarFila() renderiza <img src=url>
//   4. MenuDinamico.init() usa p.imagen_url directamente
// ============================================================

"use strict";

// ============================================================
// 📦 DashUtils
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
// 📦 DashUI
// ============================================================
const DashUI = {

  activarNav(el) {
    document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));
    el.classList.add("active");
  },

  toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("collapsed");
  },

  activarTab(tabId, btnEl) {
    document.querySelectorAll(".tab-contenido").forEach(t => {
      t.style.display = "none";
    });
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(tabId).style.display = "block";
    btnEl.classList.add("active");
  },
};


// ============================================================
// 📦 DashCharts — ✅ RESTAURADO
//
// El problema original: este módulo no existía en dashboard.js.
// El HTML tenía los <canvas> con data-labels y data-values, pero
// nadie llamaba a initBarras() ni initDoughnut(), así que
// Chart.js nunca recibía los datos y los gráficos quedaban en blanco.
//
// Solución: restaurar el módulo completo y llamarlo en DOMContentLoaded.
// ============================================================
const DashCharts = {

  // Paleta de colores. Se cicla si hay más usuarios que colores.
  _colores: [
    "#06b1db", "#ff3b3b", "#ffd700", "#2ecc71",
    "#9b59b6", "#e67e22", "#1abc9c", "#e74c3c",
  ],

  /**
   * Lee los datos inyectados por Flask en atributos data-* del canvas.
   * Flask serializa las listas Python a JSON con el filtro |tojson,
   * así que JSON.parse() las convierte de vuelta a arrays JS.
   *
   * En el HTML:
   *   data-labels='{{ chart_labels | tojson }}'
   *   data-values='{{ chart_data  | tojson }}'
   *
   * @param {string} canvasId
   * @returns {{ labels: string[], values: number[] }}
   */
  _leerDatos(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) return { labels: [], values: [] };
    return {
      labels: JSON.parse(el.dataset.labels || "[]"),
      values: JSON.parse(el.dataset.values || "[]"),
    };
  },

  /**
   * Gráfico de barras: total de ventas por usuario.
   * Cada barra = un usuario, altura = S/ total gastado.
   */
  initBarras() {
    const ctx = document.getElementById("chartBarras");
    if (!ctx) return;

    const { labels, values } = this._leerDatos("chartBarras");

    // Si no hay pedidos, mostrar mensaje en lugar de gráfico vacío
    if (!labels.length) {
      ctx.parentElement.innerHTML +=
        '<p class="estado-vacio">Sin datos de ventas aún.</p>';
      ctx.style.display = "none";
      return;
    }

    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label:           "Total vendido (S/)",
          data:            values,
          backgroundColor: labels.map((_, i) =>
            this._colores[i % this._colores.length] + "CC"
          ),
          borderColor: labels.map((_, i) =>
            this._colores[i % this._colores.length]
          ),
          borderWidth:  2,
          borderRadius: 8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` S/ ${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => `S/ ${v}` },
          },
        },
      },
    });
  },

  /**
   * Gráfico doughnut: distribución porcentual de compras por usuario.
   * Cada segmento = un usuario, tamaño = % del total de ventas.
   */
  initDoughnut() {
    const ctx = document.getElementById("chartDoughnut");
    if (!ctx) return;

    const { labels, values } = this._leerDatos("chartDoughnut");

    if (!labels.length) {
      ctx.parentElement.innerHTML +=
        '<p class="estado-vacio">Sin datos de ventas aún.</p>';
      ctx.style.display = "none";
      return;
    }

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data:            values,
          backgroundColor: labels.map((_, i) =>
            this._colores[i % this._colores.length] + "DD"
          ),
          borderColor:  "#fff",
          borderWidth:  3,
          hoverOffset:  8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels:   { padding: 15, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` S/ ${ctx.parsed.toFixed(2)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  },
};


// ============================================================
// 📦 DashPedidos (sin cambios)
// ============================================================
const DashPedidos = {

  async cambiarEstado(lineIndex, estado, btnEl) {
    btnEl.disabled    = true;
    btnEl.textContent = "Procesando...";

    const data = await DashUtils.request("/api/pedido/estado", "POST", {
      line_index: lineIndex,
      estado,
    });

    if (data.ok) {
      DashUtils.mostrarMsg(data.mensaje, "ok");
      DashUtils.eliminarFilaConAnimacion(`fila-pedido-${lineIndex}`);
    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
      btnEl.disabled    = false;
      btnEl.textContent = "Confirmar ✅";
    }
  },
};


// ============================================================
// 📦 DashProductos — ✅ MODIFICADO
// Eliminada toda referencia a "categoria" y "_imagenPorCategoria".
// Ahora usa "imagen_url" como campo principal del producto.
// ============================================================
const DashProductos = {

  async agregar() {
    const nombre     = document.getElementById("prod-nombre").value.trim();
    const precioRaw  = document.getElementById("prod-precio").value;
    // ✅ Leer URL en lugar de categoría
    const imagen_url = document.getElementById("prod-imagen").value.trim();

    // ── Validaciones en frontend ──
    if (!nombre) {
      DashUtils.mostrarMsg("El nombre del producto es obligatorio.", "error");
      return;
    }

    const precio = parseFloat(precioRaw);
    if (isNaN(precio) || precio <= 0) {
      DashUtils.mostrarMsg("Ingresa un precio válido mayor a 0.", "error");
      return;
    }

    if (!imagen_url.startsWith("http")) {
      DashUtils.mostrarMsg("La URL de imagen debe empezar con http.", "error");
      return;
    }

    const data = await DashUtils.request("/api/productos", "POST", {
      nombre,
      precio,
      imagen_url,   // ✅ Campo renombrado (antes era "categoria")
    });

    if (data.ok) {
      DashUtils.mostrarMsg(data.mensaje, "ok");

      // Limpiar formulario
      document.getElementById("prod-nombre").value  = "";
      document.getElementById("prod-precio").value  = "";
      document.getElementById("prod-imagen").value  = "";

      // Insertar la nueva fila sin recargar
      this._insertarFila(data.producto);
    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
    }
  },

  /**
   * Inserta una fila en la tabla de productos del DOM.
   * ✅ MODIFICADO: columna "categoría" → columna "imagen" + "url".
   * Usa createElement para evitar XSS.
   *
   * @param {{ line_index, id_producto, nombre, precio, imagen_url }} producto
   */
  _insertarFila(producto) {
    const tbody = document.getElementById("tbody-productos");

    // Quitar el placeholder "no hay productos" si existe
    const placeholder = document.getElementById("fila-sin-productos");
    if (placeholder) placeholder.remove();

    const fila = document.createElement("tr");
    fila.id    = `fila-producto-${producto.line_index}`;

    // Celda: ID
    const tdId  = document.createElement("td");
    const code  = document.createElement("code");
    code.textContent = producto.id_producto;
    tdId.appendChild(code);

    // Celda: Imagen preview
    const tdImg = document.createElement("td");
    const img   = document.createElement("img");
    img.src     = producto.imagen_url;
    img.alt     = producto.nombre;
    img.className = "prod-thumb";
    // Fallback si la URL falla
    img.onerror = () => { img.src = "/static/img/hamburgesa.jpg"; };
    tdImg.appendChild(img);

    // Celda: Nombre
    const tdNombre = document.createElement("td");
    tdNombre.textContent = producto.nombre;

    // Celda: Precio
    const tdPrecio = document.createElement("td");
    tdPrecio.textContent = `S/ ${parseFloat(producto.precio).toFixed(2)}`;

    // Celda: URL truncada con link
    const tdUrl  = document.createElement("td");
    const link   = document.createElement("a");
    link.href    = producto.imagen_url;
    link.target  = "_blank";
    link.className = "link-url";
    link.title   = producto.imagen_url;
    link.textContent = producto.imagen_url.length > 35
      ? producto.imagen_url.slice(0, 35) + "…"
      : producto.imagen_url;
    tdUrl.appendChild(link);

    // Celda: Botón eliminar
    const tdAccion = document.createElement("td");
    const btn      = document.createElement("button");
    btn.className   = "btn-peligro-sm";
    btn.textContent = "🗑 Eliminar";
    btn.onclick = () => this.eliminar(producto.line_index, producto.nombre);
    tdAccion.appendChild(btn);

    fila.append(tdId, tdImg, tdNombre, tdPrecio, tdUrl, tdAccion);

    // Animación de entrada
    fila.style.opacity    = "0";
    fila.style.transform  = "translateY(-8px)";
    fila.style.transition = "opacity 0.35s, transform 0.35s";
    tbody.appendChild(fila);
    requestAnimationFrame(() => {
      fila.style.opacity   = "1";
      fila.style.transform = "translateY(0)";
    });
  },

  async eliminar(lineIndex, nombre) {
    if (!confirm(`¿Eliminar "${nombre}" del menú?`)) return;

    const data = await DashUtils.request(`/api/productos/${lineIndex}`, "DELETE");

    if (data.ok) {
      DashUtils.mostrarMsg(`${data.mensaje} Actualizando tabla...`, "ok");
      // Recargar para resincronizar line_index de todos los productos
      setTimeout(() => location.reload(), 1500);
    } else {
      DashUtils.mostrarMsg(data.mensaje, "error");
    }
  },
};


// ============================================================
// 📦 DashUsuarios (sin cambios)
// ============================================================
const DashUsuarios = {
  async eliminar(codigo, nombre) {
    if (!confirm(`¿Eliminar a ${nombre} (${codigo})?`)) return;
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
// 📦 MenuDinamico — ✅ MODIFICADO
// Eliminado _imagenPorCategoria().
// img.src = p.imagen_url directamente desde la API.
// Solo activo en index.html (detecta #grid-productos).
// ============================================================
const MenuDinamico = {

  async init() {
    const grid = document.getElementById("grid-productos");
    if (!grid) return;  // No estamos en index.html

    // Mostrar estado de carga
    grid.innerHTML = '<p style="color:#aaa;text-align:center;width:100%;">Cargando menú...</p>';

    let data;
    try {
      const res = await fetch("/api/productos");
      data = await res.json();
    } catch {
      grid.innerHTML = '<p style="color:#e02e2e;text-align:center;width:100%;">Error al cargar el menú.</p>';
      return;
    }

    if (!data.ok || !data.productos.length) {
      grid.innerHTML = '<p style="color:#aaa;text-align:center;width:100%;">Menú no disponible por el momento.</p>';
      return;
    }

    grid.innerHTML = "";

    data.productos.forEach(p => {
      // ✅ Construcción con createElement (sin innerHTML, sin XSS)
      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      // ✅ La URL viene directamente del campo imagen_url del txt.
      // Ya no hay mapeo estático por categoría.
      img.src   = p.imagen_url || "/static/img/hamburgesa.jpg";
      img.alt   = p.nombre;
      // Fallback: si la URL externa falla, usa imagen local
      img.onerror = () => { img.src = "/static/img/hamburgesa.jpg"; };

      const h3 = document.createElement("h3");
      h3.textContent = p.nombre;

      const precio = document.createElement("p");
      precio.className   = "precio";
      precio.textContent = `S/. ${p.precio.toFixed(2)}`;

      const btn = document.createElement("button");
      btn.className   = "btn-agregar";
      btn.textContent = "Agregar";
      // Pasa nombre y precio reales del archivo al carrito
      btn.onclick = () => {
        // Carrito vive en script.js; llamamos la función global
        if (typeof agregarCarrito === "function") {
          agregarCarrito(p.nombre, p.precio);
        }
      };

      card.append(img, h3, precio, btn);
      grid.appendChild(card);
    });
  },
};


// ============================================================
// 🔹 Funciones globales expuestas al HTML (onclick="...")
// ============================================================
function activarNav(el)                             { DashUI.activarNav(el); }
function toggleSidebar()                            { DashUI.toggleSidebar(); }
function activarTab(tabId, btnEl)                   { DashUI.activarTab(tabId, btnEl); }
function cambiarEstadoPedido(lineIndex, estado, btn){ DashPedidos.cambiarEstado(lineIndex, estado, btn); }
function eliminarUsuario(codigo, nombre)             { DashUsuarios.eliminar(codigo, nombre); }
function agregarProducto()                          { DashProductos.agregar(); }
function eliminarProducto(lineIndex, nombre)         { DashProductos.eliminar(lineIndex, nombre); }


// ============================================================
// 🔹 INICIALIZACIÓN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

  // ✅ Dashboard: inicializar gráficos
  // Antes faltaba esta llamada — esa era la causa de la regresión
  DashCharts.initBarras();
  DashCharts.initDoughnut();

  // Index.html: cargar menú dinámico
  MenuDinamico.init();
});