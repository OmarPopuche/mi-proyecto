from flask import Flask, request, render_template, render_template_string, redirect, url_for, session, jsonify

app = Flask(__name__)
app.secret_key = "clave_secreta"

# HTML del login (igual que antes)
HTML_LOGIN = """
<!DOCTYPE html>
<html>
<head>
    <title>Usuario - FastFoot</title>
</head>
<body>

<h1>FastFoot - Usuario</h1>

<p>{{ mensaje }}</p>

{% if not session.get("usuario") and not vista %}

<h2>¿Qué deseas hacer?</h2>

<form method="POST">
    <button type="submit" name="accion" value="mostrar_login">
        Iniciar Sesión
    </button>

    <button type="submit" name="accion" value="mostrar_registro">
        Registrarse
    </button>

    <button type="submit" name="accion" value="invitado">
        Continuar como invitado
    </button>
</form>

{% elif vista == "login" %}

<h2>Iniciar Sesión</h2>
<form method="POST">
    Código:<br>
    <input type="text" name="codigo"><br><br>

    <button type="submit" name="accion" value="login">Ingresar</button>
    <button type="submit" name="accion" value="volver">Volver</button>
</form>

{% elif vista == "registro" %}

<h2>Registrarse</h2>
<form method="POST">
    Código (máx 4 dígitos):<br>
    <input type="text" name="codigo"><br><br>

    Nombres:<br>
    <input type="text" name="nombres"><br><br>

    Apellidos:<br>
    <input type="text" name="apellidos"><br><br>

    <button type="submit" name="accion" value="registrar">Registrarse</button>
    <button type="submit" name="accion" value="volver">Volver</button>
</form>

{% else %}

<h2>Bienvenido {{ session["usuario"]["nombres"] }} {{ session["usuario"]["apellidos"] }}</h2>

<form method="POST">
    <input type="hidden" name="codigo" value="{{ session['usuario']['codigo'] }}">

    Nombres:<br>
    <input type="text" name="nombres" value="{{ session['usuario']['nombres'] }}"><br><br>

    Apellidos:<br>
    <input type="text" name="apellidos" value="{{ session['usuario']['apellidos'] }}"><br><br>

    <button type="submit" name="accion" value="modificar">Modificar</button>
    <button type="submit" name="accion" value="logout">Cerrar sesión</button>
    <button type="submit" name="accion" value="volver_index">Volver</button>
</form>

{% endif %}

</body>
</html>
"""

# 🔹 TU PÁGINA PRINCIPAL
@app.route("/")
def inicio():
    return render_template("index.html", usuario=session.get("usuario"))

# 🔹 LOGIN
@app.route("/login", methods=["GET", "POST"])
def login():

    mensaje = ""
    vista = None

    if request.method == "POST":

        accion = request.form["accion"]
        codigo = request.form.get("codigo", "")
        nombres = request.form.get("nombres", "")
        apellidos = request.form.get("apellidos", "")

        # CONTROL DE VISTAS
        if accion == "mostrar_login":
            vista = "login"

        elif accion == "mostrar_registro":
            vista = "registro"

        elif accion == "volver":
            vista = None

        elif accion == "volver_index":
            return redirect(url_for("inicio"))

        # VALIDACIÓN
        elif codigo and (not codigo.isdigit() or len(codigo) > 4):
            mensaje = "El código debe ser numérico y máximo 4 dígitos."

        # REGISTRAR
        elif accion == "registrar":

            with open("usuarios.txt", "a", encoding="utf-8") as archivo:
                archivo.write(f"{codigo},{nombres},{apellidos}" + "\n")

            mensaje = "Usuario registrado."
            vista = "login"

        # LOGIN
        elif accion == "login":

            try:
                with open("usuarios.txt", "r", encoding="utf-8") as archivo:

                    for linea in archivo:
                        datos = linea.strip().split(",")

                        if datos[0] == codigo:
                            session["usuario"] = {
                                "codigo": datos[0],
                                "nombres": datos[1],
                                "apellidos": datos[2]
                            }
                            return redirect(url_for("inicio"))

                    mensaje = "Código no encontrado."
                    vista = "login"

            except FileNotFoundError:
                mensaje = "No hay usuarios registrados."
                vista = "login"

        #INVITADO
        elif accion == "invitado":
            session["usuario"] = {
                "codigo": "0000",
                "nombres": "Invitado",
                "apellidos": ""
            }
            return redirect(url_for("inicio"))

        # MODIFICAR
        elif accion == "modificar":

            nuevas_lineas = []

            with open("usuarios.txt", "r", encoding="utf-8") as archivo:

                for linea in archivo:
                    datos = linea.strip().split(",")

                    if datos[0] == codigo:
                        nuevas_lineas.append(f"{codigo},{nombres},{apellidos}\\n")

                        session["usuario"] = {
                            "codigo": codigo,
                            "nombres": nombres,
                            "apellidos": apellidos
                        }
                    else:
                        nuevas_lineas.append(linea)

            with open("usuarios.txt", "w", encoding="utf-8") as archivo:
                archivo.writelines(nuevas_lineas)

            mensaje = "Datos actualizados."

        # LOGOUT
        elif accion == "logout":
            session.pop("usuario", None)
            vista = None

    return render_template_string(HTML_LOGIN, mensaje=mensaje, vista=vista)

@app.route("/api/usuario", methods=["POST"])
def api_usuario():

    data = request.get_json()
    accion = data.get("accion")

    codigo = data.get("codigo", "")
    nombres = data.get("nombres", "")
    apellidos = data.get("apellidos", "")

    # VALIDACIÓN
    if codigo and (not codigo.isdigit() or len(codigo) > 4):
        return jsonify({"ok": False, "mensaje": "Código inválido"})

    # REGISTRAR
    if accion == "registrar":

        with open("usuarios.txt", "a", encoding="utf-8") as archivo:
            archivo.write(f"{codigo},{nombres},{apellidos}\n")

        return jsonify({"ok": True, "mensaje": "Registrado correctamente"})

    # LOGIN
    elif accion == "login":

        try:
            with open("usuarios.txt", "r", encoding="utf-8") as archivo:

                for linea in archivo:
                    datos = linea.strip().split(",")

                    if datos[0] == codigo:
                        session["usuario"] = {
                            "codigo": datos[0],
                            "nombres": datos[1],
                            "apellidos": datos[2]
                        }

                        return jsonify({
                            "ok": True,
                            "usuario": session["usuario"]
                        })

            return jsonify({"ok": False, "mensaje": "No encontrado"})

        except FileNotFoundError:
            return jsonify({"ok": False, "mensaje": "Sin usuarios"})

    # LOGOUT
    elif accion == "logout":
        session.pop("usuario", None)
        return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True)