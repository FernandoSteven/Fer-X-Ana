"use strict";

// --- NAVEGACIÓN ENTRE PESTAÑAS ---
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
if (initialTab) openTab({ currentTarget: initialTab }, initialTab.getAttribute('aria-controls'));

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
    const elapsed = Math.max(0, Date.now() - startDate.getTime());
    const values = {
        days: Math.floor(elapsed / 86400000),
        hours: Math.floor((elapsed / 3600000) % 24),
        minutes: Math.floor((elapsed / 60000) % 60),
        seconds: Math.floor((elapsed / 1000) % 60)
    };
    const formatNumber = value => String(value).padStart(2, '0');
    ['days', 'hours', 'minutes', 'seconds'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = id === 'days' ? values[id] : formatNumber(values[id]);
    });
}

// --- CUENTA REGRESIVA PARA EL REENCUENTRO ---
const reunionDateInput = document.getElementById('reunion-date');
const reunionDateStorageKey = 'anitaFernandoReunionDate';
const reunionClock = new Date();

function formatLocalDate(year, month, day) {
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function decemberRange() {
    const now = new Date();
    const year = now.getFullYear() + (now.getMonth() === 11 ? 1 : 0);
    return {
        min: formatLocalDate(year, 12, 1),
        max: formatLocalDate(year, 12, 31)
    };
}

function getDefaultReunionDate() {
    return decemberRange().min;
}

function updateReunionTimer() {
    if (!reunionDateInput) return;
    const [year, month, day] = reunionDateInput.value.split('-').map(Number);
    if (!year || month !== 12 || !day) return;

    // Mantiene fija la hora local de apertura para que el contador avance cada segundo.
    const target = new Date(year, month - 1, day, reunionClock.getHours(), reunionClock.getMinutes(), reunionClock.getSeconds());
    const now = new Date();
    let difference = Math.max(0, target.getTime() - now.getTime());
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
        message.textContent = target.getTime() <= now.getTime()
            ? '¡Llegó el día de volver a vernos! 🤍'
            : 'Ya falta un poquito menos 🤍';
    }
}

if (reunionDateInput) {
    const { min, max } = decemberRange();
    reunionDateInput.min = min;
    reunionDateInput.max = max;
    const savedDate = getStoredValue(reunionDateStorageKey);
    reunionDateInput.value = savedDate && savedDate >= min && savedDate <= max
        ? savedDate
        : getDefaultReunionDate();

    reunionDateInput.addEventListener('change', () => {
        if (reunionDateInput.value < min || reunionDateInput.value > max) {
            reunionDateInput.value = getDefaultReunionDate();
        }
        setStoredValue(reunionDateStorageKey, reunionDateInput.value);
        updateReunionTimer();
    });
    setStoredValue(reunionDateStorageKey, reunionDateInput.value);
    updateReunionTimer();
}

// --- CONEXIÓN CON SUPABASE ---
const appConfig = window.APP_CONFIG || {};
const supabaseUrl = String(appConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
const supabasePublishableKey = String(appConfig.supabasePublishableKey || '').trim();
const supabaseReady = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
    && supabasePublishableKey.startsWith('sb_publishable_');
const memoriesEndpoint = supabaseUrl + '/rest/v1/memories';
const storageBucket = 'shared-memories';
let sharedMemories = [];

function supabaseErrorMessage(status, details) {
    if (details && /bucket not found|nosuchbucket/i.test(details)) {
        return 'Falta crear el espacio para las fotos. En Supabase, ejecuta completo el archivo supabase/setup.sql.';
    }
    if (status === 401 || status === 403) {
        return 'Supabase rechazó el acceso. Revisa la URL, la clave publicable y las políticas RLS.';
    }
    if (status === 404 || status === 406) {
        return 'No se encontró la tabla o el almacenamiento. Ejecuta el archivo supabase/setup.sql.';
    }
    if (details && /row-level security|permission denied/i.test(details)) {
        return 'Supabase bloqueó la operación. Revisa las políticas de acceso del archivo setup.sql.';
    }
    return 'No se pudo conectar con el espacio compartido. Inténtalo de nuevo en un momento.';
}

async function supabaseRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('apikey', supabasePublishableKey);
    headers.set('Authorization', 'Bearer ' + supabasePublishableKey);

    const response = await fetch(supabaseUrl + path, { ...options, headers });
    const responseText = await response.text();
    if (!response.ok) {
        let detail = responseText;
        try {
            const parsed = JSON.parse(responseText);
            detail = parsed.message || parsed.error_description || parsed.error || responseText;
        } catch {
            // Se conserva el texto de error que devolvió el servidor.
        }
        const error = new Error(supabaseErrorMessage(response.status, detail));
        error.status = response.status;
        throw error;
    }

    if (!responseText) return null;
    try {
        return JSON.parse(responseText);
    } catch {
        return responseText;
    }
}

function safeHttpUrl(value) {
    if (!value) return '';
    try {
        const parsed = new URL(value);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

function publicPhotoUrl(path) {
    // Solo se muestran fotos subidas con el formato que usa esta página.
    if (!/^songs\/[0-9a-f-]{36}\.jpg$/i.test(String(path || ''))) return '';
    return supabaseUrl + '/storage/v1/object/public/' + storageBucket + '/' + path
        .split('/').map(encodeURIComponent).join('/');
}

function formatEntryDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

function setStatus(element, message) {
    if (element) element.textContent = message;
}

function makeDateElement(value) {
    const date = document.createElement('time');
    date.className = 'entry-date';
    date.dateTime = value || '';
    date.textContent = formatEntryDate(value);
    return date;
}

// Las fotos se comprimen antes de enviarse. El bucket limita cada archivo a 1 MB.
function compressPhoto(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Elige un archivo de imagen válido.'));
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            reject(new Error('La foto original debe pesar menos de 15 MB.'));
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const photo = new Image();
        photo.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('No se pudo abrir la foto. Prueba con otra imagen.'));
        };
        photo.onload = async () => {
            URL.revokeObjectURL(objectUrl);
            const contextCanvas = document.createElement('canvas');
            let maxSide = 1200;
            let quality = 0.82;

            try {
                for (let attempt = 0; attempt < 9; attempt += 1) {
                    const scale = Math.min(1, maxSide / Math.max(photo.width, photo.height));
                    contextCanvas.width = Math.max(1, Math.round(photo.width * scale));
                    contextCanvas.height = Math.max(1, Math.round(photo.height * scale));
                    const context = contextCanvas.getContext('2d');
                    if (!context) throw new Error('No se pudo preparar la foto.');
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, contextCanvas.width, contextCanvas.height);
                    context.drawImage(photo, 0, 0, contextCanvas.width, contextCanvas.height);

                    const blob = await new Promise((done, fail) => {
                        contextCanvas.toBlob(result => {
                            if (result) done(result);
                            else fail(new Error('No se pudo comprimir la foto.'));
                        }, 'image/jpeg', quality);
                    });
                    if (blob.size <= 900 * 1024) {
                        resolve(blob);
                        return;
                    }
                    if (quality > 0.58) quality -= 0.08;
                    else {
                        maxSide *= 0.8;
                        quality = 0.76;
                    }
                }
                reject(new Error('La foto no se pudo reducir lo suficiente. Elige una imagen más pequeña.'));
            } catch (error) {
                reject(error);
            }
        };
        photo.src = objectUrl;
    });
}

async function uploadSongPhoto(file) {
    const blob = await compressPhoto(file);
    const path = 'songs/' + crypto.randomUUID() + '.jpg';
    await supabaseRequest('/storage/v1/object/' + storageBucket + '/' + path
        .split('/').map(encodeURIComponent).join('/'), {
        method: 'POST',
        headers: {
            'Content-Type': 'image/jpeg',
            'x-upsert': 'false'
        },
        body: blob
    });
    return path;
}

async function loadSharedMemories() {
    const rows = await supabaseRequest(
        '/rest/v1/memories?select=id,kind,title,content,song_url,image_path,created_at&order=created_at.desc&limit=200'
    );
    sharedMemories = Array.isArray(rows) ? rows : [];
    renderMusic();
    renderDiary();
}

// --- VISTA DE NUESTRA MÚSICA ---
const musicForm = document.getElementById('music-form');
const musicList = document.getElementById('music-list');
const musicEmpty = document.getElementById('music-empty');
const musicStatus = document.getElementById('music-status');
const songPhotoInput = document.getElementById('song-photo');
const songPhotoPreview = document.getElementById('song-photo-preview');
let photoPreviewUrl = '';

if (songPhotoInput && songPhotoPreview) {
    songPhotoInput.addEventListener('change', () => {
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        const file = songPhotoInput.files && songPhotoInput.files[0];
        songPhotoPreview.replaceChildren();
        songPhotoPreview.hidden = !file;
        if (!file) return;

        photoPreviewUrl = URL.createObjectURL(file);
        const preview = document.createElement('img');
        preview.className = 'preview-image';
        preview.alt = 'Vista previa de la foto elegida';
        preview.src = photoPreviewUrl;
        songPhotoPreview.append(preview);
    });
}

function renderMusic() {
    if (!musicList || !musicEmpty) return;
    const songs = sharedMemories.filter(memory => memory.kind === 'music');
    musicList.replaceChildren();
    musicEmpty.hidden = songs.length > 0;

    songs.forEach(song => {
        const card = document.createElement('article');
        card.className = 'music-entry';
        const imageUrl = publicPhotoUrl(song.image_path);
        if (imageUrl) {
            const image = document.createElement('img');
            image.className = 'music-photo';
            image.src = imageUrl;
            image.alt = 'Foto para el recuerdo musical: ' + (song.title || 'canción');
            image.loading = 'lazy';
            card.append(image);
        }

        const title = document.createElement('h3');
        title.textContent = song.title || 'Nuestra canción';
        card.append(title);

        if (song.content) {
            const note = document.createElement('p');
            note.textContent = song.content;
            card.append(note);
        }

        const songUrl = safeHttpUrl(song.song_url);
        if (songUrl) {
            const link = document.createElement('a');
            link.className = 'song-link';
            link.href = songUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Escuchar esta canción ♫';
            card.append(link);
        }
        card.append(makeDateElement(song.created_at));
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

        if (!supabaseReady) {
            setStatus(musicStatus, 'Falta conectar Supabase. Sigue los pasos de SUPABASE_SETUP.md para activar los recuerdos compartidos.');
            return;
        }
        if (!title || !note || !file) {
            setStatus(musicStatus, 'Completa el nombre, el texto y elige una foto.');
            return;
        }
        const safeUrl = safeHttpUrl(rawUrl);
        if (rawUrl && !safeUrl) {
            setStatus(musicStatus, 'Revisa el enlace de la canción.');
            return;
        }

        if (submitButton) submitButton.disabled = true;
        setStatus(musicStatus, 'Preparando y guardando su recuerdo...');
        try {
            const imagePath = await uploadSongPhoto(file);
            await supabaseRequest('/rest/v1/memories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    kind: 'music',
                    title,
                    content: note,
                    song_url: safeUrl || null,
                    image_path: imagePath
                })
            });

            musicForm.reset();
            if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
            photoPreviewUrl = '';
            if (songPhotoPreview) {
                songPhotoPreview.replaceChildren();
                songPhotoPreview.hidden = true;
            }
            setStatus(musicStatus, 'Guardado para que puedan verlo desde cualquier dispositivo 🤍');
            try {
                await loadSharedMemories();
            } catch {
                setStatus(musicStatus, 'La canción quedó guardada. Recarga la página para ver la lista actualizada 🤍');
            }
        } catch (error) {
            setStatus(musicStatus, error.message || 'No se pudo guardar la canción y su foto.');
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// --- VISTA DEL DIARIO ---
const diaryForm = document.getElementById('diary-form');
const diaryList = document.getElementById('diary-list');
const diaryEmpty = document.getElementById('diary-empty');
const diaryStatus = document.getElementById('diary-status');

function renderDiary() {
    if (!diaryList || !diaryEmpty) return;
    const entries = sharedMemories.filter(memory => memory.kind === 'diary');
    diaryList.replaceChildren();
    diaryEmpty.hidden = entries.length > 0;

    entries.forEach(entry => {
        const card = document.createElement('article');
        card.className = 'diary-entry';
        const heading = document.createElement('div');
        heading.className = 'diary-entry-heading';

        const title = document.createElement('h3');
        title.textContent = entry.title || 'Un recuerdo nuestro';
        heading.append(title, makeDateElement(entry.created_at));

        const body = document.createElement('p');
        body.textContent = entry.content || '';
        card.append(heading, body);
        diaryList.append(card);
    });
}

if (diaryForm) {
    diaryForm.addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('diary-title').value.trim();
        const content = document.getElementById('diary-entry').value.trim();
        const submitButton = diaryForm.querySelector('button[type="submit"]');

        if (!supabaseReady) {
            setStatus(diaryStatus, 'Falta conectar Supabase. Sigue los pasos de SUPABASE_SETUP.md para activar los recuerdos compartidos.');
            return;
        }
        if (!content) {
            setStatus(diaryStatus, 'Escribe algo antes de guardar el recuerdo.');
            return;
        }

        if (submitButton) submitButton.disabled = true;
        setStatus(diaryStatus, 'Guardando en nuestro diario...');
        try {
            await supabaseRequest('/rest/v1/memories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    kind: 'diary',
                    title,
                    content,
                    song_url: null,
                    image_path: null
                })
            });
            diaryForm.reset();
            setStatus(diaryStatus, 'Tu recuerdo quedó guardado para los dos 🤍');
            try {
                await loadSharedMemories();
            } catch {
                setStatus(diaryStatus, 'El registro quedó guardado. Recarga la página para ver la lista actualizada 🤍');
            }
        } catch (error) {
            setStatus(diaryStatus, error.message || 'No se pudo guardar el registro.');
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

async function initializeSharedMemories() {
    if (!supabaseReady) {
        const message = 'Conecta el proyecto Supabase para cargar y guardar recuerdos compartidos. Consulta SUPABASE_SETUP.md.';
        setStatus(diaryStatus, message);
        setStatus(musicStatus, message);
        return;
    }

    setStatus(diaryStatus, 'Cargando recuerdos compartidos...');
    setStatus(musicStatus, 'Cargando recuerdos compartidos...');
    try {
        await loadSharedMemories();
        setStatus(diaryStatus, 'Los registros se comparten con todos los visitantes.');
        setStatus(musicStatus, 'Las canciones y fotos se comparten con todos los visitantes.');
    } catch (error) {
        setStatus(diaryStatus, error.message || 'No se pudieron cargar los registros compartidos.');
        setStatus(musicStatus, error.message || 'No se pudieron cargar las canciones compartidas.');
    }
}

initializeSharedMemories();
if (supabaseReady) {
    // Actualiza las pestañas que siguen abiertas para que reciban nuevas publicaciones.
    setInterval(() => {
        loadSharedMemories().catch(() => {});
    }, 30000);
}
updateTimer();
setInterval(updateTimer, 1000);
setInterval(updateReunionTimer, 1000);
