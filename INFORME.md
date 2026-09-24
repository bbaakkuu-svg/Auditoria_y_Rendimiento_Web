# Auditoría Técnica y Rendimiento Web

**Materia:** Desarrollo Web en Entorno Cliente (DWEC)  
**Entorno auditado:** YouTube Web (Single-Page Application - SPA)  
**Herramienta:** Google Chrome DevTools  


---

## Actividad 1: Laboratorio de Auditoría y Rendimiento Web

### 1. Auditoría de Red (Network): Modelo Cliente vs Servidor (CE a)

#### Evidencias capturadas
- **Petición del documento base (HTML):** [DWEC-Act1.png](DWEC-Act1.png)
- **Descarga de scripts (JS):** [DWEC-Act1.1.png](DWEC-Act1.1.png)

#### Datos métricos obtenidos
| Métrica / Recurso | Documento Inicial (`Doc`) | Scripts (`JS`) |
| :--- | :--- | :--- |
| **Recurso principal** | `watch?v=...` | Múltiples bundles (`base.js`, `kevlar_base_module`, etc.) |
| **Tamaño transferido** | ~0.3 kB (cache/service worker) / 36.2 kB inicial | 44.7 MB transferidos (en sesión activa) |
| **Tamaño descomprimido en memoria** | 1.64 MB | 64.6 MB recursos totales |
| **Tiempo de carga** | `DOMContentLoaded`: 11.56 s | `Load`: 12.98 s |

#### Análisis comparativo: SSR vs CSR
A tenor de los modelos de ejecución analizados en la materia, YouTube opera bajo un esquema **CSR (Client-Side Rendering)** fundamentado en una arquitectura **App Shell**:

```
[ Servidor Web ] ──► Envía HTML esqueleto (~36 kB) + Bundles JS (>64 MB)
                             │
                             ▼
[ Navegador Cliente ] ──► Ejecuta JS en V8 ──► Renderiza DOM dinámico e interactivo
```

1. **Enfoque Servidor (SSR tradicional):** El servidor ejecuta el código antes de la entrega y genera un HTML completamente estructurado con la información incrustada. Aunque ofrece mayor seguridad inicial y menor dependencia de la CPU del usuario, exige comunicación constante con el servidor ante cualquier cambio de estado.
2. **Enfoque Cliente (CSR en SPA):** El HTML entregado carece de contenido semántico real (vídeos, títulos, comentarios); únicamente contiene metadatos (`<meta>`), enlaces a bundles y contenedores vacíos como `<ytd-app>`. 
3. **Diagnóstico técnico:** El peso insignificante del documento inicial frente a los más de 64 MB de scripts JavaScript confirma que la carga de renderizado se traslada por completo al navegador del cliente. Esto descarga de trabajo computacional al servidor y permite una navegación fluida sin recargas completas de página, a expensas de requerir mayor potencia de procesamiento en el dispositivo del usuario.

---

### 2. Destripando el Motor (Performance): Fases de Ejecución en V8 (CE b, CE f)

Durante una interacción típica en una aplicación SPA, el motor **V8** de Chromium (al igual que **SpiderMonkey** en Firefox o **JavaScriptCore** en Safari/Bun) procesa el código a través de cuatro fases fundamentales en el hilo principal (*Main Thread*):

```
[ Código Fuente JS ] 
         │
         ▼ (1. Parser)
     [ AST ] 
         │
         ▼ (2. Intérprete Ignition)
   [ Bytecode ] ──► (3. Profiler / Monitoriza "Hot Code")
         │                     │
         │                     ▼ (4. TurboFan - Compilador Optimizador)
         └─────────────► [ Código Máquina Nativo ]
                               │ (Si fallan suposiciones de tipo)
                               ▼
                       [ Desoptimización ]
```

1. **Parser (Analizador sintáctico):**
   - El analizador sintáctico (*Blink Parser* y el parser léxico de V8) traduce la secuencia plana de caracteres a una estructura jerárquica de árbol denominada **AST (Árbol de Sintaxis Abstracta)** y genera los ámbitos de variables (*Scopes*).
   - Durante el **Parse HTML**, si el navegador encuentra un script síncrono, suspende la construcción del DOM hasta que el archivo se descargue y analice por completo.
2. **Intérprete básico (Ignition):**
   - Transforma el AST de forma inmediata en un *bytecode* intermedio.
   - Permite arrancar la ejecución del script con una latencia mínima (*startup time* reducido), sin esperar a compilar todo el programa a código máquina.
3. **Perfilado (Profiler):**
   - Mientras el código se interpreta, el motor monitoriza continuamente qué funciones y bucles se ejecutan repetidamente (el denominado código caliente o *hot code*, como bucles o funciones de pintado frecuentes).
   - Recopila información sobre los tipos de datos que entran en dichas funciones (*type feedback*).
4. **Compilador optimizador (TurboFan):**
   - Toma el *hot code* y lo compila directamente a código máquina ultrapotente optimizado para la CPU.
   - **Desoptimización:** Si una función optimizada recibe repentinamente un tipo de dato inesperado (debido a la naturaleza dinámica de JavaScript), el motor invalida el código máquina generado y retrocede de inmediato al intérprete básico (*deopt*), preservando la consistencia de la ejecución.
5. **Evaluate Script:**
   - Corresponde a la ejecución de estas tareas en el procesador: asignación de memoria, registro de manejadores de eventos (*event listeners*) e invocación de las fases de *Layout/Reflow* y *Paint* sobre el DOM.

---

### 3. El Sandbox del Navegador en Acción (Consola) (CE b)

El principio rector del **Sandbox** del navegador establece que *todo código descargado desde internet debe asumirse como potencialmente peligroso*, debiendo ejecutarse en un entorno estrictamente aislado del sistema operativo anfitrión.

#### Prueba A: Código legítimo (Memoria interna)
```javascript
const a = "eoo";
console.log(a);
// Salida: eoo (undefined como retorno)
```
- **Comportamiento:** La variable se instancia en el contexto de ejecución global de la ventana (*Window scope*) y utiliza las APIs seguras del navegador sin salir de los límites de memoria asignados a la pestaña.

#### Prueba B: Violación del Sandbox (Intento de acceso al disco local)
```javascript
try {
  const lector = new FileReader();
  const archivoFalso = new File([""], "C:/Windows/win.ini");
  lector.readAsText(archivoFalso);
} catch (e) {
  console.error("Fallo de seguridad:", e);
}
```
- **Restricción provocada:** El navegador genera un error de seguridad (`SecurityError` / `Not allowed to load local resource`). 
- **Mecanismos de defensa activos:**
  1. **Aislamiento del sistema de archivos:** JavaScript en el cliente no posee descriptores de archivo (*file handles*) del sistema anfitrión ni punteros a rutas absolutas (`file:///` o `C:/...`).
  2. **Intervención y consentimiento del usuario:** La única vía legítima para que un script lea un archivo es mediante una acción manual, explícita y consciente del usuario (a través de `<input type="file">` o el *File System Access API* con selector nativo).
  3. **Aislamiento de procesos (*Process Isolation*) y Política del Mismo Origen (*Same-Origin Policy*):** El proceso de renderizado no dispone de privilegios a nivel de kernel; si un script sufriese un ataque XSS o procediera de un sitio web malicioso, el Sandbox impide de forma inviolable que pueda sustraer documentos confidenciales, credenciales o inyectar código dañino en el sistema del usuario.

---

### 4. Análisis de Bloqueo: Scripts vs Programación Tradicional (CE d)

#### Identificación del script pesado
En la auditoría de red ([DWEC-Act1.1.png](DWEC-Act1.1.png)) se identifican bundles de infraestructura modular como `base.js` o agregados de Polymer/Kevlar (`m=kevlar_base_module...`) cuyos tamaños descomprimidos en memoria superan ampliamente **1 MB**.

#### ¿Por qué un lenguaje de script rinde diferente a uno tradicional?
- **Programación tradicional (C++, Rust):** Se compila previamente y de forma estática a código máquina binario de bajo nivel; los tipos son fijos y el analizador detecta la mayoría de errores antes de la ejecución, logrando máxima velocidad y ejecución independiente.
- **Programación de scripts (JavaScript):** Es dinámico e interpretado; el análisis léxico, la compilación JIT y la inferencia de tipos ocurren **en tiempo de ejecución** dentro del navegador del usuario.

#### Impacto en la experiencia de usuario: Ejecución Síncrona vs Asíncrona (Event-Driven)

| Dimensión técnica | Ejecución Síncrona Tradicional | Ejecución Asíncrona Orientada a Eventos |
| :--- | :--- | :--- |
| **Hilo Principal (*Main Thread*)** | Monopolizado por completo durante la descarga y la compilación JIT. | Libre. Descarga fuera del hilo de renderizado; ejecución diferida. |
| **Construcción del DOM** | Bloqueo total del analizador (*Parser-blocking*). La pantalla permanece en blanco. | Continua. El árbol DOM y CSSOM se construyen sin interrupciones. |
| **Bucle de Eventos (*Event Loop*)** | Congelado. No se despachan tareas ni microtareas de interacción del usuario. | Activo. La cola de tareas procesa clics, scroll y teclado de forma fluida. |
| **Métricas Core Web Vitals** | TBT (*Total Blocking Time*) crítico e INP (*Interaction to Next Paint*) inaceptable. | TBT e INP optimizados; respuesta visual en menos de 100 ms (60 fps). |
| **Percepción del usuario** | Interfaz no responsiva; advertencia del navegador: *"Esta página no responde"*. | Experiencia reactiva con hidratación progresiva de componentes. |

**Conclusión:** Debido a la naturaleza monohilo (*single-threaded*) del motor de navegación, la asincronía y el modelo no bloqueante guiado por eventos constituyen la piedra angular del desarrollo web cliente moderno para manipular scripts pesados sin deteriorar el rendimiento.
