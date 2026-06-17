// ============================================================
// script.js — FastFoot Cliente (index.html)
// Omar Vilela | Full-Stack Engineer
//
// Módulos:
//   App         — estado central (carrito + usuario)
//   Utils       — fetch helper y mensajes
//   UI          — toggles de paneles y vistas
//   Auth        — login, registro, modificar, logout
//   Carrito     — agregar, cambiar cantidad, eliminar, confirmar
//   MenuDinamico — renderiza el catálogo desde /api/productos
//
// ✅ Sin _imagenPorCategoria().
// ✅ img.src = p.imagen_url directamente desde el backend.
// ✅ sessionStorage para el carrito (ciclo de vida correcto).
// ============================================================

"use strict";

// ============================================================
// 📦 App — Estado central
// ============================================================
const App = {
  // sessionStorage: el carrito vive en esta pestaña/sesión.
  // Se limpia automáticamente al cerrar el navegador.
  carrito: JSON.parse(sessionStorage.getItem("ff_carrito")) || [],

  // Usuario activo — se carga desde el DOM en DOMContentLoaded
  usuario: null,
};


// ============================================================
// 📦 Utils — Helpers compartidos
// ============================================================
const Utils = {

  /**
   * Muestra un mensaje temporal en el panel de login.
   * @param {string} texto
   * @param {boolean} esError
   */
  mostrarMensaje(texto, esError = false) {
    const el = document.getElementById("login-mensaje");
    if (!el) return;
    el.textContent   = texto;
    el.style.display = "block";
    el.style.color   = esError ? "#e02e2e" : "#06b1db";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  },

  /**
   * Wrapper de fetch para peticiones JSON al backend.
   * Centraliza headers y manejo básico de errores de red.
   * @param {string} url
   * @param {object} body
   * @returns {Promise<object>}
   */
  async postJSON(url, body) {
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      console.error(`[Utils.postJSON] Error en ${url}:`, err);
      return { ok: false, mensaje: "Error de conexión con el servidor." };
    }
  },
};


// ============================================================
// 📦 UI — Navegación y paneles
// ============================================================
const UI = {

  toggleCarrito() {
    document.getElementById("carrito").classList.toggle("active");
  },

  toggleLogin() {
    document.getElementById("panel-login").classList.toggle("active");
  },

  toggleMenu() {
    document.getElementById("menu").classList.toggle("active");
  },

  /**
   * Muestra una vista del panel de login, oculta el resto.
   * @param {'inicial'|'login'|'registro'|'usuario'} nombre
   */
  mostrarVista(nombre) {
    ["inicial", "login", "registro", "usuario"].forEach(v => {
      const el = document.getElementById(`vista-${v}`);
      if (el) el.style.display = v === nombre ? "block" : "none";
    });
  },

  volver() {
    this.mostrarVista("inicial");
    Utils.mostrarMensaje("", false);
  },

  /**
   * Lee los datos de sesión del elemento DOM inyectado por Flask
   * y los guarda en App.usuario.
   * Este patrón evita contaminar el scope global con variables
   * de Python embebidas en JS.
   */
  actualizarNavbar() {
    const el = document.getElementById("session-data");
    if (el) {
      App.usuario = {
        codigo:    el.dataset.codigo,
        nombres:   el.dataset.nombres,
        apellidos: el.dataset.apellidos,
      };
    }
  },
};


// ============================================================
// 📦 Auth — Autenticación y perfil de usuario
// ============================================================
const Auth = {

  async login() {
    const codigo = document.getElementById("login-codigo").value.trim();
    if (!codigo) {
      Utils.mostrarMensaje("Ingresa tu código.", true);
      return;
    }
    const data = await Utils.postJSON("/api/usuario", { accion: "login", codigo });
    if (data.ok) {
      // Recargar para que Flask regenere el template con sesión activa
      // (muestra saludo en navbar, link al dashboard para 001, etc.)
      location.reload();
    } else {
      Utils.mostrarMensaje(data.mensaje, true);
    }
  },

  async registrar() {
    const codigo    = document.getElementById("reg-codigo").value.trim();
    const nombres   = document.getElementById("reg-nombre").value.trim();
    const apellidos = document.getElementById("reg-apellido").value.trim();

    if (!codigo || !nombres || !apellidos) {
      Utils.mostrarMensaje("Todos los campos son obligatorios.", true);
      return;
    }

    const data = await Utils.postJSON("/api/usuario", {
      accion: "registrar", codigo, nombres, apellidos,
    });

    if (data.ok) {
      Utils.mostrarMensaje("¡Registrado! Ahora puedes iniciar sesión.", false);
      ["reg-codigo", "reg-nombre", "reg-apellido"].forEach(id => {
        document.getElementById(id).value = "";
      });
      UI.mostrarVista("login");
    } else {
      Utils.mostrarMensaje(data.mensaje, true);
    }
  },

  /**
   * Modifica los datos del usuario logueado.
   * El backend valida que el código de sesión coincida
   * con el código enviado — no hay forma de modificar
   * datos de otro usuario desde aquí.
   */
  async modificarUsuario() {
    if (!App.usuario) {
      Utils.mostrarMensaje("No hay sesión activa.", true);
      return;
    }
    const nombres   = document.getElementById("edit-nombres").value.trim();
    const apellidos = document.getElementById("edit-apellidos").value.trim();

    if (!nombres || !apellidos) {
      Utils.mostrarMensaje("Nombres y apellidos son obligatorios.", true);
      return;
    }

    const data = await Utils.postJSON("/api/usuario", {
      accion: "modificar",
      codigo: App.usuario.codigo,
      nombres,
      apellidos,
    });

    if (data.ok) {
      Utils.mostrarMensaje("¡Datos actualizados!", false);
      document.getElementById("usuario-nombre").textContent =
        `${data.usuario.nombres} ${data.usuario.apellidos}`;
      App.usuario = data.usuario;
    } else {
      Utils.mostrarMensaje(data.mensaje, true);
    }
  },

  async logout() {
    await Utils.postJSON("/api/usuario", { accion: "logout" });
    sessionStorage.removeItem("ff_carrito");
    location.reload();
  },

  modoInvitado() {
    UI.toggleLogin();
  },

  /** Precarga los campos del formulario de edición con los datos actuales */
  cargarDatosEdicion() {
    if (!App.usuario) return;
    const elNombre = document.getElementById("usuario-nombre");
    const elCodigo = document.getElementById("usuario-codigo-display");
    const elNombres   = document.getElementById("edit-nombres");
    const elApellidos = document.getElementById("edit-apellidos");
    if (elNombre)    elNombre.textContent   = `${App.usuario.nombres} ${App.usuario.apellidos}`;
    if (elCodigo)    elCodigo.textContent   = `Código: ${App.usuario.codigo}`;
    if (elNombres)   elNombres.value        = App.usuario.nombres;
    if (elApellidos) elApellidos.value      = App.usuario.apellidos;
  },
};


// ============================================================
// 📦 Carrito — Lógica de compras
// ============================================================
const Carrito = {

  _guardar() {
    sessionStorage.setItem("ff_carrito", JSON.stringify(App.carrito));
  },

  _actualizarBadge() {
    const badge = document.getElementById("carrito-badge");
    if (!badge) return;
    const total = App.carrito.reduce((acc, p) => acc + p.cantidad, 0);
    badge.textContent    = total;
    badge.style.display  = total > 0 ? "inline-block" : "none";
  },

  /**
   * Agrega un producto al carrito o incrementa su cantidad.
   * @param {string} nombre
   * @param {number} precio
   */
  agregar(nombre, precio) {
    const existente = App.carrito.find(p => p.nombre === nombre);
    if (existente) {
      existente.cantidad++;
    } else {
      App.carrito.push({ nombre, precio, cantidad: 1 });
    }
    this._guardar();
    this.render();
    // UX: abrir el carrito automáticamente al agregar
    document.getElementById("carrito").classList.add("active");
  },

  /**
   * Incrementa o decrementa la cantidad de un producto.
   * Si llega a 0, lo elimina del carrito.
   * @param {string} nombre
   * @param {number} cambio  +1 o -1
   */
  cambiarCantidad(nombre, cambio) {
    const idx = App.carrito.findIndex(p => p.nombre === nombre);
    if (idx === -1) return;
    App.carrito[idx].cantidad += cambio;
    if (App.carrito[idx].cantidad <= 0) {
      App.carrito.splice(idx, 1);
    }
    this._guardar();
    this.render();
  },

  eliminar(nombre) {
    App.carrito = App.carrito.filter(p => p.nombre !== nombre);
    this._guardar();
    this.render();
  },

  /**
   * Renderiza los ítems del carrito en el DOM.
   * ✅ Usa createElement en lugar de innerHTML+= para evitar XSS.
   */
  render() {
    const contenedor = document.getElementById("carrito-items");
    const totalEl    = document.getElementById("total");
    if (!contenedor || !totalEl) return;

    contenedor.innerHTML = "";

    if (App.carrito.length === 0) {
      contenedor.innerHTML =
        '<p class="carrito-vacio">Tu carrito está vacío 🛒</p>';
      totalEl.textContent = "0.00";
      this._actualizarBadge();
      return;
    }

    let total = 0;

    App.carrito.forEach(p => {
      total += p.precio * p.cantidad;

      const item = document.createElement("div");
      item.className = "item";

      // Fila superior: nombre + precio unitario
      const info = document.createElement("div");
      info.className = "item-info";

      const nombre = document.createElement("strong");
      nombre.textContent = p.nombre;

      const precio = document.createElement("span");
      precio.textContent = `S/ ${p.precio.toFixed(2)}`;

      info.append(nombre, precio);

      // Fila inferior: controles de cantidad
      const acciones = document.createElement("div");
      acciones.className = "acciones";

      const btnMas = document.createElement("button");
      btnMas.className   = "btn-cantidad";
      btnMas.textContent = "+";
      btnMas.onclick     = () => this.cambiarCantidad(p.nombre, 1);

      const cantSpan = document.createElement("span");
      cantSpan.className   = "cantidad";
      cantSpan.textContent = p.cantidad;

      const btnMenos = document.createElement("button");
      btnMenos.className   = "btn-cantidad";
      btnMenos.textContent = "−";
      btnMenos.onclick     = () => this.cambiarCantidad(p.nombre, -1);

      const btnElim = document.createElement("button");
      btnElim.className   = "btn-eliminar";
      btnElim.textContent = "✖";
      btnElim.onclick     = () => this.eliminar(p.nombre);

      acciones.append(btnMas, cantSpan, btnMenos, btnElim);
      item.append(info, acciones);
      contenedor.appendChild(item);
    });

    totalEl.textContent = total.toFixed(2);
    this._actualizarBadge();
  },

  /**
   * Confirma el pedido enviando el carrito al backend.
   * Requiere sesión activa (no invitado, no sin sesión).
   */
  async confirmar() {
    const sinSesion  = !App.usuario;
    const esInvitado = App.usuario && App.usuario.codigo === "0000";

    if (sinSesion || esInvitado) {
      alert("Debes iniciar sesión para confirmar un pedido.");
      document.getElementById("carrito").classList.remove("active");
      UI.toggleLogin();
      return;
    }

    if (App.carrito.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }

    const data = await Utils.postJSON("/api/pedido", { items: App.carrito });

    if (data.ok) {
      alert(`¡${data.mensaje}\nGracias, ${App.usuario.nombres}!`);
      App.carrito = [];
      this._guardar();
      this.render();
      document.getElementById("carrito").classList.remove("active");
    } else {
      alert(data.mensaje);
    }
  },
};


// ============================================================
// 📦 MenuDinamico — Renderiza el catálogo desde /api/productos
//
// ✅ CAMBIO PRINCIPAL DE ESTA VERSIÓN:
//    img.src = p.imagen_url  (URL directa del txt)
//    Eliminado _imagenPorCategoria() por completo.
//    Fallback: si imagen_url está vacío o la URL falla,
//    se usa la imagen local de respaldo.
// ============================================================
const MenuDinamico = {

  FALLBACK_IMG: "/static/img/hamburgesa.jpg",

  async init() {
    const grid = document.getElementById("grid-productos");
    // Si no existe el contenedor, no estamos en index.html → salir
    if (!grid) return;

    // Mostrar estado de carga mientras llega la respuesta
    grid.innerHTML =
      '<p class="cargando-menu">Cargando menú...</p>';

    let data;
    try {
      const res = await fetch("/api/productos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error("[MenuDinamico] Error al cargar productos:", err);
      grid.innerHTML =
        '<p class="error-menu">No se pudo cargar el menú. Intenta más tarde.</p>';
      return;
    }

    // Limpiar el contenedor siempre antes de renderizar
    grid.innerHTML = "";

    if (!data.ok || !Array.isArray(data.productos) || data.productos.length === 0) {
      grid.innerHTML =
        '<p class="cargando-menu">El menú no está disponible por el momento.</p>';
      return;
    }

    data.productos.forEach(p => this._crearCard(grid, p));
  },

  /**
   * Crea y monta una card de producto en el grid.
   * ✅ Usa createElement (no innerHTML) para evitar XSS.
   * ✅ img.src viene de p.imagen_url — campo del txt.
   *
   * @param {HTMLElement} grid  — el contenedor #grid-productos
   * @param {object}      p    — { nombre, precio, imagen_url, ... }
   */
  _crearCard(grid, p) {
    const card = document.createElement("div");
    card.className = "card";

    // ── Imagen ──────────────────────────────────────────────
    const img = document.createElement("img");
    // ✅ Asignación directa de la URL que viene del backend.
    // Si el producto no tiene URL (dato legacy), usa el fallback local.
    img.src = p.imagen_url && p.imagen_url.startsWith("http")
      ? p.imagen_url
      : this.FALLBACK_IMG;
    img.alt    = p.nombre;
    img.loading = "lazy";   // Carga diferida para mejor rendimiento
    // Si la URL de internet falla (imagen eliminada, 404, etc.)
    // el navegador dispara onerror y asignamos el fallback local.
    img.onerror = () => { img.src = this.FALLBACK_IMG; };

    // ── Nombre ──────────────────────────────────────────────
    const h3 = document.createElement("h3");
    h3.textContent = p.nombre;

    // ── Precio ──────────────────────────────────────────────
    const precioEl = document.createElement("p");
    precioEl.className   = "precio";
    precioEl.textContent = `S/. ${parseFloat(p.precio).toFixed(2)}`;

    // ── Botón Agregar ────────────────────────────────────────
    const btn = document.createElement("button");
    btn.className   = "btn-agregar";
    btn.textContent = "Agregar";
    // Captura p.nombre y p.precio en el closure correcto
    btn.onclick = () => Carrito.agregar(p.nombre, p.precio);

    card.append(img, h3, precioEl, btn);
    grid.appendChild(card);
  },
};


// ============================================================
// 🔹 Funciones globales — expuestas para onclick="" en el HTML
// ============================================================

// UI
function toggleCarrito()    { UI.toggleCarrito(); }
function toggleLogin()      { UI.toggleLogin(); }
function toggleMenu()       { UI.toggleMenu(); }
function mostrarVista(v)    { UI.mostrarVista(v); }
function volver()           { UI.volver(); }

// Auth
function login()            { Auth.login(); }
function registrar()        { Auth.registrar(); }
function logout()           { Auth.logout(); }
function modoInvitado()     { Auth.modoInvitado(); }
function modificarUsuario() { Auth.modificarUsuario(); }

// Carrito
function agregarCarrito(n, p) { Carrito.agregar(n, p); }
function confirmarPedido()    { Carrito.confirmar(); }


// ============================================================
// 🔹 Inicialización — ejecuta al cargar el DOM
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

  // 1. Leer sesión inyectada por Flask en el DOM
  UI.actualizarNavbar();

  // 2. Si hay sesión activa, precargar datos en el panel de usuario
  if (App.usuario) {
    Auth.cargarDatosEdicion();
    UI.mostrarVista("usuario");
  }

  // 3. Renderizar carrito guardado en sessionStorage
  Carrito.render();

  // 4. ✅ Cargar el menú dinámico desde la API
  //    (solo activo si existe #grid-productos en el DOM)
  MenuDinamico.init();
});