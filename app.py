# ============================================================
# app.py — Bazar de Omar (Backend)
# Omar Vilela | Full-Stack Engineer
#
# ✅ MIGRACIÓN DE NEGOCIO: de FastFoot a Bazar de Omar.
# Solo cambian textos de mensajes y comentarios de dominio.
# La arquitectura de archivos, line_index, JOIN y Chart.js
# permanece IDÉNTICA — no se tocó ningún algoritmo.
# ============================================================

import os
from datetime import datetime
from flask import (
    Flask, request, render_template,
    redirect, url_for, session, jsonify
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_key_cambiar_en_produccion")

ARCHIVO_USUARIOS  = "usuarios.txt"
ARCHIVO_PEDIDOS   = "pedidos.txt"   # Conserva el nombre: ahora son "compras" del bazar
ARCHIVO_PRODUCTOS = "productos.txt"


# ── Helpers de usuarios (sin cambios) ────────────────────────

def leer_usuarios() -> list[dict]:
    usuarios = []
    try:
        with open(ARCHIVO_USUARIOS, "r", encoding="utf-8") as f:
            for linea in f:
                partes = linea.strip().split(",")
                if len(partes) == 3:
                    usuarios.append({
                        "codigo":    partes[0].strip(),
                        "nombres":   partes[1].strip(),
                        "apellidos": partes[2].strip()
                    })
    except FileNotFoundError:
        pass
    return usuarios

def buscar_usuario(codigo: str) -> dict | None:
    for u in leer_usuarios():
        if u["codigo"] == codigo:
            return u
    return None

def guardar_usuarios(usuarios: list[dict]) -> None:
    with open(ARCHIVO_USUARIOS, "w", encoding="utf-8") as f:
        for u in usuarios:
            f.write(f"{u['codigo']},{u['nombres']},{u['apellidos']}\n")

def validar_codigo(codigo: str) -> str | None:
    if not codigo:
        return "El código es obligatorio."
    if not codigo.isdigit():
        return "El código debe ser numérico."
    if len(codigo) > 4:
        return "El código debe tener máximo 4 dígitos."
    return None


# ── Helpers de pedidos/compras (sin cambios de lógica) ───────
#
# ✅ No se modifica leer_pedidos(), guardar_pedidos() ni
# enriquecer_pedidos_con_usuarios(). Mismo line_index,
# mismo formato de 6 campos, mismo JOIN para los gráficos.

def leer_pedidos() -> list[dict]:
    """
    Lee pedidos.txt (compras del bazar) con enumerate() para line_index.
    Formato: codigo_usuario, producto, cantidad, precio, estado, timestamp
    """
    pedidos = []
    try:
        with open(ARCHIVO_PEDIDOS, "r", encoding="utf-8") as f:
            for line_index, linea in enumerate(f):
                linea_limpia = linea.strip()
                if not linea_limpia:
                    continue
                partes = linea_limpia.split(",")
                if len(partes) < 4:
                    continue
                pedidos.append({
                    "line_index":     line_index,
                    "codigo_usuario": partes[0].strip(),
                    "producto":       partes[1].strip(),
                    "cantidad":       int(partes[2].strip()),
                    "precio":         float(partes[3].strip()),
                    "estado":         partes[4].strip() if len(partes) > 4 else "espera",
                    "timestamp":      partes[5].strip() if len(partes) > 5 else "N/D",
                })
    except FileNotFoundError:
        pass
    return pedidos

def guardar_pedidos(pedidos: list[dict]) -> None:
    with open(ARCHIVO_PEDIDOS, "w", encoding="utf-8") as f:
        for p in pedidos:
            f.write(
                f"{p['codigo_usuario']},{p['producto']},"
                f"{p['cantidad']},{p['precio']},"
                f"{p['estado']},{p['timestamp']}\n"
            )

def enriquecer_pedidos_con_usuarios(pedidos, usuarios) -> list[dict]:
    """JOIN en memoria — alimenta los gráficos del dashboard. No tocar."""
    indice = {u["codigo"]: u for u in usuarios}
    for p in pedidos:
        u = indice.get(p["codigo_usuario"])
        p["nombre_usuario"] = (
            f"{u['nombres']} {u['apellidos']}" if u else "Usuario eliminado"
        )
        p["subtotal"] = round(p["cantidad"] * p["precio"], 2)
    return pedidos


# ── Helpers de productos de bazar (sin cambios de lógica) ────

def leer_productos() -> list[dict]:
    """
    Lee productos.txt — catálogo del bazar.
    Formato: id_producto, nombre, precio, imagen_url
    Ej: B01,Cuaderno Anillado A4,12.50,https://...jpg
    """
    productos = []
    try:
        with open(ARCHIVO_PRODUCTOS, "r", encoding="utf-8") as f:
            for line_index, linea in enumerate(f):
                linea_limpia = linea.strip()
                if not linea_limpia:
                    continue
                partes = linea_limpia.split(",")
                if len(partes) < 3:
                    continue

                campo4 = partes[3].strip() if len(partes) > 3 else ""
                imagen_url = campo4 if campo4.startswith("http") else ""

                productos.append({
                    "line_index":  line_index,
                    "id_producto": partes[0].strip(),
                    "nombre":      partes[1].strip(),
                    "precio":      float(partes[2].strip()),
                    "imagen_url":  imagen_url,
                })
    except FileNotFoundError:
        pass
    return productos

def guardar_productos(productos: list[dict]) -> None:
    with open(ARCHIVO_PRODUCTOS, "w", encoding="utf-8") as f:
        for p in productos:
            f.write(
                f"{p['id_producto']},"
                f"{p['nombre']},"
                f"{p['precio']},"
                f"{p['imagen_url']}\n"
            )

def generar_id_producto() -> str:
    """
    Genera el próximo ID correlativo del catálogo (B01, B02, ...).
    ✅ Prefijo cambiado de "P" a "B" (Bazar) — solo cosmético,
    no afecta el algoritmo de incremento.
    """
    productos = leer_productos()
    if not productos:
        return "B01"
    try:
        ultimo_num = int(productos[-1]["id_producto"][1:])
        return f"B{str(ultimo_num + 1).zfill(2)}"
    except (ValueError, IndexError):
        return f"B{str(len(productos) + 1).zfill(2)}"


# ── Verificación de admin (sin cambios) ──────────────────────

def verificar_admin():
    usuario = session.get("usuario")
    if not usuario:
        return jsonify({"ok": False, "mensaje": "No hay sesión activa."}), 401
    if usuario["codigo"] != "001":
        return jsonify({"ok": False, "mensaje": "Acción reservada para administrador."}), 403
    return None


# ── Rutas ────────────────────────────────────────────────────

@app.route("/")
def inicio():
    """Pasa el catálogo del bazar al template para el render dinámico."""
    return render_template(
        "index.html",
        usuario=session.get("usuario"),
        productos=leer_productos()
    )


# ── API Usuarios (sin cambios de lógica) ──────────────────────

@app.route("/api/usuario", methods=["POST"])
def api_usuario():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"ok": False, "mensaje": "Solicitud inválida"}), 400

    accion    = data.get("accion", "")
    codigo    = data.get("codigo", "").strip()
    nombres   = data.get("nombres", "").strip()
    apellidos = data.get("apellidos", "").strip()

    if accion == "login":
        error = validar_codigo(codigo)
        if error:
            return jsonify({"ok": False, "mensaje": error})
        usuario = buscar_usuario(codigo)
        if usuario:
            session["usuario"] = usuario
            return jsonify({"ok": True, "usuario": usuario})
        return jsonify({"ok": False, "mensaje": "Código no encontrado."})

    elif accion == "registrar":
        error = validar_codigo(codigo)
        if error:
            return jsonify({"ok": False, "mensaje": error})
        if not nombres or not apellidos:
            return jsonify({"ok": False, "mensaje": "Todos los campos son obligatorios."})
        if buscar_usuario(codigo):
            return jsonify({"ok": False, "mensaje": "El código ya está registrado."})
        with open(ARCHIVO_USUARIOS, "a", encoding="utf-8") as f:
            f.write(f"{codigo},{nombres},{apellidos}\n")
        return jsonify({"ok": True, "mensaje": "¡Bienvenido al Bazar de Omar! Usuario registrado."})

    elif accion == "modificar":
        usuario_sesion = session.get("usuario")
        if not usuario_sesion:
            return jsonify({"ok": False, "mensaje": "Sin sesión activa."}), 401
        if usuario_sesion["codigo"] != codigo:
            return jsonify({"ok": False, "mensaje": "No autorizado."}), 403
        if not nombres or not apellidos:
            return jsonify({"ok": False, "mensaje": "Campos obligatorios vacíos."})
        usuarios = leer_usuarios()
        for u in usuarios:
            if u["codigo"] == codigo:
                u["nombres"]   = nombres
                u["apellidos"] = apellidos
                break
        guardar_usuarios(usuarios)
        session["usuario"] = {"codigo": codigo, "nombres": nombres, "apellidos": apellidos}
        return jsonify({"ok": True, "mensaje": "Datos actualizados.", "usuario": session["usuario"]})

    elif accion == "eliminar":
        err = verificar_admin()
        if err:
            return err
        codigo_objetivo = data.get("codigo_objetivo", "").strip()
        if codigo_objetivo == "001":
            return jsonify({"ok": False, "mensaje": "No puedes eliminar al administrador."})
        usuarios = leer_usuarios()
        nuevos   = [u for u in usuarios if u["codigo"] != codigo_objetivo]
        if len(nuevos) == len(usuarios):
            return jsonify({"ok": False, "mensaje": "Usuario no encontrado."})
        guardar_usuarios(nuevos)
        return jsonify({"ok": True, "mensaje": f"Usuario {codigo_objetivo} eliminado."})

    elif accion == "logout":
        session.pop("usuario", None)
        return jsonify({"ok": True})

    elif accion == "invitado":
        session["usuario"] = {"codigo": "0000", "nombres": "Invitado", "apellidos": ""}
        return jsonify({"ok": True, "usuario": session["usuario"]})

    return jsonify({"ok": False, "mensaje": "Acción no reconocida."}), 400


# ── API Pedidos/Compras (sin cambios de lógica) ───────────────

@app.route("/api/pedido", methods=["POST"])
def api_pedido():
    """Guarda una compra nueva con estado 'espera'."""
    usuario = session.get("usuario")
    if not usuario:
        return jsonify({"ok": False, "mensaje": "Debes iniciar sesión para comprar."}), 401
    data = request.get_json(silent=True)
    if not data or not data.get("items"):
        return jsonify({"ok": False, "mensaje": "Tu carrito está vacío."}), 400
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M")
    with open(ARCHIVO_PEDIDOS, "a", encoding="utf-8") as f:
        for item in data["items"]:
            nombre   = str(item.get("nombre", "")).replace(",", "")
            cantidad = int(item.get("cantidad", 1))
            precio   = float(item.get("precio", 0))
            f.write(f"{usuario['codigo']},{nombre},{cantidad},{precio},espera,{ahora}\n")
    return jsonify({"ok": True, "mensaje": "¡Compra registrada con éxito!"})


@app.route("/api/pedido/estado", methods=["POST"])
def api_pedido_estado():
    """
    Cambia el estado de una compra usando line_index.
    ✅ Mismo algoritmo exacto del Gist — no se modificó nada aquí.
    """
    err = verificar_admin()
    if err:
        return err
    data         = request.get_json(silent=True)
    line_index   = data.get("line_index")
    nuevo_estado = data.get("estado", "").strip()
    if nuevo_estado not in ("espera", "confirmado"):
        return jsonify({"ok": False, "mensaje": "Estado inválido."}), 400
    if not isinstance(line_index, int) or line_index < 0:
        return jsonify({"ok": False, "mensaje": "Identificador inválido."}), 400
    try:
        with open(ARCHIVO_PEDIDOS, "r", encoding="utf-8") as f:
            lineas = f.readlines()
    except FileNotFoundError:
        return jsonify({"ok": False, "mensaje": "Archivo no encontrado."}), 404
    if line_index >= len(lineas):
        return jsonify({"ok": False, "mensaje": "Compra no encontrada."}), 404
    partes = lineas[line_index].strip().split(",")
    if len(partes) < 4:
        return jsonify({"ok": False, "mensaje": "Línea malformada."}), 400
    timestamp = partes[5].strip() if len(partes) > 5 else "N/D"
    lineas[line_index] = (
        f"{partes[0].strip()},{partes[1].strip()},"
        f"{partes[2].strip()},{partes[3].strip()},"
        f"{nuevo_estado},{timestamp}\n"
    )
    with open(ARCHIVO_PEDIDOS, "w", encoding="utf-8") as f:
        f.writelines(lineas)
    return jsonify({"ok": True, "mensaje": f"Compra actualizada a '{nuevo_estado}'."})


# ── API Productos del Bazar (sin cambios de lógica) ───────────

@app.route("/api/productos", methods=["GET"])
def api_productos_listar():
    """Público. Catálogo completo del bazar para el cliente."""
    return jsonify({"ok": True, "productos": leer_productos()})


@app.route("/api/productos", methods=["POST"])
def api_productos_crear():
    """Crea un producto de bazar. Solo admin 001."""
    err = verificar_admin()
    if err:
        return err

    data       = request.get_json(silent=True)
    nombre     = data.get("nombre", "").strip().replace(",", "")
    imagen_url = data.get("imagen_url", "").strip()

    if not nombre:
        return jsonify({"ok": False, "mensaje": "El nombre es obligatorio."})
    if not imagen_url.startswith("http"):
        return jsonify({"ok": False, "mensaje": "La URL debe empezar con http o https."})

    try:
        precio = round(float(data.get("precio")), 2)
        if precio <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"ok": False, "mensaje": "Precio inválido."})

    if any(p["nombre"].lower() == nombre.lower() for p in leer_productos()):
        return jsonify({"ok": False, "mensaje": f"Ya existe '{nombre}' en el catálogo."})

    nuevo_id = generar_id_producto()

    with open(ARCHIVO_PRODUCTOS, "a", encoding="utf-8") as f:
        f.write(f"{nuevo_id},{nombre},{precio},{imagen_url}\n")

    producto_creado = leer_productos()[-1]

    return jsonify({
        "ok":       True,
        "mensaje":  f"'{nombre}' agregado al catálogo.",
        "producto": producto_creado
    })


@app.route("/api/productos/<int:line_index>", methods=["DELETE"])
def api_productos_eliminar(line_index):
    """Elimina un producto del bazar por línea cruda. Solo admin 001."""
    err = verificar_admin()
    if err:
        return err
    try:
        with open(ARCHIVO_PRODUCTOS, "r", encoding="utf-8") as f:
            lineas = f.readlines()
    except FileNotFoundError:
        return jsonify({"ok": False, "mensaje": "Archivo no encontrado."}), 404
    if line_index < 0 or line_index >= len(lineas):
        return jsonify({"ok": False, "mensaje": "Producto no encontrado."}), 404
    partes           = lineas[line_index].strip().split(",")
    nombre_eliminado = partes[1].strip() if len(partes) > 1 else "Desconocido"
    del lineas[line_index]
    with open(ARCHIVO_PRODUCTOS, "w", encoding="utf-8") as f:
        f.writelines(lineas)
    return jsonify({"ok": True, "mensaje": f"'{nombre_eliminado}' eliminado del catálogo."})


# ── Dashboard ─────────────────────────────────────────────────

@app.route("/dashboard")
def dashboard():
    """Panel admin del Bazar de Omar. Solo usuario 001."""
    usuario = session.get("usuario")
    if not usuario or usuario["codigo"] != "001":
        return redirect(url_for("inicio"))

    usuarios  = leer_usuarios()
    pedidos   = leer_pedidos()
    productos = leer_productos()

    # ✅ JOIN intacto — alimenta ambos gráficos de Chart.js
    pedidos_enriquecidos = enriquecer_pedidos_con_usuarios(pedidos, usuarios)

    pedidos_espera      = [p for p in pedidos_enriquecidos if p["estado"] == "espera"]
    pedidos_confirmados = [p for p in pedidos_enriquecidos if p["estado"] == "confirmado"]

    total_ventas   = round(sum(p["subtotal"] for p in pedidos_enriquecidos), 2)
    total_pedidos  = len(pedidos_enriquecidos)
    total_usuarios = len(usuarios)

    ventas_por_usuario: dict[str, float] = {}
    for p in pedidos_enriquecidos:
        clave = f"{p['codigo_usuario']} - {p['nombre_usuario']}"
        ventas_por_usuario[clave] = round(
            ventas_por_usuario.get(clave, 0) + p["subtotal"], 2
        )

    resumen_productos: dict[str, dict] = {}
    for p in pedidos_enriquecidos:
        if p["producto"] not in resumen_productos:
            resumen_productos[p["producto"]] = {"cantidad": 0, "total": 0.0}
        resumen_productos[p["producto"]]["cantidad"] += p["cantidad"]
        resumen_productos[p["producto"]]["total"] = round(
            resumen_productos[p["producto"]]["total"] + p["subtotal"], 2
        )

    return render_template(
        "dashboard.html",
        usuario             = usuario,
        usuarios            = usuarios,
        productos           = productos,
        pedidos_espera      = pedidos_espera,
        pedidos_confirmados = pedidos_confirmados,
        total_ventas        = total_ventas,
        total_pedidos       = total_pedidos,
        total_usuarios      = total_usuarios,
        resumen_productos   = resumen_productos,
        chart_labels        = list(ventas_por_usuario.keys()),
        chart_data          = list(ventas_por_usuario.values()),
    )


if __name__ == "__main__":
    app.run(debug=True)