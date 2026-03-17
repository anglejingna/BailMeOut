// BailMeOut FaceTime Logic with IndexedDB
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const clockDisplay = document.getElementById('clock-display');
    const clockUI = document.getElementById('clock-ui');
    const fakeCallUI = document.getElementById('fake-call-ui');
    const activeCallUI = document.getElementById('active-call-ui');
    const settingsUI = document.getElementById('settings-ui');
    
    // Call UI dynamic elements
    const callerNameDisplay = document.getElementById('caller-name');
    const activeCallerNameDisplay = document.getElementById('active-caller-name');
    const callDurationDisplay = document.getElementById('call-duration');
    const fakeCallerVideo = document.getElementById('fake-caller-video');
    const userCamera = document.getElementById('user-camera');
    
    // Buttons
    const btnAccept = document.getElementById('btn-accept');
    const btnDecline = document.getElementById('btn-decline');
    const btnEndCall = document.getElementById('btn-end-call');
    
    // Settings Elements
    const settingsTrigger = document.getElementById('settings-trigger');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const inputCallerName = document.getElementById('setting-caller-name');
    const inputDelay = document.getElementById('setting-delay');
    const inputVideo = document.getElementById('setting-video');
    const videoStatus = document.getElementById('video-status');
    const callAudio = document.getElementById('call-audio'); // fallback ringing
    
    // State
    let taps = 0;
    let tapTimeout = null;
    let longPressTimeout = null;
    let countdownTimeout = null;
    let vibrationInterval = null;
    let callTimerInterval = null;
    let callSeconds = 0;
    
    let isDbReady = false;
    let userCameraStream = null;
    let fakeVideoObjectUrl = null;
    
    // Database Config
    const DB_NAME = 'BailMeOutDB';
    const STORE_NAME = 'settingsStore';
    let db;
    
    let pendingVideoBlob = null; // Stored temporarily when file is selected
    
    let config = {
        callerName: "เจ้านาย (ด่วน)",
        delaySeconds: 5,
        hasVideo: false
    };
    
    // --- INIT ---
    function init() {
        initDB().then(() => {
            loadSettings();
        }).catch(err => {
            console.error('IndexedDB init error:', err);
        });
        startClock();
        registerServiceWorker();
    }
    
    // --- DATABASE (IndexedDB) ---
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            
            request.onupgradeneeded = (event) => {
                db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            
            request.onsuccess = (event) => {
                db = event.target.result;
                isDbReady = true;
                resolve();
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    function setDBValue(key, value) {
        return new Promise((resolve, reject) => {
            if (!isDbReady) return resolve(); // or reject
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(value, key);
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
    function getDBValue(key) {
        return new Promise((resolve, reject) => {
            if (!isDbReady) return resolve(null);
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
    // --- SETTINGS ---
    async function loadSettings() {
        try {
            const savedConfig = await getDBValue('config');
            if (savedConfig) {
                config = { ...config, ...savedConfig };
            }
            
            inputCallerName.value = config.callerName;
            inputDelay.value = config.delaySeconds;
            
            callerNameDisplay.textContent = config.callerName;
            activeCallerNameDisplay.textContent = config.callerName;
            
            if (config.hasVideo) {
                videoStatus.textContent = "Video loaded from database.";
                videoStatus.classList.remove('hidden');
            } else {
                videoStatus.classList.add('hidden');
            }
        } catch(e) {
            console.error("Error loading settings", e);
        }
    }
    
    async function saveSettings() {
        btnSaveSettings.textContent = 'Saving...';
        btnSaveSettings.disabled = true;
        
        config.callerName = inputCallerName.value || "เจ้านาย (ด่วน)";
        config.delaySeconds = parseInt(inputDelay.value) || 5;
        
        if (pendingVideoBlob) {
            await setDBValue('videoBlob', pendingVideoBlob);
            config.hasVideo = true;
            pendingVideoBlob = null; // clear it
            videoStatus.textContent = "Video saved to database.";
            videoStatus.classList.remove('hidden');
        }
        
        await setDBValue('config', config);
        
        callerNameDisplay.textContent = config.callerName;
        activeCallerNameDisplay.textContent = config.callerName;
        
        btnSaveSettings.textContent = 'Save Settings';
        btnSaveSettings.disabled = false;
        
        settingsUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        resetApp();
    }
    
    inputVideo.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            pendingVideoBlob = file;
            videoStatus.textContent = `Selected: ${file.name}. Click Save!`;
            videoStatus.classList.remove('hidden');
        }
    });
    
    btnSaveSettings.addEventListener('click', saveSettings);
    btnCloseSettings.addEventListener('click', () => {
        settingsUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        loadSettings(); // revert unsaved changes
    });
    
    // --- CLOCK UI ---
    function startClock() {
        setInterval(() => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            clockDisplay.textContent = `${hours}:${minutes}`;
        }, 1000);
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockDisplay.textContent = `${hours}:${minutes}`;
    }
    
    // --- SECRET TRIGGERS ---
    
    document.body.addEventListener('touchstart', handleTap);
    document.body.addEventListener('mousedown', handleTap);
    
    function handleTap(e) {
        if (!clockUI.classList.contains('hidden') && e.target !== settingsTrigger && e.target.closest('#clock-ui')) {
            taps++;
            if (taps === 1) {
                tapTimeout = setTimeout(() => {
                    taps = 0;
                }, 2000);
            }
            
            if (taps >= 3) {
                clearTimeout(tapTimeout);
                taps = 0;
                startFakeCallSequence();
            }
        }
    }
    
    function startLongPress(e) {
        e.preventDefault();
        longPressTimeout = setTimeout(() => {
            clockUI.classList.add('hidden');
            settingsUI.classList.remove('hidden');
        }, 3000);
    }
    
    function cancelLongPress() {
        clearTimeout(longPressTimeout);
    }
    
    settingsTrigger.addEventListener('touchstart', startLongPress);
    settingsTrigger.addEventListener('touchend', cancelLongPress);
    settingsTrigger.addEventListener('mousedown', startLongPress);
    settingsTrigger.addEventListener('mouseup', cancelLongPress);
    settingsTrigger.addEventListener('mouseleave', cancelLongPress);
    
    // --- FAKE CALL LOGIC ---
    function startFakeCallSequence() {
        clockDisplay.style.opacity = '0.5';
        setTimeout(() => clockDisplay.style.opacity = '1', 200);
        
        clearTimeout(countdownTimeout);
        countdownTimeout = setTimeout(() => {
            showIncomingCall();
        }, config.delaySeconds * 1000);
    }
    
    function showIncomingCall() {
        clockUI.classList.add('hidden');
        fakeCallUI.classList.remove('hidden');
        fakeCallUI.classList.add('animate-fade-in');
        
        if (navigator.vibrate) {
            vibrationInterval = setInterval(() => {
                navigator.vibrate([1000, 500]);
            }, 1500);
            navigator.vibrate([1000, 500]);
        }
    }
    
    // Answer Call
    btnAccept.addEventListener('click', async () => {
        stopVibration();
        fakeCallUI.classList.add('hidden');
        activeCallUI.classList.remove('hidden');
        
        // Start front camera WebRTC
        try {
            userCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            userCamera.srcObject = userCameraStream;
            userCamera.style.display = 'block';
        } catch (err) {
            console.error("Camera access denied or unavailable", err);
            // Default grey box is displayed by CSS fallback
        }
        
        // Load fake caller video from IndexedDB
        if (config.hasVideo) {
            try {
                const videoBlob = await getDBValue('videoBlob');
                if (videoBlob) {
                    fakeVideoObjectUrl = URL.createObjectURL(videoBlob);
                    fakeCallerVideo.src = fakeVideoObjectUrl;
                    fakeCallerVideo.classList.remove('hidden');
                    fakeCallerVideo.play().catch(e => console.error("Video play failed:", e));
                }
            } catch(e) {
                console.error("Failed to load videoBlob", e);
            }
        }

        callSeconds = 0;
        updateCallDuration();
        callTimerInterval = setInterval(() => {
            callSeconds++;
            updateCallDuration();
        }, 1000);
    });
    
    // Decline / End Call
    btnDecline.addEventListener('click', endCall);
    btnEndCall.addEventListener('click', endCall);
    
    function endCall() {
        stopVibration();
        clearInterval(callTimerInterval);
        
        // Stop Fake Video
        fakeCallerVideo.pause();
        fakeCallerVideo.src = '';
        fakeCallerVideo.classList.add('hidden');
        if (fakeVideoObjectUrl) {
            URL.revokeObjectURL(fakeVideoObjectUrl);
            fakeVideoObjectUrl = null;
        }
        
        // Stop WebRTC Camera
        if (userCameraStream) {
            userCameraStream.getTracks().forEach(track => track.stop());
            userCamera.srcObject = null;
            userCameraStream = null;
        }
        
        // Hide all call UI, show clock
        fakeCallUI.classList.add('hidden');
        activeCallUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        
        callSeconds = 0;
    }
    
    function stopVibration() {
        clearInterval(vibrationInterval);
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    }
    
    function updateCallDuration() {
        const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
        const s = String(callSeconds % 60).padStart(2, '0');
        callDurationDisplay.textContent = `${m}:${s}`;
    }
    
    function resetApp() {
        clearTimeout(countdownTimeout);
        endCall();
    }
    
    // --- SERVICE WORKER ---
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW registered!', reg))
                .catch(err => console.error('SW Failed!', err));
        }
    }
    
    init();
});
