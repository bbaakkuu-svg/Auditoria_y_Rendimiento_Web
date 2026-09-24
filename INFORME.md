# Auditoría Técnica y Rendimiento Web

**Materia:** Desarrollo Web en Entorno Cliente (DWEC)  
**Entorno auditado:** YouTube Web (Single-Page Application - SPA)  
**Herramienta:** Google Chrome DevTools  


---

## Actividad 1: Laboratorio de Auditoría y Rendimiento Web

### 1. Auditoría de Red (Network): Modelo Cliente vs Servidor

#### Evidencias capturadas
- **Petición del documento base (HTML):** ![DWEC-Act1.png](DWEC-Act1.png)
- **Descarga de scripts (JS):** ![DWEC-Act1.1.png](DWEC-Act1.1.png)

#### Datos métricos obtenidos
| Métrica / Recurso | Documento Inicial (`Doc`) | Scripts (`JS`) |
| :--- | :--- | :--- |
| **Recurso principal** | `watch?v=...` | Múltiples bundles (`base.js`, `kevlar_base_module`, etc.) |
| **Tamaño transferido** | ~0.3 kB (cache/service worker) / 36.2 kB inicial | 44.7 MB transferidos (en sesión activa) |
| **Tamaño descomprimido en memoria** | 1.64 MB | 64.6 MB recursos totales |
| **Tiempo de carga** | `DOMContentLoaded`: 11.56 s | `Load`: 12.98 s |

#### Análisis comparativo: SSR vs CSR
A tenor de los modelos de ejecución analizados en la materia, YouTube opera bajo un esquema **CSR (Client-Side Rendering)** fundamentado en el peso insignificante del documento inicial frente a los más de 64 MB de scripts JavaScript confirma que la carga de renderizado se traslada por completo al navegador del cliente. Esto descarga de trabajo computacional al servidor y permite una navegación fluida sin recargas completas de página, a expensas de requerir mayor potencia de procesamiento en el dispositivo del usuario.

---

### 2. Destripando el Motor (Performance): Fases de Ejecución en V8.

Durante una interacción típica en una aplicación SPA, el motor **V8** de Chromium (al igual que **SpiderMonkey** en Firefox o **JavaScriptCore** en Safari/Bun) procesa el código a través de cuatro fases fundamentales en el hilo principal (*Main Thread*):
![Motor_V8](Motor_V8.png)

```
[ Código Fuente JS ] 
         │
         ▼ (1. Parser)
     [ AST ] 
         │
         ▼ (2. Intérprete)
   [ Bytecode ] ──► (3. Perfilado / Monitoriza "Hot Code")
         │                     │
         │                     ▼ (4. Compilador Optimizador)
         └─────────────► [ Código Máquina Nativo ]
                               │ (Si fallan suposiciones de tipo)
                               ▼
                       [ Desoptimización ]
```

En el recuadro rojo del hilo Principal (Main thread) de YouTube, el motor V8 se encuentra en plena fase de atención de eventos de interacción y ejecución activa de scripts:
1. Gestión de eventos de usuario (Evento: pointermove):El usuario está desplazando el cursor o interactuando sobre el reproductor de YouTube. El navegador captura el evento del puntero y llama al manejador de eventos correspondiente en JavaScript.   
2. Ejecución recurrente de funciones (Llamada de función / Bloques amarillos):V8 está ejecutando la pila de llamadas asociada a ese movimiento (como calcular la posición de la barra de progreso del vídeo, mostrar/ocultar los controles del reproductor o calcular tooltips).   
3. Muestreo del perfilador (Profiler - Sobrecarga de...n de perfiles):La barra gris inferior indica la sobrecarga del perfilador (profiling overhead) recopilando muestras de ejecución para rastrear qué funciones son las más lentas o repetitivas.   
4. Tareas largas y cuellos de botella (Triángulos rojos):Los triángulos rojos en las esquinas superiores de los bloques alertan de tareas largas (Long Tasks) que saturan el hilo principal durante más tiempo del recomendado (> 50 ms), lo que puede causar microtirones (jank) en la fluidez de la interfaz de usuario.   

---

### 3. El Sandbox del Navegador en Acción (Consola).

El principio rector del **Sandbox** del navegador establece que *todo código descargado desde internet debe asumirse como potencialmente peligroso*, debiendo ejecutarse en un entorno estrictamente aislado del sistema operativo anfitrión.

#### Prueba A: Código legítimo (Memoria interna)
![Sandbox1](SandBox_Console.png)

```javascript
const a = "Bienvenidos";
console.log(a);
// Salida: eoo (undefined como retorno)
```
- **Comportamiento:** La variable se instancia en el contexto de ejecución global de la ventana (*Window scope*) y utiliza las APIs seguras del navegador sin salir de los límites de memoria asignados a la pestaña.

#### Prueba B: Violación del Sandbox (Intento de acceso al disco local)
![Sandbox2](SandBox_FileReader.png)

```javascript
const r= new FileReader();
r.readAsText("C:\Users\LENOVO\Desktop\Downloads");
r.onLoad = function(){ console.log(r.result);}﻿﻿
```
- **Restricción provocada:** 
La restricción activada es el aislamiento de acceso directo al sistema de archivos local (Local File System Isolation) impuesto por el Sandbox del motor del navegador:
Inexistencia de rutas locales arbitrarias: Las APIs web del navegador (como FileReader) no admiten bajo ningún concepto rutas de archivo absolutas o relativas en formato de cadena de texto (String como "C:\Users\..."). 

- **Mecanismos de defensa activos:**
  El Sandbox actúa como una barrera de aislamiento que impide que el código JavaScript descargado de internet interactúe directamente con el sistema operativo anfitrión:

1. Protección contra filtración de datos confidenciales (Exfiltración):
   Si una página web pudiera leer rutas arbitrarias como "C:\Users\...", cualquier sitio malicioso que visites podría ejecutar un script en segundo plano para leer y enviar a un servidor externo tus claves SSH, historiales, contraseñas, documentos de identidad o archivos del sistema sin tu conocimiento.

2. Garantía del principio de mínimo privilegio y consentimiento explícito:
   El modelo de seguridad web exige que el usuario sea el único que autoriza qué archivo específico puede ver la aplicación. El navegador jamás le otorga a un script la capacidad de inspeccionar carpetas o navegar libremente por el disco duro.

3. Prevención de ejecución remota de código y manipulación:
   Al bloquear el acceso directo al árbol de directorios local, se evita que scripts de terceros puedan modificar archivos de configuración del sistema operativo, inyectar malware o comprometer la integridad del equipo.

---

### 4. Análisis de Bloqueo: Scripts vs Programación Tradicional.

#### Identificación del script pesado
![DWEC-Act1.1.png](DWEC-Act1.1.png)

En la auditoría de red  se identifican bundles de infraestructura modular como `base.js` o agregados de Polymer/Kevlar (`m=kevlar_base_module...`) cuyos tamaños descomprimidos en memoria superan ampliamente **1 MB**.


#### Impacto en la experiencia de usuario: Ejecución Síncrona vs Asíncrona (Event-Driven)

| Dimensión técnica | Ejecución Síncrona Tradicional | Ejecución Asíncrona Orientada a Eventos |
| :--- | :--- | :--- |
| **Hilo Principal (*Main Thread*)** | Monopolizado por completo durante la descarga y la compilación JIT. | Libre. Descarga fuera del hilo de renderizado; ejecución diferida. |
| **Construcción del DOM** | Bloqueo total del analizador (*Parser-blocking*). La pantalla permanece en blanco. | Continua. El árbol DOM y CSSOM se construyen sin interrupciones. |
| **Bucle de Eventos (*Event Loop*)** | Congelado. No se despachan tareas ni microtareas de interacción del usuario. | Activo. La cola de tareas procesa clics, scroll y teclado de forma fluida. |
| **Métricas Core Web Vitals** | TBT (*Total Blocking Time*) crítico e INP (*Interaction to Next Paint*) inaceptable. | TBT e INP optimizados; respuesta visual en menos de 100 ms (60 fps). |
| **Percepción del usuario** | Interfaz no responsiva; advertencia del navegador: *"Esta página no responde"*. | Experiencia reactiva con hidratación progresiva de componentes. |


