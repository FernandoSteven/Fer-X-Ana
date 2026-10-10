"use strict";

function openTab(event, tabId) {
    document.querySelectorAll('.tab-content').forEach(panel => {
        panel.style.display = 'none';
        panel.classList.remove('active');
    });

    document.querySelectorAll('.tab-btn').forEach(button => {
        const selected = button.getAttribute('aria-controls') === tabId;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
    });

    const panel = document.getElementById(tabId);
    if (panel) {
        panel.style.display = 'block';
        panel.classList.add('active');
    }
}

window.openTab = openTab;

document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        openTab({ currentTarget: button }, button.getAttribute('aria-controls'));
    });
});

const initialTab = document.querySelector('.tab-btn.active') || document.querySelector('.tab-btn');
if (initialTab) {
    openTab({ currentTarget: initialTab }, initialTab.getAttribute('aria-controls'));
}

function getStoredValue(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setStoredValue(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

// --- CRONÓMETRO DE TIEMPO JUNTOS ---
const startDate = new Date(2026, 7, 15, 23, 0, 0);

function updateTimer() {
    const difference = Date.now() - startDate.getTime();
    const elapsed = Math.max(0, difference);
    const values = {
        days: Math.floor(elapsed / 86400000),
        hours: Math.floor((elapsed / 3600000) % 24),
        minutes: Math.floor((elapsed / 60000) % 60),
        seconds: Math.floor((elapsed / 1000) % 60)
    };
    const formatNumber = value => String(value).padStart(2, '0');
    const days = document.getElementById('days');
    const hours = document.getElementById('hours');
    const minutes = document.getElementById('minutes');
    const seconds = document.getElementById('seconds');

    if (days && hours && minutes && seconds) {
        days.textContent = values.days;
        hours.textContent = formatNumber(values.hours);
        minutes.textContent = formatNumber(values.minutes);
        seconds.textContent = formatNumber(values.seconds);
    }
}

// --- CUENTA REGRESIVA PARA EL REENCUENTRO ---
const reunionDateInput = document.getElementById('reunion-date');
const reunionDateStorageKey = 'anitaFernandoReunionDate';
const reunionClock = new Date();
const reunionHours = reunionClock.getHours();
const reunionMinutes = reunionClock.getMinutes();
const reunionSeconds = reunionClock.getSeconds();

function formatLocalDate(year, month, day) {
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function getDefaultReunionDate() {
    const now = new Date();
    const year = now.getFullYear() + (now.getMonth() === 11 ? 1 : 0);
    return formatLocalDate(year, 12, 1);
}

function updateReunionTimer() {
    if (!reunionDateInput) return;

    const parts = reunionDateInput.value.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (!year || month !== 12 || !day) return;

    const target = new Date(year, month - 1, day, reunionHours, reunionMinutes, reunionSeconds);
    let difference = Math.max(0, target.getTime() - Date.now());
    const days = Math.floor(difference / 86400000);
    difference %= 86400000;
    const hours = Math.floor(difference / 3600000);
    difference %= 3600000;
    const minutes = Math.floor(difference / 60000);
    const seconds = Math.floor((difference % 60000) / 1000);

    const values = {
        'reunion-days': days,
        'reunion-hours': hours,
        'reunion-minutes': minutes,
        'reunion-seconds': seconds
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = id === 'reunion-days' ? value : String(value).padStart(2, '0');
    });

    const message = document.getElementById('reunion-message');
    if (message) {
        message.textContent = target.getTime() <= Date.now()
            ? '¡Llegó el día de volver a vernos! 🤍'
            : 'Ya falta un poquito menos 🤍';
    }
}

if (reunionDateInput) {
    const now = new Date();
    const year = now.getFullYear() + (now.getMonth() === 11 ? 1 : 0);
    const decemberStart = formatLocalDate(year, 12, 1);
    const decemberEnd = formatLocalDate(year, 12, 31);
    reunionDateInput.min = decemberStart;
    reunionDateInput.max = decemberEnd;

    const savedDate = getStoredValue(reunionDateStorageKey);
    const validDate = savedDate && savedDate >= decemberStart && savedDate <= decemberEnd;
    if (validDate) reunionDateInput.value = savedDate;
    if (!reunionDateInput.value) reunionDateInput.value = getDefaultReunionDate();

    reunionDateInput.addEventListener('change', () => {
        if (reunionDateInput.value < decemberStart || reunionDateInput.value > decemberEnd) {
            reunionDateInput.value = getDefaultReunionDate();
        }
        setStoredValue(reunionDateStorageKey, reunionDateInput.value);
        updateReunionTimer();
    });
    setStoredValue(reunionDateStorageKey, reunionDateInput.value);
    updateReunionTimer();
}

// Helpers para listas y fotos guardadas.
function readSavedList(key) {
    try {
        const value = JSON.parse(getStoredValue(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function compressPhoto(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
        reader.onload = () => {
            const photo = new Image();
            photo.onerror = () => reject(new Error('El archivo no parece ser una imagen válida.'));
            photo.onload = () => {
                const maxSide = 1200;
                const scale = Math.min(1, maxSide / Math.max(photo.width, photo.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(photo.width * scale));
                canvas.height = Math.max(1, Math.round(photo.height * scale));
                const context = canvas.getContext('2d');
                if (!context) {
                    reject(new Error('No se pudo preparar la foto.'));
                    return;
                }
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(photo, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.78));
            };
            photo.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// --- NUESTRA MÚSICA ---
const musicStorageKey = 'anitaFernandoSongs';
const musicForm = document.getElementById('music-form');
const musicList = document.getElementById('music-list');
const musicEmpty = document.getElementById('music-empty');
const musicStatus = document.getElementById('music-status');
const songPhotoInput = document.getElementById('song-photo');
const songPhotoPreview = document.getElementById('song-photo-preview');

if (songPhotoInput && songPhotoPreview) {
    songPhotoInput.addEventListener('change', () => {
        const file = songPhotoInput.files && songPhotoInput.files[0];
        songPhotoPreview.replaceChildren();
        songPhotoPreview.hidden = !file;
        if (!file) return;

        const preview = document.createElement('img');
        preview.className = 'preview-image';
        preview.alt = 'Vista previa de la foto elegida';
        preview.src = URL.createObjectURL(file);
        songPhotoPreview.append(preview);
    });
}

function renderMusic() {
    if (!musicList || !musicEmpty) return;
    const songs = readSavedList(musicStorageKey);
    musicList.replaceChildren();
    musicEmpty.hidden = songs.length > 0;

    songs.forEach((song, index) => {
        const card = document.createElement('article');
        card.className = 'music-entry';

        if (song.photo) {
            const image = document.createElement('img');
            image.className = 'music-photo';
            image.src = song.photo;
            image.alt = 'Foto para el recuerdo musical: ' + (song.title || 'canción');
            card.append(image);
        }

        const title = document.createElement('h3');
        title.textContent = song.title || 'Nuestra canción';
        card.append(title);

        if (song.note) {
            const note = document.createElement('p');
            note.textContent = song.note;
            card.append(note);
        }

        if (song.url) {
            try {
                const url = new URL(song.url);
                if (['http:', 'https:'].includes(url.protocol)) {
                    const link = document.createElement('a');
                    link.className = 'song-link';
                    link.href = url.href;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Escuchar esta canción ♫';
                    card.append(link);
                }
            } catch {
                // Se omite el enlace si no es válido.
            }
        }

        const date = document.createElement('time');
        date.className = 'entry-date';
        date.dateTime = song.createdAt || '';
        date.textContent = song.createdAt
            ? new Date(song.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
            : '';
        card.append(date);

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-btn';
        removeButton.type = 'button';
        removeButton.textContent = 'Quitar recuerdo';
        removeButton.addEventListener('click', () => {
            const updated = readSavedList(musicStorageKey);
            updated.splice(index, 1);
            setStoredValue(musicStorageKey, JSON.stringify(updated));
            renderMusic();
        });
        card.append(removeButton);
        musicList.append(card);
    });
}

if (musicForm) {
    musicForm.addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('song-title').value.trim();
        const note = document.getElementById('song-note').value.trim();
        const file = songPhotoInput && songPhotoInput.files && songPhotoInput.files[0];
        const rawUrl = document.getElementById('song-url').value.trim();
        const submitButton = musicForm.querySelector('button[type="submit"]');

        if (!title || !note || !file) {
            if (musicStatus) musicStatus.textContent = 'Completa el nombre, el texto y elige una foto.';
            return;
        }

        let safeUrl = '';
        if (rawUrl) {
            try {
                const parsedUrl = new URL(rawUrl);
                if (['http:', 'https:'].includes(parsedUrl.protocol)) safeUrl = parsedUrl.href;
            } catch {
                if (musicStatus) musicStatus.textContent = 'Revisa el enlace de la canción.';
                return;
            }
        }

        if (submitButton) submitButton.disabled = true;
        if (musicStatus) musicStatus.textContent = 'Preparando y guardando su recuerdo...';

        try {
            const photo = await compressPhoto(file);
            const songs = readSavedList(musicStorageKey);
            songs.unshift({
                title: title,
                note: note,
                url: safeUrl,
                photo: photo,
                createdAt: new Date().toISOString()
            });

            if (!setStoredValue(musicStorageKey, JSON.stringify(songs))) {
                if (musicStatus) musicStatus.textContent = 'No se pudo guardar. El almacenamiento del navegador está lleno o bloqueado.';
                return;
            }

            musicForm.reset();
            if (songPhotoPreview) {
                songPhotoPreview.replaceChildren();
                songPhotoPreview.hidden = true;
            }
            if (musicStatus) musicStatus.textContent = 'Guardado con mucho cariño 🤍';
            renderMusic();
        } catch (error) {
            if (musicStatus) musicStatus.textContent = error.message || 'No se pudo guardar la foto.';
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}
renderMusic();

// --- DIARIO ---
const diaryStorageKey = 'anitaFernandoDiary';
const diaryForm = document.getElementById('diary-form');
const diaryList = document.getElementById('diary-list');
const diaryEmpty = document.getElementById('diary-empty');
const diaryStatus = document.getElementById('diary-status');

function renderDiary() {
    if (!diaryList || !diaryEmpty) return;
    const entries = readSavedList(diaryStorageKey);
    diaryList.replaceChildren();
    diaryEmpty.hidden = entries.length > 0;

    entries.forEach((entry, index) => {
        const card = document.createElement('article');
        card.className = 'diary-entry';

        const heading = document.createElement('div');
        heading.className = 'diary-entry-heading';
        const title = document.createElement('h3');
        title.textContent = entry.title || 'Un recuerdo nuestro';
        const date = document.createElement('time');
        date.dateTime = entry.createdAt;
        date.textContent = new Date(entry.createdAt).toLocaleString('es', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        heading.append(title, date);

        const body = document.createElement('p');
        body.textContent = entry.text;
        card.append(heading, body);

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-btn';
        removeButton.type = 'button';
        removeButton.textContent = 'Eliminar registro';
        removeButton.addEventListener('click', () => {
            const updated = readSavedList(diaryStorageKey);
            updated.splice(index, 1);
            setStoredValue(diaryStorageKey, JSON.stringify(updated));
            renderDiary();
        });
        card.append(removeButton);
        diaryList.append(card);
    });
}

if (diaryForm) {
    diaryForm.addEventListener('submit', event => {
        event.preventDefault();
        const title = document.getElementById('diary-title').value.trim();
        const text = document.getElementById('diary-entry').value.trim();
        if (!text) return;

        const entries = readSavedList(diaryStorageKey);
        entries.unshift({
            title: title,
            text: text,
            createdAt: new Date().toISOString()
        });

        if (!setStoredValue(diaryStorageKey, JSON.stringify(entries))) {
            if (diaryStatus) diaryStatus.textContent = 'No se pudo guardar en este navegador.';
            return;
        }

        diaryForm.reset();
        if (diaryStatus) diaryStatus.textContent = 'Tu recuerdo quedó guardado 🤍';
        renderDiary();
    });
}
renderDiary();

updateTimer();
setInterval(updateTimer, 1000);
setInterval(updateReunionTimer, 1000);
