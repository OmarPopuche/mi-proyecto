// ============================================================
// script.js — Bazar de Omar (Cliente)
// Omar Vilela | Full-Stack Engineer
//
// ✅ Migración de marca: FastFoot → Bazar de Omar.
// Sin cambios de arquitectura: mismos módulos, mismo flujo
// de sessionStorage para el carrito, mismo fetch a /api/productos.
// ============================================================

"use strict";

const App = {
  carrito: JSON.parse(sessionStorage.getItem("bazar_carrito")) || [],
  usuario: null,
};

const Utils = {

  mostrarMensaje(texto, esError = false) {
    const el = document.getElementById("login-mensaje");
    if (!el) return;
    el.textContent   = texto;
    el.style.display = "block";
    el.style.color   = esError ? "#c0392b" : "#6A1B9A";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  },

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

const UI = {
  toggleCarrito() { document.getElementById("carrito").classList.toggle("active"); },
  toggleLogin()   { document.getElementById("panel-login").classList.toggle("active"); },
  toggleMenu()    { document.getElementById("menu").classList.toggle("active"); },

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

const Auth = {

  async login() {
    const codigo = document.getElementById("login-codigo").value.trim();
    if (!codigo) {
      Utils.mostrarMensaje("Ingresa tu código.", true);
      return;
    }
    const data = await Utils.postJSON("/api/usuario", { accion: "login", codigo });
    if (data.ok) {
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
      Utils.mostrarMensaje("¡Bienvenido al Bazar de Omar! Ya puedes iniciar sesión.", false);
      ["reg-codigo", "reg-nombre", "reg-apellido"].forEach(id => {
        document.getElementById(id).value = "";
      });
      UI.mostrarVista("login");
    } else {
      Utils.mostrarMensaje(data.mensaje, true);
    }
  },

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
      accion: "modificar", codigo: App.usuario.codigo, nombres, apellidos,
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
    sessionStorage.removeItem("bazar_carrito");
    location.reload();
  },

  modoInvitado() { UI.toggleLogin(); },

  cargarDatosEdicion() {
    if (!App.usuario) return;
    const elNombre     = document.getElementById("usuario-nombre");
    const elCodigo     = document.getElementById("usuario-codigo-display");
    const elNombres    = document.getElementById("edit-nombres");
    const elApellidos  = document.getElementById("edit-apellidos");
    if (elNombre)    elNombre.textContent  = `${App.usuario.nombres} ${App.usuario.apellidos}`;
    if (elCodigo)    elCodigo.textContent  = `Código: ${App.usuario.codigo}`;
    if (elNombres)   elNombres.value       = App.usuario.nombres;
    if (elApellidos) elApellidos.value     = App.usuario.apellidos;
  },
};

const Carrito = {

  _guardar() {
    sessionStorage.setItem("bazar_carrito", JSON.stringify(App.carrito));
  },

  _actualizarBadge() {
    const badge = document.getElementById("carrito-badge");
    if (!badge) return;
    const total = App.carrito.reduce((acc, p) => acc + p.cantidad, 0);
    badge.textContent   = total;
    badge.style.display = total > 0 ? "inline-block" : "none";
  },

  /** Agrega un producto del bazar al carrito */
  agregar(nombre, precio) {
    const existente = App.carrito.find(p => p.nombre === nombre);
    if (existente) {
      existente.cantidad++;
    } else {
      App.carrito.push({ nombre, precio, cantidad: 1 });
    }
    this._guardar();
    this.render();
    document.getElementById("carrito").classList.add("active");
  },

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

  render() {
    const contenedor = document.getElementById("carrito-items");
    const totalEl    = document.getElementById("total");
    if (!contenedor || !totalEl) return;

    contenedor.innerHTML = "";

    if (App.carrito.length === 0) {
      contenedor.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío 🛍️</p>';
      totalEl.textContent = "0.00";
      this._actualizarBadge();
      return;
    }

    let total = 0;

    App.carrito.forEach(p => {
      total += p.precio * p.cantidad;

      const item = document.createElement("div");
      item.className = "item";

      const info = document.createElement("div");
      info.className = "item-info";
      const nombreEl = document.createElement("strong");
      nombreEl.textContent = p.nombre;
      const precioEl = document.createElement("span");
      precioEl.textContent = `S/ ${p.precio.toFixed(2)}`;
      info.append(nombreEl, precioEl);

      const acciones = document.createElement("div");
      acciones.className = "acciones";

      const btnMas = document.createElement("button");
      btnMas.className = "btn-cantidad";
      btnMas.textContent = "+";
      btnMas.onclick = () => this.cambiarCantidad(p.nombre, 1);

      const cantSpan = document.createElement("span");
      cantSpan.className = "cantidad";
      cantSpan.textContent = p.cantidad;

      const btnMenos = document.createElement("button");
      btnMenos.className = "btn-cantidad";
      btnMenos.textContent = "−";
      btnMenos.onclick = () => this.cambiarCantidad(p.nombre, -1);

      const btnElim = document.createElement("button");
      btnElim.className = "btn-eliminar";
      btnElim.textContent = "✖";
      btnElim.onclick = () => this.eliminar(p.nombre);

      acciones.append(btnMas, cantSpan, btnMenos, btnElim);
      item.append(info, acciones);
      contenedor.appendChild(item);
    });

    totalEl.textContent = total.toFixed(2);
    this._actualizarBadge();
  },

  async confirmar() {
    const sinSesion  = !App.usuario;
    const esInvitado = App.usuario && App.usuario.codigo === "0000";

    if (sinSesion || esInvitado) {
      alert("Debes iniciar sesión para confirmar tu compra.");
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
      alert(`¡${data.mensaje}\nGracias por tu compra, ${App.usuario.nombres}!`);
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
// 📦 MenuDinamico — Catálogo de productos del bazar
//
// ✅ FALLBACK_IMG actualizado: ya no es comida.
// Usa una URL pública neutra de caja de regalo.
// ============================================================
const MenuDinamico = {

  FALLBACK_IMG: "https://i.imgur.com/QnYV2sJ.jpg",  // caja de regalo genérica

  async init() {
    const grid = document.getElementById("grid-productos");
    if (!grid) return;

    grid.innerHTML = '<p class="cargando-menu">Cargando catálogo...</p>';

    let data;
    try {
      const res = await fetch("/api/productos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error("[MenuDinamico] Error al cargar productos:", err);
      grid.innerHTML = '<p class="error-menu">No se pudo cargar el catálogo. Intenta más tarde.</p>';
      return;
    }

    grid.innerHTML = "";

    if (!data.ok || !Array.isArray(data.productos) || data.productos.length === 0) {
      grid.innerHTML = '<p class="cargando-menu">El catálogo está vacío por el momento.</p>';
      return;
    }

    data.productos.forEach(p => this._crearCard(grid, p));

    // ✅ Reutiliza el mismo catálogo para la sección "Novedades"
    // mostrando los últimos 3 productos agregados (orden de inserción).
    this._renderNovedades(data.productos);
  },

  _crearCard(grid, p) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = p.imagen_url && p.imagen_url.startsWith("http")
      ? p.imagen_url
      : this.FALLBACK_IMG;
    img.alt     = p.nombre;
    img.loading = "lazy";
    img.onerror = () => { img.src = this.FALLBACK_IMG; };

    const h3 = document.createElement("h3");
    h3.textContent = p.nombre;

    const precioEl = document.createElement("p");
    precioEl.className   = "precio";
    precioEl.textContent = `S/. ${parseFloat(p.precio).toFixed(2)}`;

    const btn = document.createElement("button");
    btn.className   = "btn-agregar";
    btn.textContent = "Agregar al carrito";
    btn.onclick = () => Carrito.agregar(p.nombre, p.precio);

    card.append(img, h3, precioEl, btn);
    grid.appendChild(card);
  },

  /** Renderiza la sección "Novedades del Bazar" con los últimos productos */
  _renderNovedades(productos) {
    const gridNovedades = document.getElementById("grid-novedades");
    if (!gridNovedades) return;

    gridNovedades.innerHTML = "";

    const ultimos = productos.slice(-3).reverse();
    if (ultimos.length === 0) {
      gridNovedades.innerHTML = '<p class="cargando-menu">Aún no hay novedades.</p>';
      return;
    }

    ultimos.forEach(p => this._crearCard(gridNovedades, p));
  },
};

// ── Funciones globales para onclick="" en el HTML ──
function toggleCarrito()    { UI.toggleCarrito(); }
function toggleLogin()      { UI.toggleLogin(); }
function toggleMenu()       { UI.toggleMenu(); }
function mostrarVista(v)    { UI.mostrarVista(v); }
function volver()           { UI.volver(); }


function login()            { Auth.login(); }
function registrar()        { Auth.registrar(); }
function logout()           { Auth.logout(); }
function modoInvitado()     { Auth.modoInvitado(); }
function modificarUsuario() { Auth.modificarUsuario(); }

function agregarCarrito(n, p) { Carrito.agregar(n, p); }
function confirmarPedido()    { Carrito.confirmar(); }

document.addEventListener("DOMContentLoaded", () => {
  UI.actualizarNavbar();
  if (App.usuario) {
    Auth.cargarDatosEdicion();
    UI.mostrarVista("usuario");
  }
  Carrito.render();
  MenuDinamico.init();
});