console.log('Iniciando script2.js...');

// Cronómetro de CPU para medir el tiempo del bucle en milisegundos
console.time('Tiempo CPU - Script 2');

for (let i = 0; i < 50000000; i++) {
  // Hito de control dentro del bucle para evidenciar el progreso en consola
  if (i === 25000000) {
    console.log('Script 2: 50% completado (25M iteraciones)');
  }
}

console.timeEnd('Tiempo CPU - Script 2');

// Intento de modificación del DOM
document.getElementById('titulo').innerText = '¿Qué tal Script 2?';

console.log('script2.js finalizado con éxito. (H1 mutado a "¿Qué tal Script 2?")');
