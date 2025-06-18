// mediaCapture.js - Módulo para captura de imágenes y grabación de video

// Variables para almacenar las capturas y grabaciones
let capturedImages = [];
let recordedVideos = [];
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingStartTime = 0;
let recordingTimer = null;
let downloadQueue = new Map(); // Mapa para realizar seguimiento de las descargas
let currentPreviewItem = null; // Elemento actualmente en vista previa

/**
 * Inicializar y configurar el sistema de captura de medios
 */
export function setupMediaCapture() {
    try {
        console.log('Inicializando sistema de captura de medios...');
        
        // Referencia a elementos DOM
        const captureBtn = document.getElementById('captureBtn');
        const recordBtn = document.getElementById('recordBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const thumbnailsPanel = document.getElementById('thumbnailsPanel');
        const previewModal = document.getElementById('previewModal');
        const closePreviewBtn = document.getElementById('closePreviewBtn');
        const downloadPreviewBtn = document.getElementById('downloadPreviewBtn');
        const previewContainer = document.getElementById('previewContainer');
        const recordingIndicator = document.getElementById('recordingIndicator');
        const recordTime = document.getElementById('recordTime');
        
        // Configurar eventos
        if (captureBtn) {
            captureBtn.addEventListener('click', captureImage);
        }
        
        if (recordBtn) {
            recordBtn.addEventListener('click', toggleRecording);
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadAllMedia);
        }
        
        // Eventos para la vista previa
        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', closePreview);
        }
        
        if (downloadPreviewBtn) {
            downloadPreviewBtn.addEventListener('click', downloadCurrentPreview);
        }
        
        document.querySelector('.close-preview')?.addEventListener('click', closePreview);
        
        // Escuchar eventos de detención de transmisión para finalizar la grabación si está activa
        document.addEventListener('videoStreamStopped', () => {
            if (isRecording) {
                stopRecording();
            }
        });
        
        console.log('Sistema de captura de medios inicializado correctamente');
        window.logMessage('Sistema de captura de medios inicializado');
        
    } catch (error) {
        console.error('Error al inicializar sistema de captura:', error);
        window.logMessage('Error al inicializar sistema de captura: ' + error.message, true);
    }
}

/**
 * Capturar una imagen del video actual
 */
function captureImage() {
    try {
        const videoCanvas = document.getElementById('local-video');
        
        if (!videoCanvas) {
            throw new Error('Canvas de video no encontrado');
        }
        
        // Verificar si hay video activo
        if (videoCanvas.style.display === 'none') {
            window.logMessage('No hay transmisión de video activa para capturar', true);
            return;
        }
        
        // Obtener el contexto 2D del canvas
        const ctx = videoCanvas.getContext('2d');
        if (!ctx) {
            throw new Error('No se pudo obtener el contexto 2D del canvas');
        }
        
        // Crear un nuevo canvas para la captura (para no modificar el original)
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = videoCanvas.width;
        captureCanvas.height = videoCanvas.height;
        const captureCtx = captureCanvas.getContext('2d');
        
        // Dibujar la imagen actual del canvas de video en el nuevo canvas
        captureCtx.drawImage(videoCanvas, 0, 0, videoCanvas.width, videoCanvas.height);
        
        // Obtener la imagen como URL de datos
        const imageDataUrl = captureCanvas.toDataURL('image/jpeg', 0.9);
        
        // Crear objeto para la imagen capturada
        const captureTime = new Date();
        const captureObj = {
            id: 'img_' + Date.now(),
            type: 'image',
            dataUrl: imageDataUrl,
            timestamp: captureTime,
            filename: `captura_${formatDateForFilename(captureTime)}.jpg`
        };
        
        // Añadir a la lista de capturas
        capturedImages.push(captureObj);
        
        // Crear y añadir miniatura
        addThumbnail(captureObj);
        
        // Habilitar botón de descarga
        document.getElementById('downloadBtn').removeAttribute('disabled');
        
        window.logMessage('Imagen capturada correctamente');
        
        // Efecto visual de flash
        flashEffect();
        
    } catch (error) {
        console.error('Error al capturar imagen:', error);
        window.logMessage('Error al capturar imagen: ' + error.message, true);
    }
}

/**
 * Iniciar o detener la grabación de video
 */
function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

/**
 * Iniciar la grabación de video
 */
function startRecording() {
    try {
        const videoCanvas = document.getElementById('local-video');
        
        if (!videoCanvas) {
            throw new Error('Canvas de video no encontrado');
        }
        
        // Verificar si hay video activo
        if (videoCanvas.style.display === 'none') {
            window.logMessage('No hay transmisión de video activa para grabar', true);
            return;
        }
        
        // Crear un stream a partir del canvas
        const canvasStream = videoCanvas.captureStream(30); // 30 FPS
        
        // Verificar si el stream tiene pistas de video
        if (!canvasStream.getVideoTracks().length) {
            throw new Error('No se pudieron obtener pistas de video del canvas');
        }
        
        // Configurar el MediaRecorder
        const options = { mimeType: 'video/webm;codecs=vp9' };
        try {
            mediaRecorder = new MediaRecorder(canvasStream, options);
        } catch (e) {
            console.warn('VP9 no soportado, intentando con VP8:', e);
            try {
                mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp8' });
            } catch (e) {
                console.warn('VP8 no soportado, usando formato predeterminado:', e);
                mediaRecorder = new MediaRecorder(canvasStream);
            }
        }
        
        // Limpiar chunks anteriores
        recordedChunks = [];
        
        // Configurar eventos del MediaRecorder
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleRecordingStop;
        
        // Iniciar la grabación
        mediaRecorder.start(1000); // Generar datos cada segundo
        isRecording = true;
        recordingStartTime = Date.now();
        
        // Iniciar temporizador
        startRecordingTimer();
        
        // Cambiar apariencia del botón
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" fill="white"/>
                </svg>
            `;
            recordBtn.classList.add('recording');
            recordBtn.title = 'Detener grabación';
        }
        
        // Mostrar indicador de grabación
        const recordingIndicator = document.getElementById('recordingIndicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'flex';
        }
        
        window.logMessage('Grabación de video iniciada');
        
    } catch (error) {
        console.error('Error al iniciar grabación:', error);
        window.logMessage('Error al iniciar grabación: ' + error.message, true);
    }
}

/**
 * Detener la grabación de video
 */
function stopRecording() {
    try {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            throw new Error('No hay grabación activa');
        }
        
        // Detener el MediaRecorder
        mediaRecorder.stop();
        isRecording = false;
        
        // Detener temporizador
        stopRecordingTimer();
        
        // Cambiar apariencia del botón
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8" fill="white"/>
                </svg>
            `;
            recordBtn.classList.remove('recording');
            recordBtn.title = 'Grabar video';
        }
        
        // Ocultar indicador de grabación
        const recordingIndicator = document.getElementById('recordingIndicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'none';
        }
        
        window.logMessage('Grabación de video detenida');
        
    } catch (error) {
        console.error('Error al detener grabación:', error);
        window.logMessage('Error al detener grabación: ' + error.message, true);
    }
}

/**
 * Manejar datos disponibles durante la grabación
 */
function handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
    }
}

/**
 * Manejar la finalización de la grabación
 */
function handleRecordingStop() {
    try {
        // Verificar si hay datos grabados
        if (!recordedChunks.length) {
            throw new Error('No se grabaron datos de video');
        }
        
        // Crear Blob con los chunks grabados
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        
        // Crear URL para el Blob
        const videoUrl = URL.createObjectURL(blob);
        
        // Crear objeto para el video grabado
        const recordTime = new Date();
        const duration = Date.now() - recordingStartTime;
        const videoObj = {
            id: 'vid_' + Date.now(),
            type: 'video',
            blob: blob,
            url: videoUrl,
            timestamp: recordTime,
            duration: duration,
            filename: `video_${formatDateForFilename(recordTime)}.webm`
        };
        
        // Añadir a la lista de videos
        recordedVideos.push(videoObj);
        
        // Crear y añadir miniatura
        addThumbnail(videoObj);
        
        // Habilitar botón de descarga
        document.getElementById('downloadBtn').removeAttribute('disabled');
        
        window.logMessage(`Video grabado (duración: ${formatDuration(duration)})`);
        
    } catch (error) {
        console.error('Error al finalizar grabación:', error);
        window.logMessage('Error al finalizar grabación: ' + error.message, true);
    }
}

/**
 * Añadir una miniatura al panel
 */
function addThumbnail(mediaItem) {
    try {
        const thumbnailsPanel = document.getElementById('thumbnailsPanel');
        
        if (!thumbnailsPanel) {
            throw new Error('Panel de miniaturas no encontrado');
        }
        
        // Crear elemento de miniatura
        const thumbnailItem = document.createElement('div');
        thumbnailItem.className = 'thumbnail-item';
        thumbnailItem.dataset.id = mediaItem.id;
        thumbnailItem.dataset.type = mediaItem.type;
        
        // Contenido según tipo
        if (mediaItem.type === 'image') {
            thumbnailItem.innerHTML = `
                <img src="${mediaItem.dataUrl}" alt="Captura ${formatTime(mediaItem.timestamp)}">
                <div class="thumbnail-actions">
                    <button class="preview-btn" title="Vista previa"><small>Ver</small></button>
                    <button class="download-btn" title="Descargar"><small>↓</small></button>
                    <button class="delete-btn" title="Eliminar"><small>×</small></button>
                </div>
            `;
        } else if (mediaItem.type === 'video') {
            thumbnailItem.innerHTML = `
                <video src="${mediaItem.url}" preload="metadata"></video>
                <div class="thumbnail-actions">
                    <button class="preview-btn" title="Vista previa"><small>Ver</small></button>
                    <button class="download-btn" title="Descargar"><small>↓</small></button>
                    <button class="delete-btn" title="Eliminar"><small>×</small></button>
                </div>
            `;
        }
        
        // Configurar eventos
        thumbnailItem.querySelector('.preview-btn').addEventListener('click', () => {
            openPreview(mediaItem);
        });
        
        thumbnailItem.querySelector('.download-btn').addEventListener('click', () => {
            downloadMedia(mediaItem);
        });
        
        thumbnailItem.querySelector('.delete-btn').addEventListener('click', () => {
            deleteMedia(mediaItem.id);
        });
        
        // Permitir clic en toda la miniatura para vista previa
        thumbnailItem.addEventListener('click', (e) => {
            // Si no se hizo clic en un botón
            if (!e.target.closest('button')) {
                openPreview(mediaItem);
            }
        });
        
        // Agregar al panel
        thumbnailsPanel.appendChild(thumbnailItem);
        
        // Mostrar el panel si estaba oculto
        thumbnailsPanel.style.display = 'flex';
        
    } catch (error) {
        console.error('Error al añadir miniatura:', error);
        window.logMessage('Error al añadir miniatura: ' + error.message, true);
    }
}

/**
 * Abrir vista previa de un elemento
 */
function openPreview(mediaItem) {
    try {
        const previewModal = document.getElementById('previewModal');
        const previewContainer = document.getElementById('previewContainer');
        
        if (!previewModal || !previewContainer) {
            throw new Error('Elementos de vista previa no encontrados');
        }
        
        // Limpiar contenedor
        previewContainer.innerHTML = '';
        
        // Añadir contenido según tipo
        if (mediaItem.type === 'image') {
            previewContainer.innerHTML = `
                <img src="${mediaItem.dataUrl}" alt="Captura ${formatTime(mediaItem.timestamp)}">
            `;
        } else if (mediaItem.type === 'video') {
            previewContainer.innerHTML = `
                <video src="${mediaItem.url}" controls autoplay></video>
            `;
        }
        
        // Guardar referencia al elemento actual
        currentPreviewItem = mediaItem;
        
        // Mostrar modal
        previewModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error al abrir vista previa:', error);
        window.logMessage('Error al abrir vista previa: ' + error.message, true);
    }
}

/**
 * Cerrar vista previa
 */
function closePreview() {
    const previewModal = document.getElementById('previewModal');
    
    if (previewModal) {
        previewModal.style.display = 'none';
        
        // Detener video si está reproduciendo
        const video = previewModal.querySelector('video');
        if (video) {
            video.pause();
        }
        
        // Limpiar referencia
        currentPreviewItem = null;
    }
}

/**
 * Descargar el elemento en vista previa actual
 */
function downloadCurrentPreview() {
    if (currentPreviewItem) {
        downloadMedia(currentPreviewItem);
    } else {
        window.logMessage('No hay elemento para descargar', true);
    }
}

/**
 * Descargar un elemento multimedia
 */
function downloadMedia(mediaItem) {
    try {
        // Verificar si ya está en cola de descarga
        if (downloadQueue.has(mediaItem.id)) {
            window.logMessage('Este elemento ya está siendo descargado', true);
            return;
        }
        
        window.logMessage(`Preparando descarga de ${mediaItem.type === 'image' ? 'imagen' : 'video'}...`);
        
        // Añadir a cola de descarga
        downloadQueue.set(mediaItem.id, true);
        
        // Crear enlace de descarga
        const downloadLink = document.createElement('a');
        
        if (mediaItem.type === 'image') {
            // Para imágenes, usar directamente la URL de datos
            downloadLink.href = mediaItem.dataUrl;
            downloadLink.download = mediaItem.filename;
            
            // Iniciar descarga
            downloadLink.click();
            
            // Quitar de la cola
            downloadQueue.delete(mediaItem.id);
            
            window.logMessage(`Imagen "${mediaItem.filename}" descargada`);
            
        } else if (mediaItem.type === 'video') {
            // Para videos, usar el Blob
            downloadLink.href = mediaItem.url;
            downloadLink.download = mediaItem.filename;
            
            // Iniciar descarga
            downloadLink.click();
            
            // Quitar de la cola
            downloadQueue.delete(mediaItem.id);
            
            window.logMessage(`Video "${mediaItem.filename}" descargado`);
        }
        
    } catch (error) {
        console.error('Error al descargar:', error);
        window.logMessage('Error al descargar: ' + error.message, true);
        
        // Quitar de la cola en caso de error
        downloadQueue.delete(mediaItem.id);
    }
}

/**
 * Descargar todos los elementos multimedia
 */
function downloadAllMedia() {
    try {
        // Verificar si hay elementos para descargar
        if (capturedImages.length === 0 && recordedVideos.length === 0) {
            window.logMessage('No hay elementos para descargar', true);
            return;
        }
        
        window.logMessage('Preparando descarga de todos los elementos...');
        
        // Usar setTimeout para espaciar las descargas y evitar bloqueos del navegador
        let delay = 0;
        
        // Descargar imágenes
        capturedImages.forEach(img => {
            setTimeout(() => {
                downloadMedia(img);
            }, delay);
            delay += 500; // Espaciar 500ms
        });
        
        // Descargar videos
        recordedVideos.forEach(vid => {
            setTimeout(() => {
                downloadMedia(vid);
            }, delay);
            delay += 1000; // Espaciar 1000ms para videos (son más grandes)
        });
        
    } catch (error) {
        console.error('Error al descargar todos los elementos:', error);
        window.logMessage('Error al descargar todos los elementos: ' + error.message, true);
    }
}

/**
 * Eliminar un elemento multimedia
 */
function deleteMedia(id) {
    try {
        // Verificar tipo de elemento (imagen o video)
        const isImage = id.startsWith('img_');
        
        // Eliminar de la lista correspondiente
        if (isImage) {
            capturedImages = capturedImages.filter(img => img.id !== id);
        } else {
            // Para videos, también liberar memoria del Blob
            const video = recordedVideos.find(vid => vid.id === id);
            if (video) {
                URL.revokeObjectURL(video.url);
            }
            recordedVideos = recordedVideos.filter(vid => vid.id !== id);
        }
        
        // Eliminar miniatura
        const thumbnailItem = document.querySelector(`.thumbnail-item[data-id="${id}"]`);
        if (thumbnailItem) {
            thumbnailItem.remove();
        }
        
        // Si era el elemento en vista previa, cerrar la vista
        if (currentPreviewItem && currentPreviewItem.id === id) {
            closePreview();
        }
        
        // Verificar si quedan elementos
        if (capturedImages.length === 0 && recordedVideos.length === 0) {
            // Deshabilitar botón de descarga
            document.getElementById('downloadBtn').setAttribute('disabled', 'disabled');
            
            // Ocultar panel de miniaturas si está vacío
            const thumbnailsPanel = document.getElementById('thumbnailsPanel');
            if (thumbnailsPanel) {
                thumbnailsPanel.style.display = 'none';
            }
        }
        
        window.logMessage(`${isImage ? 'Imagen' : 'Video'} eliminado`);
        
    } catch (error) {
        console.error('Error al eliminar elemento:', error);
        window.logMessage('Error al eliminar elemento: ' + error.message, true);
    }
}

/**
 * Iniciar temporizador de grabación
 */
function startRecordingTimer() {
    const recordTime = document.getElementById('recordTime');
    
    if (recordTime) {
        // Reiniciar valor
        recordTime.textContent = '00:00';
        
        // Iniciar intervalo
        recordingTimer = setInterval(() => {
            const duration = Date.now() - recordingStartTime;
            recordTime.textContent = formatDuration(duration);
        }, 1000);
    }
}

/**
 * Detener temporizador de grabación
 */
function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

/**
 * Generar efecto de flash al capturar imagen
 */
function flashEffect() {
    try {
        // Crear elemento para el flash
        const flash = document.createElement('div');
        flash.style.position = 'absolute';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0.8';
        flash.style.zIndex = '200';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.3s ease-out';
        
        // Añadir al contenedor de video
        const videoContainer = document.getElementById('video-call-div');
        if (videoContainer) {
            videoContainer.appendChild(flash);
            
            // Desvanecer y eliminar
            setTimeout(() => {
                flash.style.opacity = '0';
                
                // Eliminar después de completar transición
                setTimeout(() => {
                    flash.remove();
                }, 300);
            }, 50);
        }
    } catch (error) {
        console.error('Error al crear efecto flash:', error);
    }
}

/**
 * Formatear fecha para nombre de archivo
 */
function formatDateForFilename(date) {
    const d = new Date(date);
    return d.getFullYear() +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        ('0' + d.getDate()).slice(-2) + '_' +
        ('0' + d.getHours()).slice(-2) +
        ('0' + d.getMinutes()).slice(-2) +
        ('0' + d.getSeconds()).slice(-2);
}

/**
 * Formatear hora para mostrar
 */
function formatTime(date) {
    const d = new Date(date);
    return ('0' + d.getHours()).slice(-2) + ':' +
        ('0' + d.getMinutes()).slice(-2) + ':' +
        ('0' + d.getSeconds()).slice(-2);
}

/**
 * Formatear duración en formato MM:SS
 */
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2);
}