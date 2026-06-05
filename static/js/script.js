let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

function toggleCarrito() {
    document.getElementById("carrito").classList.toggle("active");
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