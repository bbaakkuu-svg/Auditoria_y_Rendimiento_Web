console.log('Iniciando script1.js...');

// Cronómetro de CPU para medir el tiempo del bucle en milisegundos
console.time('Tiempo CPU - Script 1');

for (let i = 0; i < 50000000; i++) {
  // Hito de control dentro del bucle para evidenciar el progreso en consola
  if (i === 25000000) {
    console.log('Script 1: 50% completado (25M iteraciones)');
  }
}

console.timeEnd('Tiempo CPU - Script 1');

// Intento de modificación del DOM
document.getElementById('titulo').innerText = 'Hola Script 1';

console.log('script1.js finalizado con éxito.');
