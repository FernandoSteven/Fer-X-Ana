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

function songPlayerInfo(value) {
    const safeUrl = safeHttpUrl(value);
    if (!safeUrl) return null;

    let url;
    try {
        url = new URL(safeUrl);
    } catch {
        return null;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const youtubeHosts = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com']);
    if (youtubeHosts.has(host)) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        let videoId = '';
        if (host === 'youtu.be') {
            videoId = pathParts[0] || '';
        } else {
            videoId = url.searchParams.get('v') || '';
            if (!videoId) {
                const videoPathIndex = pathParts.findIndex(part => ['embed', 'shorts', 'live', 'v'].includes(part));
                if (videoPathIndex !== -1) videoId = pathParts[videoPathIndex + 1] || '';
            }
        }

        if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
            const embedUrl = new URL('https://www.youtube-nocookie.com/embed/' + videoId);
            embedUrl.searchParams.set('controls', '1');
            embedUrl.searchParams.set('playsinline', '1');
            embedUrl.searchParams.set('rel', '0');
            embedUrl.searchParams.set('hl', 'es');
            return { type: 'youtube', src: embedUrl.href, linkLabel: 'Abrir en YouTube ♫' };
        }
    }

    if (host === 'open.spotify.com') {
        const pathParts = url.pathname.split('/').filter(Boolean).filter(part => !/^intl-[a-z]{2}$/i.test(part));
        const type = pathParts[0] || '';
        const itemId = pathParts[1] || '';
        if (['track', 'album', 'playlist', 'artist', 'show', 'episode'].includes(type)
            && /^[A-Za-z0-9]+$/.test(itemId)) {
            const embedUrl = new URL('/embed/' + type + '/' + itemId, 'https://open.spotify.com');
            embedUrl.searchParams.set('utm_source', 'generator');
            return {
                type: 'spotify',
                src: embedUrl.href,
                height: type === 'track' || type === 'episode' ? 152 : 352,
                linkLabel: 'Abrir en Spotify ♫'
            };
        }
    }

    if (/\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav)$/i.test(url.pathname)) {
        return { type: 'audio', src: safeUrl, linkLabel: 'Abrir audio ♫' };
    }

    return { type: 'link', src: safeUrl, linkLabel: 'Abrir canción ♫' };
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
        const layout = document.createElement('div');
        layout.className = 'music-entry-main';

        const cover = document.createElement('div');
        cover.className = 'music-entry-cover';
        const imageUrl = publicPhotoUrl(song.image_path);
        if (imageUrl) {
            const image = document.createElement('img');
            image.className = 'music-photo';
            image.src = imageUrl;
            image.alt = 'Foto para el recuerdo musical: ' + (song.title || 'canción');
            image.loading = 'lazy';
            cover.append(image);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'music-photo-placeholder';
            placeholder.setAttribute('aria-hidden', 'true');
            placeholder.textContent = '♫';
            cover.append(placeholder);
        }
        layout.append(cover);

        const details = document.createElement('div');
        details.className = 'music-entry-content';

        const title = document.createElement('h3');
        title.textContent = song.title || 'Nuestra canción';
        details.append(title);

        if (song.content) {
            const note = document.createElement('p');
            note.textContent = song.content;
            details.append(note);
        }

        const songUrl = safeHttpUrl(song.song_url);
        const playerInfo = songPlayerInfo(songUrl);
        const player = document.createElement('div');
        player.className = 'music-player';
        if (playerInfo && playerInfo.type !== 'link') {
            player.classList.add('music-player-' + playerInfo.type);
            const playerLabel = document.createElement('span');
            playerLabel.className = 'music-player-label';
            playerLabel.textContent = 'Escucha aquí ♫';
            player.append(playerLabel);

            if (playerInfo.type === 'audio') {
                const audio = document.createElement('audio');
                audio.className = 'music-player-audio';
                audio.controls = true;
                audio.preload = 'none';
                audio.src = playerInfo.src;
                audio.setAttribute('aria-label', 'Reproducir ' + (song.title || 'la canción'));
                player.append(audio);
            } else {
                const iframe = document.createElement('iframe');
                iframe.className = 'music-player-embed';
                iframe.src = playerInfo.src;
                iframe.title = 'Reproductor de ' + (song.title || 'la canción');
                iframe.loading = 'lazy';
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
                iframe.allowFullscreen = true;
                if (playerInfo.height) iframe.height = String(playerInfo.height);
                player.append(iframe);
            }
            details.append(player);
        } else {
            const notice = document.createElement('p');
            notice.className = 'music-player-notice';
            notice.textContent = songUrl
                ? 'Este enlace abre la canción en su servicio. También puedes reproducir enlaces de YouTube, Spotify o archivos de audio.'
                : 'Añade un enlace de YouTube, Spotify o un archivo de audio para escucharla aquí.';
            details.append(notice);
        }

        if (songUrl) {
            const link = document.createElement('a');
            link.className = 'song-link';
            link.href = songUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = playerInfo ? playerInfo.linkLabel : 'Escuchar esta canción ♫';
            details.append(link);
        }

        details.append(makeDateElement(song.created_at));
        renderMemoryActions(song, details);
        layout.append(details);
        card.append(layout);
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

// --- GALERÍA COMPARTIDA DE FOTOS Y VIDEOS ---
const galleryBucket = 'shared-gallery';
const galleryForm = document.getElementById('gallery-form');
const galleryFileInput = document.getElementById('gallery-file');
const galleryPreview = document.getElementById('gallery-preview');
const galleryList = document.getElementById('gallery-list');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryStatus = document.getElementById('gallery-status');
let galleryItems = [];
let galleryPreviewUrl = '';
let editingGalleryId = null;

const galleryPathPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|mp4|webm|mov)$/i;

function publicGalleryUrl(path) {
    if (!galleryPathPattern.test(String(path || ''))) return '';
    return supabaseUrl + '/storage/v1/object/public/' + galleryBucket + '/'
        + String(path).split('/').map(encodeURIComponent).join('/');
}

async function uploadGalleryMedia(file) {
    if (!file) throw new Error('Elige una foto o un video.');
    let body;
    let contentType;
    let mediaType;
    let extension;

    if (file.type.startsWith('image/')) {
        body = await compressPhoto(file);
        contentType = 'image/jpeg';
        mediaType = 'image';
        extension = 'jpg';
    } else {
        const videoExtensions = {
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/quicktime': 'mov'
        };
        const fileExtension = String(file.name || '').split('.').pop().toLowerCase();
        contentType = videoExtensions[file.type] ? file.type : '';
        extension = videoExtensions[file.type] || (['mp4', 'webm', 'mov'].includes(fileExtension) ? fileExtension : '');
        if (!extension || (file.type && !Object.keys(videoExtensions).includes(file.type))) {
            throw new Error('Elige una foto o un video MP4, WebM o MOV.');
        }
        if (file.size > 50 * 1024 * 1024) {
            throw new Error('El video debe pesar 50 MB o menos.');
        }
        if (!contentType) {
            contentType = extension === 'mov' ? 'video/quicktime' : 'video/' + extension;
        }
        mediaType = 'video';
        body = file;
    }

    const path = crypto.randomUUID() + '.' + extension;
    await supabaseRequest('/storage/v1/object/' + galleryBucket + '/' + path, {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
        body
    });
    return { path, mediaType };
}

async function deleteGalleryMedia(path) {
    if (!galleryPathPattern.test(String(path || ''))) return;
    await supabaseRequest('/storage/v1/object/' + galleryBucket, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [path] })
    });
}

async function loadGalleryItems() {
    const rows = await supabaseRequest(
        '/rest/v1/gallery_items?select=id,title,content,media_path,media_type,created_at&order=created_at.desc&limit=150'
    );
    galleryItems = Array.isArray(rows) ? rows : [];
    renderGallery();
}

function renderGalleryMedia(item, className) {
    const url = publicGalleryUrl(item.media_path);
    if (!url) return null;
    if (item.media_type === 'video') {
        const video = document.createElement('video');
        video.className = className;
        video.src = url;
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        video.setAttribute('aria-label', 'Video: ' + (item.title || 'recuerdo'));
        return video;
    }
    const image = document.createElement('img');
    image.className = className;
    image.src = url;
    image.alt = item.title ? 'Foto: ' + item.title : 'Foto de nuestra galería';
    image.loading = 'lazy';
    return image;
}

function renderGallery() {
    if (!galleryList || !galleryEmpty) return;
    galleryList.replaceChildren();
    galleryEmpty.hidden = galleryItems.length > 0;

    galleryItems.forEach(item => {
        const card = document.createElement('article');
        card.className = 'gallery-entry';
        const media = renderGalleryMedia(item, 'gallery-media');
        if (media) card.append(media);
        const body = document.createElement('div');
        body.className = 'gallery-entry-body';

        if (editingGalleryId === item.id) {
            renderGalleryEditor(item, body);
        } else {
            const title = document.createElement('h3');
            title.textContent = item.title || 'Un momento nuestro';
            const caption = document.createElement('p');
            caption.textContent = item.content || '';
            body.append(title);
            if (item.content) body.append(caption);
            body.append(makeDateElement(item.created_at));

            const actions = document.createElement('div');
            actions.className = 'memory-actions';
            actions.append(
                createMemoryButton('Editar ✎', 'memory-action-btn', () => {
                    editingGalleryId = item.id;
                    renderGallery();
                }),
                createMemoryButton('Borrar ×', 'memory-action-btn danger', async () => {
                    if (!window.confirm('¿Quieres borrar este recuerdo de la galería para todos?')) return;
                    setStatus(galleryStatus, 'Borrando recuerdo...');
                    try {
                        await supabaseRequest('/rest/v1/gallery_items?id=eq.' + encodeURIComponent(item.id), {
                            method: 'DELETE',
                            headers: { 'Prefer': 'return=minimal' }
                        });
                        galleryItems = galleryItems.filter(entry => entry.id !== item.id);
                        renderGallery();
                        try {
                            await deleteGalleryMedia(item.media_path);
                            setStatus(galleryStatus, 'El recuerdo se borró de la página para todos.');
                        } catch {
                            setStatus(galleryStatus, 'El recuerdo ya no aparece en la galería; no se pudo limpiar su archivo de almacenamiento.');
                        }
                    } catch (error) {
                        setStatus(galleryStatus, error.message || 'No se pudo borrar el recuerdo.');
                    }
                })
            );
            body.append(actions);
        }
        card.append(body);
        galleryList.append(card);
    });
}

function renderGalleryEditor(item, container) {
    const form = document.createElement('form');
    form.className = 'memory-edit-form';

    const titleLabel = document.createElement('label');
    titleLabel.className = 'field-label';
    titleLabel.textContent = 'Título';
    const title = document.createElement('input');
    title.type = 'text';
    title.maxLength = 100;
    title.value = item.title || '';
    title.required = true;
    titleLabel.append(title);

    const captionLabel = document.createElement('label');
    captionLabel.className = 'field-label';
    captionLabel.textContent = 'Descripción (opcional)';
    const caption = document.createElement('textarea');
    caption.rows = 4;
    caption.maxLength = 1500;
    caption.value = item.content || '';
    captionLabel.append(caption);

    const fileLabel = document.createElement('label');
    fileLabel.className = 'field-label';
    fileLabel.textContent = 'Cambiar foto o video (opcional)';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*,video/mp4,video/webm,video/quicktime';
    file.className = 'file-input';
    fileLabel.append(file);
    const hint = document.createElement('p');
    hint.className = 'helper-text';
    hint.textContent = 'Al elegir un archivo nuevo, reemplazará el que está publicado.';
    const actions = document.createElement('div');
    actions.className = 'memory-edit-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'action-btn';
    save.textContent = 'Guardar cambios ♡';
    const cancel = createMemoryButton('Cancelar', 'memory-action-btn', () => {
        editingGalleryId = null;
        renderGallery();
    });
    actions.append(save, cancel);
    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    form.append(titleLabel, captionLabel, fileLabel, hint, actions, status);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const newTitle = title.value.trim();
        if (!newTitle) {
            setStatus(status, 'Escribe un título para este recuerdo.');
            return;
        }
        save.disabled = true;
        setStatus(status, 'Guardando cambios...');
        let uploaded = null;
        try {
            if (file.files && file.files[0]) uploaded = await uploadGalleryMedia(file.files[0]);
            const changes = { title: newTitle, content: caption.value.trim() };
            if (uploaded) {
                changes.media_path = uploaded.path;
                changes.media_type = uploaded.mediaType;
            }
            await supabaseRequest('/rest/v1/gallery_items?id=eq.' + encodeURIComponent(item.id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(changes)
            });
            const oldPath = item.media_path;
            Object.assign(item, changes);
            editingGalleryId = null;
            renderGallery();
            if (uploaded) {
                try { await deleteGalleryMedia(oldPath); } catch { /* La publicación ya usa el archivo nuevo. */ }
            }
            setStatus(galleryStatus, 'Cambios guardados para todos 🤍');
        } catch (error) {
            if (uploaded) {
                try { await deleteGalleryMedia(uploaded.path); } catch { /* Se conserva el error original. */ }
            }
            setStatus(status, error.message || 'No se pudieron guardar los cambios.');
            save.disabled = false;
        }
    });
    container.append(form);
}

function clearGalleryPreview() {
    if (galleryPreviewUrl) URL.revokeObjectURL(galleryPreviewUrl);
    galleryPreviewUrl = '';
    if (galleryPreview) {
        galleryPreview.replaceChildren();
        galleryPreview.hidden = true;
    }
}

if (galleryFileInput && galleryPreview) {
    galleryFileInput.addEventListener('change', () => {
        clearGalleryPreview();
        const file = galleryFileInput.files && galleryFileInput.files[0];
        if (!file) return;
        galleryPreviewUrl = URL.createObjectURL(file);
        const preview = file.type.startsWith('video/') ? document.createElement('video') : document.createElement('img');
        preview.className = 'preview-image';
        if (preview.tagName === 'VIDEO') {
            preview.controls = true;
            preview.preload = 'metadata';
        } else {
            preview.alt = 'Vista previa del recuerdo';
        }
        preview.src = galleryPreviewUrl;
        galleryPreview.hidden = false;
        galleryPreview.append(preview);
    });
}

if (galleryForm) {
    galleryForm.addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('gallery-title').value.trim();
        const content = document.getElementById('gallery-caption').value.trim();
        const file = galleryFileInput && galleryFileInput.files && galleryFileInput.files[0];
        const submit = galleryForm.querySelector('button[type="submit"]');
        if (!supabaseReady) {
            setStatus(galleryStatus, 'Conecta Supabase para guardar la galería compartida.');
            return;
        }
        if (!title || !file) {
            setStatus(galleryStatus, 'Escribe un título y elige una foto o video.');
            return;
        }

        submit.disabled = true;
        setStatus(galleryStatus, 'Preparando y guardando su recuerdo...');
        let uploaded = null;
        try {
            uploaded = await uploadGalleryMedia(file);
            await supabaseRequest('/rest/v1/gallery_items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    title,
                    content,
                    media_path: uploaded.path,
                    media_type: uploaded.mediaType
                })
            });
            galleryForm.reset();
            clearGalleryPreview();
            setStatus(galleryStatus, 'El recuerdo quedó guardado en su galería para todos 🤍');
            try { await loadGalleryItems(); } catch {
                setStatus(galleryStatus, 'El recuerdo quedó guardado. Recarga la página para verlo 🤍');
            }
        } catch (error) {
            if (uploaded) {
                try { await deleteGalleryMedia(uploaded.path); } catch { /* Se conserva el error original. */ }
            }
            setStatus(galleryStatus, error.message || 'No se pudo guardar el recuerdo.');
        } finally {
            submit.disabled = false;
        }
    });
}

// --- CACHORRO VIRTUAL COMPARTIDO Y PREGUNTAS DIARIAS ---
const petStatus = document.getElementById('pet-status');
const petQuestionStatus = document.getElementById('pet-question-status');
const petAnswerForm = document.getElementById('pet-answer-form');
const petNameForm = document.getElementById('pet-name-form');
const petFeedButton = document.getElementById('pet-feed');
const petAnswerHistoryList = document.getElementById('pet-answer-history');
const petAnswerHistoryStatus = document.getElementById('pet-answer-history-status');
const petAnswerHistoryCount = document.getElementById('pet-answer-history-count');
const petAnswerHistoryMore = document.getElementById('pet-answer-history-more');
let sharedPet = null;
let petAnswerHistory = [];
let petHistoryHasMore = false;
let petHistoryLoadingMore = false;
let petAnswerSubmitting = false;
const petHistoryPageSize = 20;

const petQuestionTopics = [
    'nuestro primer saludo', 'nuestras primeras conversaciones', 'la primera vez que nos reímos juntos',
    'nuestros mensajes de buenos días', 'nuestras llamadas que se alargan', 'un abrazo que todavía esperamos',
    'nuestros planes para el futuro', 'las canciones que nos dedicamos', 'nuestras bromas favoritas',
    'una tarde tranquila a tu lado', 'las veces que nos apoyamos', 'nuestros apodos cariñosos',
    'un día que nos sorprendió', 'nuestros sueños compartidos', 'un paseo que hicimos juntos',
    'nuestros videojuegos y partidas', 'las noches hablando antes de dormir', 'un detalle pequeño que me diste',
    'la primera foto que guardamos', 'nuestros momentos a distancia', 'la comida que disfrutamos juntos',
    'una película que vimos', 'nuestros planes para una cita', 'una conversación importante',
    'la forma en que nos conocimos', 'nuestro primer te quiero', 'una risa que nos contagió',
    'nuestros saludos al despertar', 'una promesa que nos hicimos', 'nuestros momentos de ternura',
    'una sorpresa que preparamos', 'un lugar que queremos visitar', 'las palabras que nos animan',
    'una tarde de lluvia juntos', 'nuestros mensajes inesperados', 'una celebración que compartimos',
    'nuestros silencios cómodos', 'un reto que superamos', 'nuestro primer recuerdo favorito',
    'una meta que queremos cumplir', 'las cosas que nos dan risa', 'nuestros días más sencillos',
    'una aventura que soñamos', 'un gesto que me hace sentir querido', 'nuestras conversaciones profundas',
    'las veces que nos extrañamos', 'una fotografía que nos encanta', 'un regalo hecho con cariño',
    'nuestros planes para vernos', 'una costumbre que compartimos', 'una noche especial',
    'una palabra que usamos mucho', 'nuestros momentos de confianza', 'una idea que inventamos juntos',
    'las pequeñas formas de cuidarnos', 'una fecha que recordamos', 'nuestro futuro hogar imaginario',
    'una canción que nos representa', 'nuestros momentos más espontáneos', 'una charla que cambió mi día',
    'una tradición que podríamos crear', 'la manera en que nos despedimos', 'una ilusión que compartimos',
    'nuestros recuerdos más dulces'
];

const petQuestionPatterns = [
    '¿Qué recuerdo de {topic} te gustaría revivir conmigo?',
    '¿Qué detalle de {topic} te hace sonreír todavía?',
    '¿Qué emoción aparece primero cuando piensas en {topic}?',
    '¿Qué canción pondrías de fondo para recordar {topic}?',
    '¿Qué foto guardarías para representar {topic}?',
    '¿Qué palabra describe mejor {topic} para ti?',
    '¿Qué parte de {topic} te sorprendió más?',
    '¿Qué le contarías a nuestro yo del futuro sobre {topic}?',
    '¿Cómo describirías {topic} a alguien que no conoce nuestra historia?',
    '¿Qué pequeño detalle de {topic} nunca quieres olvidar?',
    '¿Qué te gustaría repetir exactamente de {topic}?',
    '¿Qué aprendiste de mí gracias a {topic}?',
    '¿Qué fue lo más tierno de {topic}?',
    '¿Qué momento de {topic} te gustaría enmarcar?',
    '¿Qué color representa {topic} en tu corazón?',
    '¿Qué título le pondrías a un capítulo sobre {topic}?',
    '¿Qué risa recuerdas cuando piensas en {topic}?',
    '¿Qué te gustaría agradecerme sobre {topic}?',
    '¿Qué hizo especial {topic} para ti?',
    '¿Qué te gustaría cambiar o mejorar de {topic} la próxima vez?',
    '¿Qué sensación te gustaría conservar de {topic}?',
    '¿Qué personaje de una película nos recordaría {topic}?',
    '¿Qué comida compartirías mientras recordamos {topic}?',
    '¿Qué lugar sería perfecto para revivir {topic}?',
    '¿Qué parte de {topic} contarías primero a nuestros amigos?',
    '¿Qué frase nuestra combina con {topic}?',
    '¿Qué te hizo sentir más cerca de mí en {topic}?',
    '¿Qué te gustaría que yo recuerde siempre de {topic}?',
    '¿Qué objeto podría simbolizar {topic}?',
    '¿Qué sorpresa pequeña habría hecho aún más bonito {topic}?',
    '¿Qué fue lo más inesperado de {topic}?',
    '¿Qué aprendimos juntos durante {topic}?',
    '¿Qué deseo pedirías para nuestra próxima versión de {topic}?',
    '¿Qué sonido o canción te trae de vuelta a {topic}?',
    '¿Qué parte de {topic} te gustaría mostrar en un álbum?',
    '¿Qué te hizo sentir orgulloso de nosotros en {topic}?',
    '¿Qué nombre cariñoso le pondrías a {topic}?',
    '¿Qué te gustaría susurrarme al recordar {topic}?',
    '¿Qué momento de {topic} te dio más paz?',
    '¿Qué detalle de {topic} solo nosotros entendemos?',
    '¿Qué harías para celebrar otra vez {topic}?',
    '¿Qué fue lo más divertido de {topic}?',
    '¿Qué te gustaría descubrir conmigo a partir de {topic}?',
    '¿Qué promesa bonita nace cuando piensas en {topic}?',
    '¿Qué pequeño plan harías para repetir {topic}?',
    '¿Qué fue lo más valiente que hicimos en {topic}?',
    '¿Qué palabra te gustaría escuchar de mí durante {topic}?',
    '¿Qué parte de {topic} se siente como hogar?',
    '¿Qué te habría gustado fotografiar de {topic}?',
    '¿Qué momento de {topic} guardarías en una cajita?',
    '¿Qué aprendiste sobre mi forma de querer en {topic}?',
    '¿Qué historia graciosa contarías de {topic}?',
    '¿Qué abrazo de {topic} recuerdas o imaginas?',
    '¿Qué gesto mío te conmovió durante {topic}?',
    '¿Qué te gustaría que hagamos diferente en {topic} la próxima vez?',
    '¿Qué te gustaría escribir en una nota sobre {topic}?',
    '¿Qué escena de nuestra historia se parece a {topic}?',
    '¿Qué te hizo pensar “qué suerte tenerte” en {topic}?',
    '¿Qué pequeño regalo simbolizaría {topic}?',
    '¿Qué consejo cariñoso nos darías sobre {topic}?',
    '¿Qué parte de {topic} te gustaría vivir sin mirar el reloj?',
    '¿Qué te gustaría que sintiera yo al recordar {topic}?',
    '¿Qué recuerdo de {topic} te gustaría contarme otra vez?',
    '¿Qué aprendiste sobre nosotros al vivir {topic}?',
    '¿Qué haría que {topic} fuera todavía más nuestro?',
    '¿Qué momento de {topic} te gustaría convertir en tradición?',
    '¿Qué gesto de cariño acompañaría perfectamente {topic}?',
    '¿Qué deseo pedirías para nosotros después de {topic}?',
    '¿Qué detalle de {topic} te gustaría agradecer hoy?',
    '¿Qué te gustaría escuchar de mí al terminar {topic}?',
    '¿Qué imagen aparece en tu mente cuando recuerdas {topic}?',
    '¿Qué parte de {topic} te gustaría repetir mañana?',
    '¿Qué te gustaría llevar contigo de {topic} para siempre?',
    '¿Qué hizo que {topic} se sintiera único?',
    '¿Qué momento de {topic} te gustaría guardar en una carta?',
    '¿Qué te gustaría inventar juntos inspirado en {topic}?',
    '¿Qué emoción te gustaría compartir conmigo durante {topic}?',
    '¿Qué detalle de {topic} merece una celebración pequeñita?',
    '¿Qué te gustaría prometerme al recordar {topic}?',
    '¿Qué parte de {topic} te gustaría volver a agradecer?',
    '¿Qué nombre pondrías a una foto de {topic}?'
];

const dailyPetQuestionCount = petQuestionTopics.length * petQuestionPatterns.length;
const dailyPetQuestions = petQuestionPatterns.flatMap(pattern =>
    petQuestionTopics.map(topic => pattern.replace('{topic}', topic))
);

function petDayKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Pacific/Galapagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = {};
    parts.forEach(part => { if (part.type !== 'literal') values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
}

function getDailyPetQuestion() {
    const dayNumber = Math.floor(Date.parse(petDayKey() + 'T00:00:00Z') / 86400000);
    const index = ((dayNumber * 3721 + 1019) % dailyPetQuestionCount + dailyPetQuestionCount) % dailyPetQuestionCount;
    return dailyPetQuestions[index];
}

function daysBetweenPetDates(start, end) {
    if (!start || !end) return 0;
    const first = Date.parse(String(start).slice(0, 10) + 'T00:00:00Z');
    const last = Date.parse(String(end).slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
    return Math.max(0, Math.floor((last - first) / 86400000));
}

function currentPetWeight(pet, today) {
    const savedWeight = Number(pet && pet.weight_kg) || 4;
    const missedDays = daysBetweenPetDates(pet && pet.last_fed_on, today);
    return Math.max(2.2, savedWeight - missedDays * 0.12);
}

function renderPet() {
    if (!sharedPet) return;
    const today = petDayKey();
    const name = String(sharedPet.name || 'Nube');
    const outfit = ['none', 'collar', 'sweater', 'bow'].includes(sharedPet.outfit) ? sharedPet.outfit : 'none';
    const figure = document.getElementById('pet-figure');
    const nameDisplay = document.getElementById('pet-name-display');
    const nameInput = document.getElementById('pet-name-input');
    const weightDisplay = document.getElementById('pet-weight');
    const foodDisplay = document.getElementById('pet-food');
    const mood = document.getElementById('pet-mood');
    const answerSaved = document.getElementById('pet-answer-saved');
    const question = document.getElementById('pet-question');
    const answerButton = petAnswerForm && petAnswerForm.querySelector('button[type="submit"]');
    const alreadyAnswered = sharedPet.last_answered_on === today;
    const alreadyFed = sharedPet.last_fed_on === today;
    const foodCount = Math.max(0, Number(sharedPet.food_count) || 0);
    const weight = currentPetWeight(sharedPet, today);

    if (figure) figure.dataset.outfit = outfit;
    if (nameDisplay) nameDisplay.textContent = name;
    if (nameInput && document.activeElement !== nameInput) nameInput.value = name;
    if (weightDisplay) weightDisplay.textContent = weight.toFixed(1) + ' kg';
    if (foodDisplay) foodDisplay.textContent = foodCount + (foodCount === 1 ? ' porción' : ' porciones');
    if (question) question.textContent = getDailyPetQuestion();
    if (answerSaved) {
        const answer = alreadyAnswered ? String(sharedPet.last_answer || '') : '';
        answerSaved.hidden = !answer;
        answerSaved.textContent = answer ? 'Lo que respondimos hoy: “' + answer + '”' : '';
    }
    if (answerButton) answerButton.disabled = alreadyAnswered || petAnswerSubmitting;
    if (petAnswerForm) {
        const answerInput = document.getElementById('pet-answer');
        if (answerInput) answerInput.disabled = alreadyAnswered;
    }
    if (petFeedButton) {
        petFeedButton.disabled = foodCount < 1 || alreadyFed;
        petFeedButton.textContent = alreadyFed ? 'Ya comió hoy 🤍' : 'Dar de comer 🦴';
    }
    if (mood) {
        if (daysBetweenPetDates(sharedPet.last_fed_on, today) >= 2) {
            mood.textContent = 'Tiene mucha hambre; una respuesta bonita le dará comida 🥺';
        } else if (alreadyFed) {
            mood.textContent = 'Está feliz y con la pancita llena 🤍';
        } else if (foodCount > 0) {
            mood.textContent = '¡Ya tiene comida! Regálenle una porción 🦴';
        } else {
            mood.textContent = 'Está esperando su pregunta bonita de hoy ✨';
        }
    }
    document.querySelectorAll('[data-pet-outfit]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.petOutfit === outfit));
    });
}

async function loadPetState() {
    const rows = await supabaseRequest(
        '/rest/v1/shared_pet?select=id,name,weight_kg,food_count,last_fed_on,last_answered_on,last_answer,outfit&id=eq.1&limit=1'
    );
    sharedPet = Array.isArray(rows) ? rows[0] || null : null;
    renderPet();
}

function formatPetHistoryDate(value) {
    const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    return new Intl.DateTimeFormat('es-EC', {
        timeZone: 'Pacific/Galapagos',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function renderPetAnswerHistory() {
    if (!petAnswerHistoryList) return;
    petAnswerHistoryList.replaceChildren();
    if (petAnswerHistoryCount) {
        const count = petAnswerHistory.length;
        petAnswerHistoryCount.textContent = count + (count === 1 ? ' respuesta guardada' : ' respuestas guardadas');
    }
    if (petAnswerHistory.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'pet-history-empty';
        empty.textContent = 'Todavía no hay respuestas. La primera quedará guardada aquí 🤍';
        petAnswerHistoryList.append(empty);
    } else {
        petAnswerHistory.forEach(entry => {
            const item = document.createElement('li');
            item.className = 'pet-history-entry';
            const date = document.createElement('time');
            date.className = 'pet-history-date';
            date.dateTime = String(entry.answered_on).slice(0, 10);
            date.textContent = formatPetHistoryDate(entry.answered_on);
            const question = document.createElement('p');
            question.className = 'pet-history-question';
            question.textContent = entry.question;
            const answer = document.createElement('p');
            answer.className = 'pet-history-answer';
            answer.textContent = entry.answer;
            item.append(date, question, answer);
            petAnswerHistoryList.append(item);
        });
    }
    if (petAnswerHistoryMore) {
        petAnswerHistoryMore.hidden = !petHistoryHasMore;
        petAnswerHistoryMore.disabled = petHistoryLoadingMore;
        petAnswerHistoryMore.textContent = petHistoryLoadingMore ? 'Cargando…' : 'Ver respuestas anteriores';
    }
}

function petHistorySetupHint(error) {
    if (error && (error.status === 404 || error.status === 406)) {
        return 'Falta activar el historial. Ejecuta supabase/add-pet-answer-history.sql en Supabase > SQL Editor.';
    }
    return (error && error.message ? error.message : 'No se pudo cargar el historial.') + ' Ejecuta supabase/add-pet-answer-history.sql en Supabase > SQL Editor si aún no lo has hecho.';
}

async function loadPetAnswerHistory({ older = false } = {}) {
    if (!supabaseReady || !petAnswerHistoryList) return;
    if (older && (petHistoryLoadingMore || !petHistoryHasMore || petAnswerHistory.length === 0)) return;
    if (older) {
        petHistoryLoadingMore = true;
        renderPetAnswerHistory();
    }
    try {
        const oldestDate = petAnswerHistory.length
            ? String(petAnswerHistory[petAnswerHistory.length - 1].answered_on).slice(0, 10)
            : '';
        const filter = older && oldestDate ? '&answered_on=lt.' + encodeURIComponent(oldestDate) : '';
        const rows = await supabaseRequest(
            '/rest/v1/pet_answer_history?select=id,question,answer,answered_on,created_at' + filter +
            '&order=answered_on.desc&limit=' + petHistoryPageSize
        );
        const fetched = Array.isArray(rows) ? rows : [];
        if (older) {
            petAnswerHistory = petAnswerHistory.concat(fetched);
        } else {
            const byId = new Map(fetched.concat(petAnswerHistory).map(entry => [entry.id, entry]));
            petAnswerHistory = Array.from(byId.values()).sort((a, b) => String(b.answered_on).localeCompare(String(a.answered_on)));
        }
        petHistoryHasMore = fetched.length === petHistoryPageSize;
        if (petAnswerHistoryStatus) petAnswerHistoryStatus.textContent = '';
        renderPetAnswerHistory();
    } catch (error) {
        if (petAnswerHistoryStatus) petAnswerHistoryStatus.textContent = petHistorySetupHint(error);
        if (!older) renderPetAnswerHistory();
    } finally {
        petHistoryLoadingMore = false;
        renderPetAnswerHistory();
    }
}

if (petAnswerHistoryMore) {
    petAnswerHistoryMore.addEventListener('click', () => loadPetAnswerHistory({ older: true }));
}
async function savePetChanges(changes, successMessage) {
    await supabaseRequest('/rest/v1/shared_pet?id=eq.1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(changes)
    });
    sharedPet = Object.assign({}, sharedPet, changes);
    renderPet();
    setStatus(petStatus, successMessage);
}

if (petNameForm) {
    petNameForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!sharedPet || !supabaseReady) return;
        const input = document.getElementById('pet-name-input');
        const name = input.value.trim();
        if (!name) {
            setStatus(petStatus, 'Escriban un nombre para su cachorro.');
            return;
        }
        const button = petNameForm.querySelector('button[type="submit"]');
        button.disabled = true;
        setStatus(petStatus, 'Guardando su nombre...');
        try {
            await savePetChanges({ name }, '¡Qué bonito nombre! Ya quedó guardado para ambos 🤍');
        } catch (error) {
            setStatus(petStatus, error.message || 'No se pudo guardar el nombre.');
        } finally {
            button.disabled = false;
        }
    });
}

document.querySelectorAll('[data-pet-outfit]').forEach(button => {
    button.addEventListener('click', async () => {
        if (!sharedPet || !supabaseReady) return;
        document.querySelectorAll('[data-pet-outfit]').forEach(item => { item.disabled = true; });
        try {
            await savePetChanges({ outfit: button.dataset.petOutfit }, 'Su ropita quedó guardada para los dos 🎀');
        } catch (error) {
            setStatus(petStatus, error.message || 'No se pudo guardar la ropita.');
        } finally {
            document.querySelectorAll('[data-pet-outfit]').forEach(item => { item.disabled = false; });
        }
    });
});

if (petAnswerForm) {
    petAnswerForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!sharedPet || !supabaseReady) return;
        const answerInput = document.getElementById('pet-answer');
        const answer = answerInput.value.trim();
        if (answer.length < 3) {
            setStatus(petQuestionStatus, 'Escriban una respuesta un poquito más larga 🤍');
            return;
        }
        const today = petDayKey();
        if (sharedPet.last_answered_on === today) {
            setStatus(petQuestionStatus, 'La pregunta de hoy ya quedó respondida. Mañana habrá otra ✨');
            renderPet();
            return;
        }
        const button = petAnswerForm.querySelector('button[type="submit"]');
        button.disabled = true;
        setStatus(petQuestionStatus, 'Guardando su respuesta y preparando una porción...');
        petAnswerSubmitting = true;
        try {
            const foodCount = Math.max(0, Number(sharedPet.food_count) || 0);
            const rows = await supabaseRequest('/rest/v1/pet_answer_history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    question: getDailyPetQuestion(),
                    answer,
                    answered_on: today
                })
            });
            const savedEntry = Array.isArray(rows) ? rows[0] : null;
            if (savedEntry) {
                const byId = new Map([savedEntry, ...petAnswerHistory].map(entry => [entry.id, entry]));
                petAnswerHistory = Array.from(byId.values()).sort((a, b) => String(b.answered_on).localeCompare(String(a.answered_on)));
                renderPetAnswerHistory();
            } else {
                await loadPetAnswerHistory();
            }
            sharedPet.food_count = foodCount + 1;
            sharedPet.last_answered_on = today;
            sharedPet.last_answer = answer;
            answerInput.value = '';
            renderPet();
            setStatus(petQuestionStatus, '¡Respuesta guardada! Ganaron una porción para su cachorrito 🦴');
        } catch (error) {
            if (error.status === 409) {
                await Promise.all([loadPetState().catch(() => {}), loadPetAnswerHistory()]);
                setStatus(petQuestionStatus, 'La respuesta de hoy ya quedó guardada por alguien. Mañana habrá otra ✨');
                if (sharedPet) sharedPet.last_answered_on = today;
            } else if (error.status === 404 || error.status === 406) {
                setStatus(petQuestionStatus, 'Falta activar el historial. Ejecuta supabase/add-pet-answer-history.sql en Supabase > SQL Editor.');
            } else {
                setStatus(petQuestionStatus, error.message || 'No se pudo guardar la respuesta.');
            }
        } finally {
            petAnswerSubmitting = false;
            renderPet();
            button.disabled = sharedPet.last_answered_on === today;
        }
    });
}

if (petFeedButton) {
    petFeedButton.addEventListener('click', async () => {
        if (!sharedPet || !supabaseReady) return;
        const today = petDayKey();
        const foodCount = Math.max(0, Number(sharedPet.food_count) || 0);
        if (foodCount < 1 || sharedPet.last_fed_on === today) {
            renderPet();
            return;
        }
        petFeedButton.disabled = true;
        setStatus(petStatus, 'Dándole su comida...');
        const weight = Math.min(8, currentPetWeight(sharedPet, today) + 0.2);
        try {
            await savePetChanges({
                food_count: foodCount - 1,
                last_fed_on: today,
                weight_kg: Number(weight.toFixed(2))
            }, '¡Qué bien cuidado! Su pancita está contenta 🐶🤍');
        } catch (error) {
            setStatus(petStatus, error.message || 'No se pudo guardar la comida.');
        } finally {
            renderPet();
        }
    });
}

async function initializeGallery() {
    if (!supabaseReady) {
        setStatus(galleryStatus, 'Conecta Supabase para activar la galería compartida.');
        return;
    }
    setStatus(galleryStatus, 'Cargando recuerdos de la galería...');
    try {
        await loadGalleryItems();
        setStatus(galleryStatus, 'Las fotos y los videos se comparten con todos los visitantes.');
    } catch (error) {
        setStatus(galleryStatus, (error.message || 'No se pudo cargar la galería.') + ' Ejecuta supabase/add-gallery-and-pet.sql en Supabase > SQL Editor.');
    }
}

function setPetControlsEnabled(enabled) {
    document.querySelectorAll('#pet-name-input, #pet-name-form button, [data-pet-outfit], #pet-answer, #pet-answer-form button').forEach(control => {
        control.disabled = !enabled;
    });
    if (!enabled && petFeedButton) petFeedButton.disabled = true;
    if (enabled) renderPet();
}
async function initializePet() {
    setPetControlsEnabled(false);
    if (!supabaseReady) {
        setStatus(petStatus, 'Conecta Supabase para guardar el cachorro compartido.');
        setStatus(petQuestionStatus, 'La pregunta diaria estará disponible al conectar Supabase.');
        return;
    }
    setStatus(petStatus, 'Despertando a su cachorrito...');
    setStatus(petQuestionStatus, 'Cargando la pregunta de hoy...');
    try {
        await loadPetState();
        if (!sharedPet) throw new Error('No se encontró el cachorro compartido.');
        await loadPetAnswerHistory();
        setPetControlsEnabled(true);
        setStatus(petStatus, 'El nombre, la ropita y sus cuidados se comparten entre ustedes 🤍');
        if (sharedPet.last_answered_on === petDayKey()) {
            setStatus(petQuestionStatus, 'La pregunta de hoy ya quedó respondida. Mañana habrá otra ✨');
        } else {
            setStatus(petQuestionStatus, 'Respondan la pregunta para ganar una porción de comida.');
        }
    } catch (error) {
        const message = (error.message || 'No se pudo cargar el cachorro.') + ' Ejecuta supabase/add-gallery-and-pet.sql en Supabase > SQL Editor.';
        setStatus(petStatus, message);
        setStatus(petQuestionStatus, 'La pregunta y la comida estarán listas cuando el cachorro quede conectado.');
    }
}

initializeGallery();
initializePet();
if (supabaseReady) {
    setInterval(() => {
        if (!editingGalleryId) loadGalleryItems().catch(() => {});
        loadPetState().catch(() => {});
        loadPetAnswerHistory();
    }, 30000);
    setInterval(renderPet, 60000);
}
