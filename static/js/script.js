// ============================================================
// script.js — FastFoot Frontend
// Omar Vilela | Full-Stack Engineer
//
// Estructura modular con IIFEs para evitar contaminar el
// scope global. Cada módulo tiene una responsabilidad clara.
// ============================================================

"use strict";

// ============================================================
// 📦 MÓDULO: Estado de la aplicación
// Un único objeto que centraliza el estado mutable.
// Esto evita tener variables sueltas por todo el archivo.
// ============================================================
const App = {
  // ✅ sessionStorage: el carrito vive solo en esta sesión.
  // Al cerrar la pestaña se limpia automáticamente.
  // Es la opción correcta para un carrito de fast food.
  carrito: JSON.parse(sessionStorage.getItem("ff_carrito")) || [],

  // Usuario activo (leído del DOM que Flask inyectó)
  usuario: null,
};

// ============================================================
// 📦 MÓDULO: Utilidades
// ============================================================
const Utils = {

  /**
   * Muestra un mensaje temporal en el panel de login.
   * @param {string} texto - El mensaje a mostrar.
   * @param {boolean} esError - Si es true, muestra en rojo.
   */
  mostrarMensaje(texto, esError = false) {
    const el = document.getElementById("login-mensaje");
    el.textContent = texto;
    el.style.display = "block";
    el.style.color = esError ? "#e02e2e" : "#06b1db";
    // Auto-ocultar después de 4 segundos
    setTimeout(() => { el.style.display = "none"; }, 4000);
  },

  /**
   * Hace una petición POST a la API con JSON.
   * Centralizar el fetch evita repetir headers y manejo de errores.
   * @param {string} url
   * @param {object} body
   * @returns {Promise<object>}
   */
  async postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  },

};

// ============================================================
// 📦 MÓDULO: Navegación y UI
// ============================================================
const UI = {

  /** Abre/cierra el panel del carrito */
  toggleCarrito() {
    document.getElementById("carrito").classList.toggle("active");
  },

  /** Abre/cierra el panel de login */
  toggleLogin() {
    document.getElementById("panel-login").classList.toggle("active");
  },

  /** Abre/cierra el menú hamburguesa en móvil */
  toggleMenu() {
    document.getElementById("menu").classList.toggle("active");
  },

  /**
   * Muestra solo una de las vistas dentro del panel de login.
   * @param {string} nombre - 'inicial' | 'login' | 'registro' | 'usuario'
   */
  mostrarVista(nombre) {
    const vistas = ["inicial", "login", "registro", "usuario"];
    vistas.forEach(v => {
      document.getElementById(`vista-${v}`).style.display =
        v === nombre ? "block" : "none";
    });
  },

  /** Vuelve a la vista inicial del panel de login */
  volver() {
    this.mostrarVista("inicial");
    Utils.mostrarMensaje("", false); // Limpiar mensajes
  },

  /**
   * Actualiza la UI de la navbar según si hay sesión o no.
   * Se llama al cargar la página y después de login/logout.
   */
  actualizarNavbar() {
    // El estado viene del elemento DOM inyectado por Flask
    const sessionEl = document.getElementById("session-data");
    if (sessionEl) {
      App.usuario = {
        codigo:    sessionEl.dataset.codigo,
        nombres:   sessionEl.dataset.nombres,
        apellidos: sessionEl.dataset.apellidos,
      };
    }
  },

};

// ============================================================
// 📦 MÓDULO: Autenticación
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
      // ✅ Recargar la página para que Flask genere el template
      // con el usuario en sesión (el link de dashboard, etc.)
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
      accion: "registrar", codigo, nombres, apellidos
    });

    if (data.ok) {
      Utils.mostrarMensaje("¡Registrado! Ahora puedes iniciar sesión.", false);
      // Limpiar campos y ir al login
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
   * El backend valida que el código coincida con la sesión.
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
      // Actualizar el nombre visible sin recargar
      document.getElementById("usuario-nombre").textContent =
        `${data.usuario.nombres} ${data.usuario.apellidos}`;
      // Actualizar estado local
      App.usuario = data.usuario;
    } else {
      Utils.mostrarMensaje(data.mensaje, true);
    }
  },

  async logout() {
    await Utils.postJSON("/api/usuario", { accion: "logout" });
    // Limpiar carrito de sesión al salir
    sessionStorage.removeItem("ff_carrito");
    location.reload();
  },

  modoInvitado() {
    UI.toggleLogin();
    // El invitado no necesita sesión de servidor, simplemente cierra el panel
  },

  /** Carga los datos del usuario en el formulario de edición */
  cargarDatosEdicion() {
    if (!App.usuario) return;
    document.getElementById("usuario-nombre").textContent =
      `${App.usuario.nombres} ${App.usuario.apellidos}`;
    document.getElementById("usuario-codigo-display").textContent =
      `Código: ${App.usuario.codigo}`;
    document.getElementById("edit-nombres").value   = App.usuario.nombres;
    document.getElementById("edit-apellidos").value = App.usuario.apellidos;
  },

};

// ============================================================
// 📦 MÓDULO: Carrito de Compras
// ============================================================
const Carrito = {

  /** Persiste el carrito en sessionStorage */
  _guardar() {
    sessionStorage.setItem("ff_carrito", JSON.stringify(App.carrito));
  },

  /** Actualiza el badge del ícono del carrito en la navbar */
  _actualizarBadge() {
    const badge   = document.getElementById("carrito-badge");
    const total   = App.carrito.reduce((acc, p) => acc + p.cantidad, 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? "inline-block" : "none";
  },

  /**
   * Agrega un producto al carrito o incrementa su cantidad.
   * @param {string} nombre
   * @param {number} precio
   */
  agregar(nombre, precio) {
    const producto = App.carrito.find(p => p.nombre === nombre);

    if (producto) {
      producto.cantidad++;
    } else {
      App.carrito.push({ nombre, precio, cantidad: 1 });
    }

    this._guardar();
    this.render();

    // ✅ Feedback visual: abrir el carrito al agregar
    document.getElementById("carrito").classList.add("active");
  },

  /**
   * Cambia la cantidad de un producto (+1 o -1).
   * Si llega a 0, se elimina del carrito.
   * @param {string} nombre
   * @param {number} cambio - +1 o -1
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

  /**
   * Elimina un producto completamente del carrito.
   * @param {string} nombre
   */
  eliminar(nombre) {
    App.carrito = App.carrito.filter(p => p.nombre !== nombre);
    this._guardar();
    this.render();
  },

  /**
   * Renderiza los items del carrito en el DOM.
   * ✅ Usamos createElement en lugar de innerHTML +=
   *    para evitar XSS si los nombres vinieran del servidor.
   */
  render() {
    const contenedor = document.getElementById("carrito-items");
    const totalEl    = document.getElementById("total");

    // Limpiar contenedor
    contenedor.innerHTML = "";

    if (App.carrito.length === 0) {
      contenedor.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío 🛒</p>';
      totalEl.textContent = "0";
      this._actualizarBadge();
      return;
    }

    let total = 0;

    App.carrito.forEach(p => {
      total += p.precio * p.cantidad;

      // ✅ Construir el elemento del item de forma segura
      const item = document.createElement("div");
      item.className = "item";

      const info = document.createElement("div");
      info.className = "item-info";
      info.innerHTML = `<strong>${p.nombre}</strong><span>S/ ${p.precio}</span>`;

      const acciones = document.createElement("div");
      acciones.className = "acciones";

      // Botón +
      const btnMas = document.createElement("button");
      btnMas.className = "btn-cantidad";
      btnMas.textContent = "+";
      btnMas.onclick = () => this.cambiarCantidad(p.nombre, 1);

      // Cantidad
      const cantidad = document.createElement("span");
      cantidad.className = "cantidad";
      cantidad.textContent = p.cantidad;

      // Botón -
      const btnMenos = document.createElement("button");
      btnMenos.className = "btn-cantidad";
      btnMenos.textContent = "−";
      btnMenos.onclick = () => this.cambiarCantidad(p.nombre, -1);

      // Botón eliminar
      const btnElim = document.createElement("button");
      btnElim.className = "btn-eliminar";
      btnElim.textContent = "✖";
      btnElim.onclick = () => this.eliminar(p.nombre);

      acciones.append(btnMas, cantidad, btnMenos, btnElim);
      item.append(info, acciones);
      contenedor.appendChild(item);
    });

    totalEl.textContent = total.toFixed(2);
    this._actualizarBadge();
  },

  /**
   * Envía el pedido al backend y vacía el carrito si tiene éxito.
   * ✅ Requiere sesión activa. Si no hay sesión, abre el panel de login.
   */
  async confirmar() {
    if (!App.usuario || App.usuario.codigo === "0000") {
      alert("Debes iniciar sesión para confirmar un pedido.");
      UI.toggleCarrito();
      UI.toggleLogin();
      return;
    }

    if (App.carrito.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }

    const data = await Utils.postJSON("/api/pedido", { items: App.carrito });

    if (data.ok) {
      alert(`¡${data.mensaje} Gracias, ${App.usuario.nombres}!`);
      App.carrito = [];
      this._guardar();
      this.render();
      UI.toggleCarrito();
    } else {
      alert(data.mensaje);
    }
  },

};

// ============================================================
// 🔹 FUNCIONES GLOBALES
// El HTML usa onclick="...()" por lo que necesitamos exponer
// estas funciones en window. Las delegamos a los módulos.
// ============================================================

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

// ============================================================
// 🔹 INICIALIZACIÓN
// Se ejecuta cuando el DOM está listo.
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Leer usuario de sesión del DOM (inyectado por Flask)
  UI.actualizarNavbar();

  // 2. Si hay usuario, cargar sus datos en el formulario de edición
  if (App.usuario) {
    Auth.cargarDatosEdicion();
    // Mostrar directamente la vista de usuario si ya está logueado
    UI.mostrarVista("usuario");
  }

  // 3. Renderizar el carrito (por si quedó algo en sessionStorage)
  Carrito.render();
});

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

// Agregar esto al final de script.js para "despertar" la carga del menú
document.addEventListener("DOMContentLoaded", () => {
    if (typeof MenuDinamico !== 'undefined') {
        MenuDinamico.init();
    }
});