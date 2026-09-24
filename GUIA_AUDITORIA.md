# Guía Práctica: Cómo Realizar una Auditoría Web con DevTools

Esta guía explica paso a paso **dónde mirar**, **qué datos extraer** y **cómo interpretar técnicamente** los resultados en Chrome DevTools para elaborar el informe de auditoría por ti mismo.

---

## 1. Auditoría de Red (`Network`): Identificación SSR vs CSR (CE a)

### Paso a paso en DevTools
1. Abre la web que vas a auditar (ej. YouTube, Spotify o X).
2. Pulsa `F12` (o `Ctrl + Shift + I`) y ve a la pestaña **Red** (*Network*).
3. Activa la casilla **Inhabilitar caché** (*Disable cache*) para forzar la descarga limpia de todos los recursos.
4. Recarga la página con `Ctrl + F5` o `Ctrl + R`.

---

### Dónde buscar los datos

#### A. Documento HTML inicial
1. En la barra de filtros, haz clic en **Doc** (Documento).
2. Verás la primera petición realizada al servidor (suele llamarse igual que la URL o ruta, ej. `watch?...`).
3. Anota los datos de la barra inferior y de la fila:
   - **Tamaño transferido:** Lo que viajó por la red comprimido (ej. `0.3 kB` o `36 kB`).
   - **Tamaño del recurso:** El tamaño real en memoria una vez descomprimido (ej. `1.6 MB`).

```
[ Doc ] ──► Clic en la primera fila ──► Pestaña "Respuesta" (Response)
```

#### B. Scripts JavaScript
1. Cambia el filtro de la barra a **JS**.
2. Observa el pie de la ventana de DevTools:
   - Número de solicitudes JS (ej. `29 solicitudes`).
   - Total transferido y total de recursos JS (ej. `44 MB transferidos / 64 MB recursos`).

---

### Cómo saber si una web es SSR o CSR (Regla de oro)
Haz clic en la primera petición de la pestaña **Doc** y selecciona la subpestaña **Respuesta** (*Response*):
- **Es SSR (Server-Side Rendering):** Si en el código HTML que devuelve el servidor ya puedes leer los títulos de los vídeos, textos de artículos o listas con contenido. El servidor generó el DOM antes de enviarlo.
- **Es CSR (Client-Side Rendering):** Si el HTML devuelto está prácticamente vacío de contenido legible, conteniendo solo etiquetas `<meta>`, `<script>` y un contenedor raíz vacío como `<div id="root"></div>` o `<ytd-app></ytd-app>`. 
  - *Interpretación:* Si el HTML pesa pocos kilobytes y el JS decenas de megabytes, es **CSR**: el navegador se encarga de descargar el "motor" en JS y pintar los componentes dinámicamente en el cliente.

---

## 2. Destripando el Motor (`Performance`): Fases de V8 (CE b, CE f)

### Paso a paso en DevTools
1. Ve a la pestaña **Rendimiento** (*Performance*).
2. Haz clic en el botón circular de **Grabar** (círculo rojo o `Ctrl + E`).
3. Interactúa con la web durante 5 segundos (haz scroll, pausa un vídeo, haz clic en una sección).
4. Pulsa **Stop** y espera a que DevTools procese la traza.

---

### Dónde buscar cada fase en la línea de tiempo
En el gráfico de actividades, localiza la sección llamada **Principal** (*Main*), que representa el hilo principal (*Main Thread*):

```
Hilo Principal (Main):
┌─────────────────────────┬──────────────────────┬────────────────────────┐
│ Parse HTML (Azul)       │ Compile Code (Amar.) │ Evaluate Script (Amar.)│
└─────────────────────────┴──────────────────────┴────────────────────────┘
```

1. **Parse HTML (Color azul):**
   - *Qué buscar:* Bloques etiquetados como `Parse HTML`.
   - *Explicación técnica:* El motor de renderizado (*Blink*) traduce los bytes del archivo HTML a nodos del DOM tree.
2. **Compile Code / Compile Script (Color amarillo/naranja):**
   - *Qué buscar:* Bloques pequeños previos a la ejecución con nombres como `Compile Script` o `Compile Code`.
   - *Explicación técnica:* El motor JavaScript (**V8**) entra en acción mediante:
     - **Ignition:** Intérprete que genera *bytecode* de ejecución inmediata.
     - **TurboFan (JIT Compiler):** Compilador optimizador que compila a código máquina nativo las funciones más repetidas (*hot functions*).
3. **Evaluate Script (Color amarillo):**
   - *Qué buscar:* Bloques anchos de ejecución etiquetados como `Evaluate Script`, `Function Call` o `Run Microtasks`.
   - *Explicación técnica:* El procesador ejecuta las instrucciones del script compilado: crea variables, registra escuchadores de eventos y muta el DOM.

---

## 3. El Sandbox del Navegador (`Console`) (CE b)

El objetivo es demostrar que el navegador aísla los scripts web del sistema operativo anfitrión.

### Paso a paso
1. Ve a la pestaña **Consola** (*Console*).

#### Prueba 1: Código Seguro
Escribe y ejecuta:
```javascript
const a = "eoo";
console.log(a);
```
- *Resultado:* Imprime `"eoo"`. Se ejecuta dentro del espacio de memoria de la pestaña sin privilegios especiales.

#### Prueba 2: Código "Maligno" (Violación del Sandbox)
Intenta que un script lea un archivo local de tu disco sin que el usuario lo seleccione manualmente:
```javascript
const lector = new FileReader();
const archivoFalso = new File([""], "C:/Windows/win.ini");
lector.readAsText(archivoFalso);
```
o bien intenta hacer una petición directa al sistema de archivos:
```javascript
fetch("file:///C:/Windows/win.ini");
```
- *Resultado esperado:* Aparecerá un error en rojo: **`Not allowed to load local resource`** o **`SecurityError`**.
- *Explicación técnica para el informe:* 
  - El Sandbox aísla el proceso de renderizado del sistema operativo (*Process Isolation*).
  - El navegador prohíbe que cualquier script web lea archivos del disco del usuario sin una acción manual explícita (como un botón de subida `<input type="file">`). Esto protege contra virus, robo de claves y ataques XSS.

---

## 4. Análisis de Bloqueo del Hilo Principal (CE d)

### Paso a paso para identificar un script pesado
1. Vuelve a la pestaña **Red** (*Network*).
2. Asegúrate de tener el filtro **JS** activo.
3. Haz clic en la cabecera de la columna **Tamaño** (*Size*) para ordenar de mayor a menor.
4. Identifica algún archivo que supere **1 MB** (ej. bundles principales como `base.js`, `vendor.js` o módulos `kevlar`).

---

### Argumentación técnica para el informe
Debes responder a la pregunta: *¿Qué pasaría si ese script de 1 MB se ejecutase de forma síncrona tradicional?*

- **El problema del hilo único (*Single-threaded*):** JavaScript tiene un solo hilo para ejecutar lógica y para renderizar la pantalla.
- **Si fuese síncrono:** Mientras se descargan y leen esos megabytes, el navegador detiene completamente el parseo del DOM (*Parser-blocking*).
  - La pantalla se queda en blanco.
  - La interfaz se congela: los clics, el scroll y el teclado dejan de responder.
  - El navegador puede mostrar la advertencia de *"La página no responde"*.
- **La solución moderna (Asíncrona y orientada a eventos):** 
  - Se descarga en segundo plano mediante atributos como `defer`, `async` o módulos dinámicos (`import()`).
  - La ejecución se fragmenta en tareas dentro del **Event Loop**, permitiendo que el navegador siga respondiendo a las acciones del usuario a 60 cuadros por segundo.

---

## Resumen del Checklist de Capturas a Incluir

| Captura requerida | Dónde se toma | Qué debe verse claramente |
| :--- | :--- | :--- |
| **1. Auditoría Red (Doc)** | Pestaña `Network` -> filtro `Doc` | Petición inicial HTML, tamaño transferido y tiempo de carga. |
| **2. Auditoría Red (JS)** | Pestaña `Network` -> filtro `JS` | Total de scripts transferidos y recursos acumulados en la barra inferior. |
| **3. Performance (V8)** | Pestaña `Performance` tras 5s de grabación | Línea de tiempo con bloques `Parse HTML`, `Compile Script` y `Evaluate Script`. |
| **4. Sandbox (Consola)** | Pestaña `Console` | El código de prueba seguro y el error de seguridad en rojo al intentar acceder al disco. |
| **5. Script pesado** | Pestaña `Network` ordenado por tamaño | El archivo JS de más de 1 MB resaltado en la lista. |
