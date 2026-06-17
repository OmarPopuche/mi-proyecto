# ============================================================
# app.py — FastFoot Backend (versión corregida + productos)
# Omar Vilela | Full-Stack Engineer
# ============================================================

import os
from datetime import datetime
from flask import (
    Flask, request, render_template,
    redirect, url_for, session, jsonify
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_key_cambiar_en_produccion")

# ============================================================
# 📂 CONSTANTES
# ============================================================
ARCHIVO_USUARIOS  = "usuarios.txt"
ARCHIVO_PEDIDOS   = "pedidos.txt"
ARCHIVO_PRODUCTOS = "productos.txt"


# ============================================================
# 📂 HELPERS — Usuarios (sin cambios)
# ============================================================

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


# ============================================================
# 📂 HELPERS — Pedidos
#
# ✅ CORRECCIÓN CENTRAL: usamos enumerate() para asignar
# el número de línea real (line_index) a cada pedido.
#
# Este índice representa la posición EXACTA en el archivo txt,
# por lo que el backend puede localizar y modificar esa línea
# sin ambigüedad, incluso si hay pedidos del mismo usuario.
#
# Formato del txt (6 campos):
#   codigo_usuario, producto, cantidad, precio, estado, timestamp
#
# Compatibilidad con datos legacy (4 campos):
#   estado = "espera", timestamp = "N/D"
# ============================================================

def leer_pedidos() -> list[dict]:
    """
    Lee pedidos.txt y asigna a cada pedido su índice de línea
    como 'line_index'. Este valor es el que el frontend devuelve
    al backend para identificar qué línea modificar.
    """
    pedidos = []
    try:
        with open(ARCHIVO_PEDIDOS, "r", encoding="utf-8") as f:
            for line_index, linea in enumerate(f):
                # ── Ignorar líneas en blanco o malformadas ──
                linea_limpia = linea.strip()
                if not linea_limpia:
                    continue

                partes = linea_limpia.split(",")
                if len(partes) < 4:
                    continue

                pedidos.append({
                    # ✅ line_index es el número de línea en el archivo.
                    # Es el único identificador confiable para localizar
                    # el pedido sin necesidad de un campo ID extra en el txt.
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
    """Sobreescribe pedidos.txt con el formato completo de 6 campos."""
    with open(ARCHIVO_PEDIDOS, "w", encoding="utf-8") as f:
        for p in pedidos:
            f.write(
                f"{p['codigo_usuario']},"
                f"{p['producto']},"
                f"{p['cantidad']},"
                f"{p['precio']},"
                f"{p['estado']},"
                f"{p['timestamp']}\n"
            )


def enriquecer_pedidos_con_usuarios(
    pedidos: list[dict],
    usuarios: list[dict]
) -> list[dict]:
    """
    JOIN en memoria entre pedidos y usuarios.
    Agrega 'nombre_usuario' y 'subtotal' a cada pedido.
    """
    indice = {u["codigo"]: u for u in usuarios}
    for p in pedidos:
        u = indice.get(p["codigo_usuario"])
        p["nombre_usuario"] = (
            f"{u['nombres']} {u['apellidos']}" if u else "Usuario eliminado"
        )
        p["subtotal"] = round(p["cantidad"] * p["precio"], 2)
    return pedidos


# ============================================================
# 📂 HELPERS — Productos
#
# Formato de productos.txt:
#   ID_Producto, Nombre_Producto, Precio, Categoria
#   Ej: P01,Pollo a la brasa,17.0,Principales
#
# ✅ Por qué usamos "P01" y no índice de línea como ID:
#   El índice de línea cambia si se eliminan productos.
#   Un ID fijo tipo "P01" persiste en el archivo y es seguro
#   para mostrar al cliente y referenciar en el carrito.
# ============================================================

def leer_productos() -> list[dict]:
    """
    Lee productos.txt.
    Retorna lista de dicts con line_index para operaciones de eliminación.
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

                productos.append({
                    # line_index para eliminación (igual que pedidos)
                    "line_index": line_index,
                    "id_producto": partes[0].strip(),       # Ej: "P01"
                    "nombre":      partes[1].strip(),
                    "precio":      float(partes[2].strip()),
                    "categoria":   partes[3].strip() if len(partes) > 3 else "General",
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
                f"{p['categoria']}\n"
            )


def generar_id_producto() -> str:
    """
    Genera el próximo ID de producto correlativo (P01, P02, ...).
    Lee el último ID del archivo y suma 1.
    Si no hay productos, empieza en P01.
    """
    productos = leer_productos()
    if not productos:
        return "P01"

    # Extraer el número del último ID (P01 → 1)
    try:
        ultimo_num = int(productos[-1]["id_producto"][1:])
        return f"P{str(ultimo_num + 1).zfill(2)}"
    except (ValueError, IndexError):
        return f"P{str(len(productos) + 1).zfill(2)}"


# ============================================================
# 🔒 HELPER — Verificar admin
# ============================================================

def verificar_admin():
    """
    Verifica sesión de admin (código 001).
    Retorna tupla (json_response, status) si falla, None si pasa.
    """
    usuario = session.get("usuario")
    if not usuario:
        return jsonify({"ok": False, "mensaje": "No hay sesión activa."}), 401
    if usuario["codigo"] != "001":
        return jsonify({"ok": False, "mensaje": "Acción reservada para administrador."}), 403
    return None


# ============================================================
# 🔹 RUTAS
# ============================================================

@app.route("/")
def inicio():
    """
    Página principal.
    ✅ NUEVO: pasa la lista de productos al template para
    que el menú sea dinámico (ya no hardcodeado en el HTML).
    """
    productos = leer_productos()
    return render_template(
        "index.html",
        usuario=session.get("usuario"),
        productos=productos
    )


# ── API Usuarios ─────────────────────────────────────────────

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


# ── API Pedidos ───────────────────────────────────────────────

@app.route("/api/pedido", methods=["POST"])
def api_pedido():
    """Guarda un pedido nuevo con estado 'espera'."""
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
    """
    ✅ CORRECCIÓN: Cambia el estado de un pedido usando line_index.

    Flujo:
      1. Frontend envía { line_index: N, estado: "confirmado" }
      2. Leemos todas las líneas del archivo como texto crudo
      3. Modificamos solo la línea N
      4. Reescribimos el archivo completo

    ¿Por qué leer líneas crudas y no leer_pedidos()?
    Porque leer_pedidos() filtra líneas vacías y puede
    desincronizar el índice. Aquí necesitamos fidelidad total
    con el número de línea real del archivo.
    """
    err = verificar_admin()
    if err:
        return err

    data        = request.get_json(silent=True)
    line_index  = data.get("line_index")
    nuevo_estado = data.get("estado", "").strip()

    # Validar estado
    if nuevo_estado not in ("espera", "confirmado"):
        return jsonify({"ok": False, "mensaje": "Estado inválido."}), 400

    # Validar que line_index sea un entero
    if not isinstance(line_index, int) or line_index < 0:
        return jsonify({"ok": False, "mensaje": "Identificador de pedido inválido."}), 400

    # ── Leer el archivo como líneas crudas ──
    try:
        with open(ARCHIVO_PEDIDOS, "r", encoding="utf-8") as f:
            lineas = f.readlines()   # Conserva \n al final de cada línea
    except FileNotFoundError:
        return jsonify({"ok": False, "mensaje": "Archivo de pedidos no encontrado."}), 404

    # Verificar que el índice existe
    if line_index >= len(lineas):
        return jsonify({"ok": False, "mensaje": "Pedido no encontrado."}), 404

    # ── Parsear y modificar solo la línea indicada ──
    partes = lineas[line_index].strip().split(",")

    if len(partes) < 4:
        return jsonify({"ok": False, "mensaje": "Línea de pedido malformada."}), 400

    # Reconstruir la línea con el nuevo estado
    # Aseguramos que siempre haya 6 campos aunque sea dato legacy
    codigo_usuario = partes[0].strip()
    producto       = partes[1].strip()
    cantidad       = partes[2].strip()
    precio         = partes[3].strip()
    timestamp      = partes[5].strip() if len(partes) > 5 else "N/D"

    lineas[line_index] = f"{codigo_usuario},{producto},{cantidad},{precio},{nuevo_estado},{timestamp}\n"

    # ── Reescribir el archivo completo ──
    with open(ARCHIVO_PEDIDOS, "w", encoding="utf-8") as f:
        f.writelines(lineas)

    return jsonify({"ok": True, "mensaje": f"Pedido actualizado a '{nuevo_estado}'."})


# ── API Productos ─────────────────────────────────────────────

@app.route("/api/productos", methods=["GET"])
def api_productos_listar():
    """
    Lista todos los productos.
    Público: lo usa el frontend para renderizar el menú dinámico.
    """
    return jsonify({"ok": True, "productos": leer_productos()})


@app.route("/api/productos", methods=["POST"])
def api_productos_crear():
    """
    Crea un producto nuevo en productos.txt.
    Solo admin 001.
    Body: { nombre, precio, categoria }
    """
    err = verificar_admin()
    if err:
        return err

    data      = request.get_json(silent=True)
    nombre    = data.get("nombre", "").strip().replace(",", "")
    categoria = data.get("categoria", "General").strip().replace(",", "")

    if not nombre:
        return jsonify({"ok": False, "mensaje": "El nombre es obligatorio."})

    try:
        precio = round(float(data.get("precio")), 2)
        if precio <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"ok": False, "mensaje": "Precio inválido."})

    # Verificar duplicado por nombre (case-insensitive)
    if any(p["nombre"].lower() == nombre.lower() for p in leer_productos()):
        return jsonify({"ok": False, "mensaje": f"Ya existe '{nombre}' en el menú."})

    nuevo_id = generar_id_producto()

    with open(ARCHIVO_PRODUCTOS, "a", encoding="utf-8") as f:
        f.write(f"{nuevo_id},{nombre},{precio},{categoria}\n")

    producto_creado = {
        "line_index":  len(leer_productos()) - 1,
        "id_producto": nuevo_id,
        "nombre":      nombre,
        "precio":      precio,
        "categoria":   categoria,
    }

    return jsonify({"ok": True, "mensaje": f"'{nombre}' agregado al menú.", "producto": producto_creado})


@app.route("/api/productos/<int:line_index>", methods=["DELETE"])
def api_productos_eliminar(line_index):
    """
    Elimina un producto por su line_index.
    ✅ Mismo patrón que pedidos: leer líneas crudas,
    quitar la línea N, reescribir el archivo.
    Solo admin 001.
    """
    err = verificar_admin()
    if err:
        return err

    try:
        with open(ARCHIVO_PRODUCTOS, "r", encoding="utf-8") as f:
            lineas = f.readlines()
    except FileNotFoundError:
        return jsonify({"ok": False, "mensaje": "Archivo de productos no encontrado."}), 404

    if line_index < 0 or line_index >= len(lineas):
        return jsonify({"ok": False, "mensaje": "Producto no encontrado."}), 404

    # Identificar el nombre antes de eliminar (para el mensaje)
    partes = lineas[line_index].strip().split(",")
    nombre_eliminado = partes[1].strip() if len(partes) > 1 else "Desconocido"

    # Eliminar la línea y reescribir
    del lineas[line_index]

    with open(ARCHIVO_PRODUCTOS, "w", encoding="utf-8") as f:
        f.writelines(lineas)

    return jsonify({"ok": True, "mensaje": f"'{nombre_eliminado}' eliminado del menú."})


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

    pedidos_enriquecidos = enriquecer_pedidos_con_usuarios(pedidos, usuarios)

    pedidos_espera      = [p for p in pedidos_enriquecidos if p["estado"] == "espera"]
    pedidos_confirmados = [p for p in pedidos_enriquecidos if p["estado"] == "confirmado"]

    total_ventas   = round(sum(p["subtotal"] for p in pedidos_enriquecidos), 2)
    total_pedidos  = len(pedidos_enriquecidos)
    total_usuarios = len(usuarios)

    ventas_por_usuario = {}
    for p in pedidos_enriquecidos:
        clave = f"{p['codigo_usuario']} - {p['nombre_usuario']}"
        ventas_por_usuario[clave] = round(
            ventas_por_usuario.get(clave, 0) + p["subtotal"], 2
        )

    resumen_productos = {}
    for p in pedidos_enriquecidos:
        if p["producto"] not in resumen_productos:
            resumen_productos[p["producto"]] = {"cantidad": 0, "total": 0.0}
        resumen_productos[p["producto"]]["cantidad"] += p["cantidad"]
        resumen_productos[p["producto"]]["total"]     = round(
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