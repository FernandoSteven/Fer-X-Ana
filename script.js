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
    if (!/^(?:songs|dedications)\/[0-9a-f-]{36}\.jpg$/i.test(String(path || ''))) return '';
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

async function uploadSharedPhoto(file, folder) {
    const blob = await compressPhoto(file);
    const safeFolder = folder === 'dedications' ? 'dedications' : 'songs';
    const path = safeFolder + '/' + crypto.randomUUID() + '.jpg';
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

async function deleteSharedPhoto(path) {
    if (!/^(?:songs|dedications)\/[0-9a-f-]{36}\.jpg$/i.test(String(path || ''))) return;
    await supabaseRequest('/storage/v1/object/' + storageBucket, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [path] })
    });
}

async function loadSharedMemories() {
    const rows = await supabaseRequest(
        '/rest/v1/memories?select=id,kind,title,content,song_url,image_path,created_at&order=created_at.desc&limit=200'
    );
    sharedMemories = Array.isArray(rows) ? rows : [];
    renderMusic();
    renderDiary();
    renderDedications();
}

let editingMemoryId = null;

function statusForMemory(memory) {
    if (memory.kind === 'music') return musicStatus;
    if (memory.kind === 'dedication') return dedicationStatus;
    return diaryStatus;
}

function createMemoryButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function renderMemoryActions(memory, card) {
    if (editingMemoryId === memory.id) {
        renderMemoryEditor(memory, card);
        return;
    }

    const actions = document.createElement('div');
    actions.className = 'memory-actions';
    actions.append(
        createMemoryButton('Editar ✎', 'memory-action-btn', () => {
            editingMemoryId = memory.id;
            renderMusic();
            renderDiary();
            renderDedications();
        }),
        createMemoryButton('Borrar ×', 'memory-action-btn danger', async () => {
            if (!window.confirm('¿Quieres borrar este recuerdo de la página para todos?')) return;
            const status = statusForMemory(memory);
            setStatus(status, 'Borrando recuerdo...');
            try {
                await supabaseRequest('/rest/v1/memories?id=eq.' + encodeURIComponent(memory.id), {
                    method: 'DELETE',
                    headers: { 'Prefer': 'return=minimal' }
                });
                sharedMemories = sharedMemories.filter(item => item.id !== memory.id);
                renderMusic();
                renderDiary();
                renderDedications();
                if (memory.image_path) {
                    try { await deleteSharedPhoto(memory.image_path); } catch { /* La publicación ya fue borrada. */ }
                }
                setStatus(status, 'El recuerdo se borró de la página para todos.');
            } catch (error) {
                setStatus(status, error.message || 'No se pudo borrar el recuerdo.');
            }
        })
    );
    card.append(actions);
}

function renderMemoryEditor(memory, card) {
    const form = document.createElement('form');
    form.className = 'memory-edit-form';

    const titleLabel = document.createElement('label');
    titleLabel.className = 'field-label';
    titleLabel.textContent = memory.kind === 'music' ? 'Nombre de la canción' : 'Título';
    const title = document.createElement('input');
    title.type = 'text';
    title.maxLength = 100;
    title.value = memory.title || '';
    title.required = memory.kind !== 'diary';
    titleLabel.append(title);

    const contentLabel = document.createElement('label');
    contentLabel.className = 'field-label';
    contentLabel.textContent = memory.kind === 'music' ? 'Lo que queremos recordar' : 'Texto';
    const content = document.createElement('textarea');
    content.rows = 5;
    content.maxLength = memory.kind === 'music' ? 2000 : 3000;
    content.value = memory.content || '';
    content.required = true;
    contentLabel.append(content);
    form.append(titleLabel, contentLabel);

    let songUrl;
    if (memory.kind === 'music') {
        const urlLabel = document.createElement('label');
        urlLabel.className = 'field-label';
        urlLabel.textContent = 'Enlace de la canción (opcional)';
        songUrl = document.createElement('input');
        songUrl.type = 'url';
        songUrl.value = memory.song_url || '';
        urlLabel.append(songUrl);
        form.append(urlLabel);
    }

    let photoInput;
    if (memory.kind === 'music' || memory.kind === 'dedication') {
        const photoLabel = document.createElement('label');
        photoLabel.className = 'field-label';
        photoLabel.textContent = memory.image_path ? 'Cambiar foto (opcional)' : 'Añadir foto (opcional)';
        photoInput = document.createElement('input');
        photoInput.type = 'file';
        photoInput.accept = 'image/*';
        photoInput.className = 'file-input';
        photoLabel.append(photoInput);
        form.append(photoLabel);
    }

    const actions = document.createElement('div');
    actions.className = 'memory-edit-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'action-btn';
    save.textContent = 'Guardar cambios ♡';
    const cancel = createMemoryButton('Cancelar', 'memory-action-btn', () => {
        editingMemoryId = null;
        renderMusic();
        renderDiary();
        renderDedications();
    });
    actions.append(save, cancel);
    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    form.append(actions, status);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const newTitle = title.value.trim();
        const newContent = content.value.trim();
        const rawUrl = songUrl ? songUrl.value.trim() : '';
        const safeUrl = safeHttpUrl(rawUrl);
        const file = photoInput && photoInput.files && photoInput.files[0];

        if (!supabaseReady) {
            setStatus(status, 'No se pudo conectar con los recuerdos compartidos.');
            return;
        }
        if (!newContent || (memory.kind !== 'diary' && !newTitle)) {
            setStatus(status, 'Completa el título y el texto antes de guardar.');
            return;
        }
        if (rawUrl && !safeUrl) {
            setStatus(status, 'Revisa el enlace de la canción.');
            return;
        }

        save.disabled = true;
        setStatus(status, 'Guardando cambios...');
        let uploadedPath = '';
        try {
            if (file) uploadedPath = await uploadSharedPhoto(file, memory.kind === 'dedication' ? 'dedications' : 'songs');
            const changes = { title: newTitle, content: newContent };
            if (memory.kind === 'music') changes.song_url = safeUrl || null;
            if (uploadedPath) changes.image_path = uploadedPath;
            await supabaseRequest('/rest/v1/memories?id=eq.' + encodeURIComponent(memory.id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(changes)
            });

            const oldImagePath = memory.image_path;
            Object.assign(memory, changes);
            editingMemoryId = null;
            renderMusic();
            renderDiary();
            renderDedications();
            if (uploadedPath && oldImagePath) {
                try { await deleteSharedPhoto(oldImagePath); } catch { /* El recuerdo conserva su foto nueva. */ }
            }
            setStatus(statusForMemory(memory), 'Cambios guardados para todos 🤍');
        } catch (error) {
            if (uploadedPath) {
                try { await deleteSharedPhoto(uploadedPath); } catch { /* Se conserva el error original. */ }
            }
            setStatus(status, error.message || 'No se pudieron guardar los cambios.');
        } finally {
            save.disabled = false;
        }
    });
    card.replaceChildren(form);
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
        renderMemoryActions(song, card);
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
            const imagePath = await uploadSharedPhoto(file, 'songs');
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
        renderMemoryActions(entry, card);
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

// --- VISTA Y PUBLICACIÓN DE DEDICATORIAS ---
const dedicationForm = document.getElementById('dedication-form');
const dedicationList = document.getElementById('dedication-list');
const dedicationEmpty = document.getElementById('dedication-empty');
const dedicationStatus = document.getElementById('dedication-status');
const dedicationPhotoInput = document.getElementById('dedication-photo');
const dedicationPhotoPreview = document.getElementById('dedication-photo-preview');
let dedicationPreviewUrl = '';

if (dedicationPhotoInput && dedicationPhotoPreview) {
    dedicationPhotoInput.addEventListener('change', () => {
        if (dedicationPreviewUrl) URL.revokeObjectURL(dedicationPreviewUrl);
        const file = dedicationPhotoInput.files && dedicationPhotoInput.files[0];
        dedicationPhotoPreview.replaceChildren();
        dedicationPhotoPreview.hidden = !file;
        if (!file) return;
        dedicationPreviewUrl = URL.createObjectURL(file);
        const image = document.createElement('img');
        image.className = 'preview-image';
        image.alt = 'Vista previa de la foto de la dedicatoria';
        image.src = dedicationPreviewUrl;
        dedicationPhotoPreview.append(image);
    });
}

function renderDedications() {
    if (!dedicationList || !dedicationEmpty) return;
    const dedications = sharedMemories.filter(memory => memory.kind === 'dedication');
    dedicationList.replaceChildren();
    dedicationEmpty.hidden = dedications.length > 0;

    dedications.forEach(dedication => {
        const card = document.createElement('article');
        card.className = 'dedication-entry';
        const imageUrl = publicPhotoUrl(dedication.image_path);
        if (imageUrl) {
            const image = document.createElement('img');
            image.className = 'dedication-photo';
            image.src = imageUrl;
            image.alt = 'Foto para la dedicatoria: ' + (dedication.title || 'poema');
            image.loading = 'lazy';
            card.append(image);
        }
        const title = document.createElement('h3');
        title.textContent = dedication.title || 'Una dedicatoria nuestra';
        const body = document.createElement('p');
        body.className = 'dedication-entry-text';
        body.textContent = dedication.content || '';
        card.append(title, body, makeDateElement(dedication.created_at));
        renderMemoryActions(dedication, card);
        dedicationList.append(card);
    });
}

if (dedicationForm) {
    dedicationForm.addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('dedication-title').value.trim();
        const content = document.getElementById('dedication-content').value.trim();
        const file = dedicationPhotoInput && dedicationPhotoInput.files && dedicationPhotoInput.files[0];
        const submitButton = dedicationForm.querySelector('button[type="submit"]');

        if (!supabaseReady) {
            setStatus(dedicationStatus, 'Falta conectar Supabase. Consulta SUPABASE_SETUP.md para activar las dedicatorias compartidas.');
            return;
        }
        if (!title || !content) {
            setStatus(dedicationStatus, 'Escribe un título y el poema antes de guardarlo.');
            return;
        }

        if (submitButton) submitButton.disabled = true;
        setStatus(dedicationStatus, 'Guardando su dedicatoria...');
        let imagePath = null;
        try {
            if (file) imagePath = await uploadSharedPhoto(file, 'dedications');
            await supabaseRequest('/rest/v1/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ kind: 'dedication', title, content, song_url: null, image_path: imagePath })
            });
            dedicationForm.reset();
            if (dedicationPreviewUrl) URL.revokeObjectURL(dedicationPreviewUrl);
            dedicationPreviewUrl = '';
            if (dedicationPhotoPreview) {
                dedicationPhotoPreview.replaceChildren();
                dedicationPhotoPreview.hidden = true;
            }
            setStatus(dedicationStatus, 'La dedicatoria quedó guardada para todos 🤍');
            try {
                await loadSharedMemories();
            } catch {
                setStatus(dedicationStatus, 'La dedicatoria quedó guardada. Recarga la página para verla 🤍');
            }
        } catch (error) {
            if (imagePath) {
                try { await deleteSharedPhoto(imagePath); } catch { /* Se conserva el error original. */ }
            }
            setStatus(dedicationStatus, error.message || 'No se pudo guardar la dedicatoria.');
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
        setStatus(dedicationStatus, message);
        return;
    }

    setStatus(diaryStatus, 'Cargando recuerdos compartidos...');
    setStatus(musicStatus, 'Cargando recuerdos compartidos...');
    setStatus(dedicationStatus, 'Cargando dedicatorias compartidas...');
    try {
        await loadSharedMemories();
        setStatus(diaryStatus, 'Los registros se comparten con todos los visitantes.');
        setStatus(musicStatus, 'Las canciones y fotos se comparten con todos los visitantes.');
        setStatus(dedicationStatus, 'Las dedicatorias se comparten con todos los visitantes.');
    } catch (error) {
        setStatus(diaryStatus, error.message || 'No se pudieron cargar los registros compartidos.');
        setStatus(musicStatus, error.message || 'No se pudieron cargar las canciones compartidas.');
        setStatus(dedicationStatus, error.message || 'No se pudieron cargar las dedicatorias compartidas.');
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
