// Función para cambiar de pestaña al hacer clic
function openTab(event, tabId) {
    // 1. Ocultar todos los contenidos de pestaña
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    // 2. Desmarcar todos los botones
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Mostrar la pestaña seleccionada y marcar el botón presionado
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
    }
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// --- CRONÓMETRO DE TIEMPO JUNTOS ---
// Fecha ajustada: 15 de agosto de 2026 a las 11:00 PM (23:00)
// Nota: En JavaScript los meses van de 0 a 11 (Agosto = 7)
const startDate = new Date(2026, 7, 15, 23, 0, 0); 

function updateTimer() {
    const now = new Date();
    const difference = now - startDate;

    if (difference < 0) return; // Si la fecha es futura, no calcula negativos

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / (1000 * 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    // Formato para añadir un 0 inicial a números de un solo dígito (ej: 05, 08)
    const formatNumber = (num) => String(num).padStart(2, '0');

    const d = document.getElementById("days");
    const h = document.getElementById("hours");
    const m = document.getElementById("minutes");
    const s = document.getElementById("seconds");

    if (d && h && m && s) {
        d.innerText = days;
        h.innerText = formatNumber(hours);
        m.innerText = formatNumber(minutes);
        s.innerText = formatNumber(seconds);
    }
}

setInterval(updateTimer, 1000);
updateTimer();