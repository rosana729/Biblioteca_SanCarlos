# Cambios aplicados

## 1. Buscador de libros al crear un préstamo
En "Nuevo Préstamo" el `<select>` de libro se reemplazó por un campo de
texto con lista desplegable: escribís título o autor y filtra en el momento
(solo muestra libros con ejemplares disponibles).

## 2. Préstamos a personas que no son socios
- Nuevo campo `es_socio` en cada persona (`Socio` en el modelo, pero ahora
  representa a cualquier persona que puede pedir libros prestados: socio,
  alumno o profesor).
- En "Nuevo Socio" hay un selector **Socio (paga cuota) / No socio**, para
  cargar alumnos o profesores sin membresía.
- En "Nuevo Préstamo" hay un selector **Socios / Alumnos / Profesores** que
  filtra el buscador de personas según ese tipo. El buscador de personas
  también es de texto libre (nombre o DNI), igual que el de libros.
- El listado de "Socios" ahora muestra una etiqueta Socio/No socio y tiene
  filtros para verlos por separado.

## 3. Backend (Flask)
- `backend/app/models/socio.py`: columna nueva `es_socio` (booleano,
  default `True`).
- `backend/app/routes/socios.py`: se puede mandar `es_socio` al crear o
  editar una persona, y filtrar el listado con `?es_socio=true|false`.
- `backend/app/__init__.py`: mini-migración automática que agrega la
  columna a la base SQLite existente sin borrar los datos ya cargados
  (se ejecuta sola la primera vez que corras `python run.py`).
- `backend/seed.py`: se agregó un alumno de ejemplo con `es_socio=False`.

## 4. Diseño: Neumorfismo
`style.css` se rehízo completo (misma estructura de clases, no hizo
falta tocar el HTML): fondo y tarjetas de un mismo tono suave, sin
bordes, con el relieve dado por pares de sombra (una clara y una
oscura). Los inputs y los botones/pestañas activos se ven "hundidos"
(sombra interior) y el resto de las superficies se ven "elevadas".
Se sacó el glassmorphism/blur y la imagen de fondo borrosa.

(Antes de esta versión hubo una vuelta intermedia en estilo
neobrutalista, a pedido; quedó reemplazada por esta.)

## 5. Imagen de fondo + modo claro/oscuro
- Se usa `imagen.jpg` (la del estante de libros) como fondo de toda la
  app y del login, con un velo de color semitransparente encima para
  que no compita con el texto ni canse la vista. Se ve sutilmente en
  los huecos entre tarjetas.
- Botón 🌙/☀️ en el header (al lado de "+ Préstamo") para alternar
  modo claro/oscuro. Se guarda la elección en el navegador
  (`localStorage`) y se aplica antes de que la página pinte, para que
  no se vea un "flash" del tema equivocado al recargar.
- Se armó una paleta oscura completa (fondo carbón, textos claros,
  acentos ajustados) para que los colores no lastimen la vista de
  noche.
- De paso se corrigió un detalle: el texto del usuario conectado en el
  header tenía un color blanco fijo que casi no se veía sobre el
  fondo claro; ahora usa el color correcto en los dos modos.

## 6. Alerta de stock / disponibilidad de préstamo
- Cada libro muestra ahora una etiqueta de estado: **Disponible**
  (azul), **Últimos ejemplares** (ámbar — cuando queda 1 solo ejemplar
  o el 25% o menos del total) o **Sin stock** (rojo). Se ve en el
  Catálogo y también en el buscador de libros del modal de préstamo.
- Si elegís para prestar un libro con pocos ejemplares, aparece un
  aviso ("Atención: quedan pocos ejemplares de...") antes de
  confirmar.

## Verificación
Antes de armar este .zip levanté el backend real y probé la app
en un navegador (login, catálogo, modal de préstamo) en modo claro y
oscuro para confirmar que todo se viera legible — no fue solo una
revisión del código.

## Qué NO se tocó
- La carpeta `nowjs/` (una librería sin relación con este proyecto, no
  se usa desde `index.html` ni `script.js`) y `node_modules/` (183 MB,
  tampoco se usa: `firebaseconfig.js` importa Firebase desde el CDN de
  Google, no desde el paquete npm) se excluyeron de este .zip para que
  no pese tanto. Si los necesitás, están en tu .rar original.
- `backend/venv/` también se excluyó (se recrea con
  `pip install -r requirements.txt`).

## Cómo probarlo
> Nota: esto describe la versión vieja en Python/Flask. El proyecto se migró
> completo a Node.js + PostgreSQL (Supabase); ver `README.md` y, si tenés
> que sincronizar tu copia local, `actualizar_proyecto.pdf` en el Escritorio.
> Los pasos actuales son:
```
cp .env.example .env   # completar DATABASE_URL con la cadena de Supabase
npm install             # sólo una vez
npm run seed             # sólo una vez (crea las tablas y carga los datos de demo)
npm start                 # cada vez que quieras usar la app
```
Y abrís `http://127.0.0.1:5000` (un solo servidor: API + frontend juntos).
