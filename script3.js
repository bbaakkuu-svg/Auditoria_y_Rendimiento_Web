console.log('Iniciando script3.js...');

// Cronómetro de CPU para medir el tiempo del bucle en milisegundos
console.time('Tiempo CPU - Script 3');

for (let i = 0; i < 50000000; i++) {
  // Hito de control dentro del bucle para evidenciar el progreso en consola
  if (i === 25000000) {
    console.log('Script 3: 50% completado (25M iteraciones)');
  }
}

console.timeEnd('Tiempo CPU - Script 3');

// Intento de modificación del DOM
document.getElementById('titulo').innerText = 'Cambiado por Script 3';

console.log('✓ script3.js finalizado con éxito. DOM final: <h1 id="titulo">Cambiado por Script 3</h1>');
