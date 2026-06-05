let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

function toggleCarrito() {
    document.getElementById("carrito").classList.toggle("active");
}

async function login() {

    const codigo = document.getElementById("login-codigo").value;

    const res = await fetch("/api/usuario", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            accion: "login",
            codigo: codigo
        })
    });

    const data = await res.json();

    if (data.ok) {

        document.getElementById("usuario-nombre").innerText =
            data.usuario.nombres + " " + data.usuario.apellidos;

        mostrarVista("usuario");
        toggleLogin();

    } else {
        alert(data.mensaje);
    }
}

function mostrarVista(vista) {

    document.getElementById("vista-inicial").style.display = "none";
    document.getElementById("vista-login").style.display = "none";
    document.getElementById("vista-registro").style.display = "none";
    document.getElementById("vista-usuario").style.display = "none";

    document.getElementById("vista-" + vista).style.display = "block";
}

function toggleLogin() {
    const panel = document.getElementById("panel-login");
    panel.classList.toggle("active");
}

function volver() {
    mostrarVista("inicial");
}

function modoInvitado() {
    toggleLogin();
}

async function registrar() {

    const codigo = document.getElementById("reg-codigo").value;
    const nombres = document.getElementById("reg-nombre").value;
    const apellidos = document.getElementById("reg-apellido").value;

    const res = await fetch("/api/usuario", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            accion: "registrar",
            codigo: codigo,
            nombres: nombres,
            apellidos: apellidos
        })
    });

    const data = await res.json();

    if (data.ok) {
        alert("Registrado correctamente");
        volver();
    } else {
        alert(data.mensaje);
    }
}


async function logout() {

    await fetch("/api/usuario", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            accion: "logout"
        })
    });

    location.reload();
}

function agregarCarrito(nombre, precio) {

    let producto = carrito.find(p => p.nombre === nombre);

    if (producto) {
        producto.cantidad++;
    } else {
        carrito.push({ nombre, precio, cantidad: 1 });
    }

    guardarCarrito();
    renderCarrito();
}

function cambiarCantidad(nombre, cambio) {

    let producto = carrito.find(p => p.nombre === nombre);

    if (!producto) return;

    producto.cantidad += cambio;

    if (producto.cantidad <= 0) {
        carrito = carrito.filter(p => p.nombre !== nombre);
    }

    guardarCarrito();
    renderCarrito();
}

function eliminarProducto(nombre) {
    carrito = carrito.filter(p => p.nombre !== nombre);
    guardarCarrito();
    renderCarrito();
}

function guardarCarrito() {
    localStorage.setItem("carrito", JSON.stringify(carrito));
}

function renderCarrito() {

    const contenedor = document.getElementById("carrito-items");
    const totalElemento = document.getElementById("total");

    contenedor.innerHTML = "";

    let total = 0;

    carrito.forEach(p => {

        total += p.precio * p.cantidad;

        contenedor.innerHTML += `
        <div class="item">
            <div class="item-info">
                <strong>${p.nombre}</strong>
                <span>S/ ${p.precio}</span>
            </div>

            <div class="acciones">
                <button class="btn-cantidad" onclick="cambiarCantidad('${p.nombre}', 1)">+</button>
                <span class="cantidad">${p.cantidad}</span>
                <button class="btn-cantidad" onclick="cambiarCantidad('${p.nombre}', -1)">−</button>
                <button class="btn-eliminar" onclick="eliminarProducto('${p.nombre}')">✖</button>
            </div>
        </div>`;
    });

    totalElemento.textContent = total;
}

window.onload = renderCarrito;