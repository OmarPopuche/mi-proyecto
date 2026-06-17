# ============================================================
# app.py — FastFoot Backend
# CAMBIOS EN ESTA VERSIÓN:
#   1. leer_productos(): campo 4 ahora es "imagen_url", no "categoria"
#   2. guardar_productos(): serializa imagen_url en lugar de categoria
#   3. api_productos_crear(): recibe y valida "imagen_url" en el body
#   4. Ruta "/": sin cambios, ya pasa productos al template
#   5. Ruta "/dashboard": sin cambios, el JOIN ya funciona correctamente
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
ARCHIVO_PEDIDOS   = "pedidos.txt"
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


# ── Helpers de pedidos (sin cambios) ─────────────────────────

def leer_pedidos() -> list[dict]:
    """
    Lee pedidos.txt con enumerate() para asignar line_index.
    Formato: codigo_usuario, producto, cantidad, precio, estado, timestamp
    Compatibilidad legacy (4 campos): estado="espera", timestamp="N/D"
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
    """
    JOIN en memoria pedidos ↔ usuarios.
    Agrega nombre_usuario y subtotal a cada pedido.
    Este JOIN es el que alimenta los gráficos del dashboard.
    """
    indice = {u["codigo"]: u for u in usuarios}
    for p in pedidos:
        u = indice.get(p["codigo_usuario"])
        p["nombre_usuario"] = (
            f"{u['nombres']} {u['apellidos']}" if u else "Usuario eliminado"
        )
        p["subtotal"] = round(p["cantidad"] * p["precio"], 2)
    return pedidos


# ── Helpers de productos — MODIFICADOS ───────────────────────

# ============================================================
# HELPERS — Productos  (reemplaza las funciones del Gist)
#
# CAMBIO: el campo 4 del txt pasa de "categoria" a "imagen_url".
#
# Nuevo formato de productos.txt:
#   id_producto, nombre, precio, imagen_url
#   P01,Pollo a la brasa,17.0,https://i.imgur.com/abc.jpg
#
# Retrocompatibilidad: si el campo 4 NO empieza con "http"
# se trata como categoría legacy y imagen_url queda vacío.
# Así los datos ya guardados no rompen la lectura.
# ============================================================

def leer_productos() -> list[dict]:
    """
    Lee productos.txt con enumerate() para obtener line_index.
    Detecta automáticamente si el campo 4 es URL o categoría antigua.
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

                # ✅ Distinguir URL de categoría legacy
                if campo4.startswith("http"):
                    imagen_url = campo4
                else:
                    # Dato legacy: imagen vacía, el frontend usará fallback
                    imagen_url = ""

                productos.append({
                    "line_index":  line_index,
                    "id_producto": partes[0].strip(),
                    "nombre":      partes[1].strip(),
                    "precio":      float(partes[2].strip()),
                    # ✅ Clave "imagen_url" — la que el frontend consume
                    "imagen_url":  imagen_url,
                })
    except FileNotFoundError:
        pass
    return productos


def guardar_productos(productos: list[dict]) -> None:
    """Serializa con imagen_url en campo 4."""
    with open(ARCHIVO_PRODUCTOS, "w", encoding="utf-8") as f:
        for p in productos:
            f.write(
                f"{p['id_producto']},"
                f"{p['nombre']},"
                f"{p['precio']},"
                f"{p['imagen_url']}\n"
            )


# ── API Productos ─────────────────────────────────────────────

@app.route("/api/productos", methods=["GET"])
def api_productos_listar():
    """
    Público. Retorna la lista con la clave 'imagen_url' garantizada.
    Es el contrato que script.js espera en MenuDinamico.init().
    """
    return jsonify({"ok": True, "productos": leer_productos()})


@app.route("/api/productos", methods=["POST"])
def api_productos_crear():
    """
    ✅ Recibe { nombre, precio, imagen_url } — ya no "categoria".
    Solo admin 001.
    """
    err = verificar_admin()
    if err:
        return err

    data       = request.get_json(silent=True)
    nombre     = data.get("nombre", "").strip().replace(",", "")
    imagen_url = data.get("imagen_url", "").strip()

    if not nombre:
        return jsonify({"ok": False, "mensaje": "El nombre es obligatorio."})

    # Validar que sea una URL real
    if not imagen_url.startswith("http"):
        return jsonify({"ok": False, "mensaje": "La URL debe empezar con http o https."})

    try:
        precio = round(float(data.get("precio")), 2)
        if precio <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"ok": False, "mensaje": "Precio inválido."})

    if any(p["nombre"].lower() == nombre.lower() for p in leer_productos()):
        return jsonify({"ok": False, "mensaje": f"Ya existe '{nombre}' en el menú."})

    nuevo_id = generar_id_producto()

    with open(ARCHIVO_PRODUCTOS, "a", encoding="utf-8") as f:
        f.write(f"{nuevo_id},{nombre},{precio},{imagen_url}\n")

    # Releer para obtener el line_index real del ítem recién escrito
    producto_creado = leer_productos()[-1]

    return jsonify({
        "ok":       True,
        "mensaje":  f"'{nombre}' agregado al menú.",
        "producto": producto_creado   # incluye imagen_url e line_index correctos
    })


@app.route("/api/productos/<int:line_index>", methods=["DELETE"])
def api_productos_eliminar(line_index):
    """Sin cambios respecto al Gist — funciona igual."""
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
    return jsonify({"ok": True, "mensaje": f"'{nombre_eliminado}' eliminado del menú."})

def guardar_productos(productos: list[dict]) -> None:
    """Serializa productos con el nuevo formato de 4 campos."""
    with open(ARCHIVO_PRODUCTOS, "w", encoding="utf-8") as f:
        for p in productos:
            f.write(
                f"{p['id_producto']},"
                f"{p['nombre']},"
                f"{p['precio']},"
                f"{p['imagen_url']}\n"
            )

def generar_id_producto() -> str:
    """Genera ID correlativo P01, P02, ..."""
    productos = leer_productos()
    if not productos:
        return "P01"
    try:
        ultimo_num = int(productos[-1]["id_producto"][1:])
        return f"P{str(ultimo_num + 1).zfill(2)}"
    except (ValueError, IndexError):
        return f"P{str(len(productos) + 1).zfill(2)}"


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
    """Pasa productos al template para el menú dinámico."""
    return render_template(
        "index.html",
        usuario=session.get("usuario"),
        productos=leer_productos()
    )


# ── API Usuarios (sin cambios) ────────────────────────────────

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
        return jsonify({"ok": True, "mensaje": "Usuario registrado correctamente."})

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


# ── API Pedidos (sin cambios) ─────────────────────────────────

@app.route("/api/pedido", methods=["POST"])
def api_pedido():
    usuario = session.get("usuario")
    if not usuario:
        return jsonify({"ok": False, "mensaje": "Debes iniciar sesión para pedir."}), 401
    data = request.get_json(silent=True)
    if not data or not data.get("items"):
        return jsonify({"ok": False, "mensaje": "Carrito vacío o datos inválidos."}), 400
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M")
    with open(ARCHIVO_PEDIDOS, "a", encoding="utf-8") as f:
        for item in data["items"]:
            nombre   = str(item.get("nombre", "")).replace(",", "")
            cantidad = int(item.get("cantidad", 1))
            precio   = float(item.get("precio", 0))
            f.write(f"{usuario['codigo']},{nombre},{cantidad},{precio},espera,{ahora}\n")
    return jsonify({"ok": True, "mensaje": "¡Pedido confirmado!"})

@app.route("/api/pedido/estado", methods=["POST"])
def api_pedido_estado():
    """Cambia el estado de una línea exacta de pedidos.txt."""
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
        return jsonify({"ok": False, "mensaje": "Pedido no encontrado."}), 404
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
    return jsonify({"ok": True, "mensaje": f"Pedido actualizado a '{nuevo_estado}'."})

# ── Dashboard ─────────────────────────────────────────────────

@app.route("/dashboard")
def dashboard():
    """Panel admin. Solo usuario 001."""
    usuario = session.get("usuario")
    if not usuario or usuario["codigo"] != "001":
        return redirect(url_for("inicio"))

    usuarios  = leer_usuarios()
    pedidos   = leer_pedidos()
    productos = leer_productos()

    # ✅ JOIN que alimenta los gráficos — no tocar
    pedidos_enriquecidos = enriquecer_pedidos_con_usuarios(pedidos, usuarios)

    pedidos_espera      = [p for p in pedidos_enriquecidos if p["estado"] == "espera"]
    pedidos_confirmados = [p for p in pedidos_enriquecidos if p["estado"] == "confirmado"]

    total_ventas   = round(sum(p["subtotal"] for p in pedidos_enriquecidos), 2)
    total_pedidos  = len(pedidos_enriquecidos)
    total_usuarios = len(usuarios)

    # ── Datos para Chart.js: ventas agrupadas por usuario ──
    # Clave = "001 - Omar Vilela", valor = total S/ gastado
    ventas_por_usuario: dict[str, float] = {}
    for p in pedidos_enriquecidos:
        clave = f"{p['codigo_usuario']} - {p['nombre_usuario']}"
        ventas_por_usuario[clave] = round(
            ventas_por_usuario.get(clave, 0) + p["subtotal"], 2
        )

    # ── Resumen por producto para la tabla ──
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
        # Listas paralelas que Chart.js consume vía data-*
        chart_labels        = list(ventas_por_usuario.keys()),
        chart_data          = list(ventas_por_usuario.values()),
    )


if __name__ == "__main__":
    app.run(debug=True)