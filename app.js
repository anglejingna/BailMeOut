// BailMeOut FaceTime Logic with IndexedDB
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const clockDisplay = document.getElementById('clock-display');
    const lockScreenImg = document.getElementById('lock-screen-img');
    const clockUI = document.getElementById('clock-ui');
    const fakeCallUI = document.getElementById('fake-call-ui');
    const activeCallUI = document.getElementById('active-call-ui');
    const settingsUI = document.getElementById('settings-ui');
    
    // Call UI dynamic elements
    const callerNameDisplay = document.getElementById('caller-name');
    const activeCallerNameDisplay = document.getElementById('active-caller-name');
    const callerTypeDisplay = document.getElementById('caller-type');
    const callDurationDisplay = document.getElementById('call-duration');
    const fakeCallerVideo = document.getElementById('fake-caller-video');
    const userCamera = document.getElementById('user-camera');
    const callerBgImg = document.getElementById('caller-bg-img');
    const callerBgOverlay = document.getElementById('caller-bg-overlay');
    
    // Icons
    const iconPhone = document.getElementById('icon-phone');
    const iconVideo = document.getElementById('icon-video');

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
    const btnRemoveVideo = document.getElementById('btn-remove-video');
    
    const inputImage = document.getElementById('setting-image');
    const imageStatus = document.getElementById('image-status');
    const btnRemoveImage = document.getElementById('btn-remove-image');

    const inputRingtone = document.getElementById('setting-ringtone');
    const ringtoneStatus = document.getElementById('ringtone-status');
    const btnRemoveRingtone = document.getElementById('btn-remove-ringtone');

    const inputCallerBg = document.getElementById('setting-caller-bg');
    const callerBgStatus = document.getElementById('caller-bg-status');
    const btnRemoveCallerBg = document.getElementById('btn-remove-caller-bg');

    const callAudio = document.getElementById('call-audio'); 
    
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
    let ringtoneObjectUrl = null;
    let callerBgObjectUrl = null;
    let lockScreenObjectUrl = null;
    
    // Database Config
    const DB_NAME = 'BailMeOutDB';
    const STORE_NAME = 'settingsStore';
    let db;
    
    let pendingVideoBlob = null;
    let pendingImageBlob = null;
    let pendingRingtoneBlob = null;
    let pendingCallerBgBlob = null;
    
    let config = {
        callerName: "เจ้านาย (ด่วน)",
        delaySeconds: 5,
        hasVideo: false,
        hasImage: false,
        hasRingtone: false,
        hasCallerBg: false
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
            const request = indexedDB.open(DB_NAME, 2);
            
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
            if (!isDbReady) return resolve();
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

    function removeDBValue(key) {
        return new Promise((resolve, reject) => {
            if (!isDbReady) return resolve();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
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
                videoStatus.classList.remove('hidden');
                btnRemoveVideo.classList.remove('hidden');
            } else {
                videoStatus.classList.add('hidden');
                btnRemoveVideo.classList.add('hidden');
            }

            if (config.hasImage) {
                imageStatus.classList.remove('hidden');
                btnRemoveImage.classList.remove('hidden');
                const imageBlob = await getDBValue('lockScreenBlob');
                if (imageBlob) {
                    if (lockScreenObjectUrl) URL.revokeObjectURL(lockScreenObjectUrl);
                    lockScreenObjectUrl = URL.createObjectURL(imageBlob);
                    lockScreenImg.src = lockScreenObjectUrl;
                    lockScreenImg.classList.remove('hidden');
                }
            } else {
                imageStatus.classList.add('hidden');
                btnRemoveImage.classList.add('hidden');
                lockScreenImg.classList.add('hidden');
            }

            if (config.hasRingtone) {
                ringtoneStatus.classList.remove('hidden');
                btnRemoveRingtone.classList.remove('hidden');
                const ringtoneBlob = await getDBValue('ringtoneBlob');
                if (ringtoneBlob) {
                    if (ringtoneObjectUrl) URL.revokeObjectURL(ringtoneObjectUrl);
                    ringtoneObjectUrl = URL.createObjectURL(ringtoneBlob);
                    callAudio.src = ringtoneObjectUrl;
                }
            } else {
                ringtoneStatus.classList.add('hidden');
                btnRemoveRingtone.classList.add('hidden');
                callAudio.src = ''; 
            }

            if (config.hasCallerBg) {
                callerBgStatus.classList.remove('hidden');
                btnRemoveCallerBg.classList.remove('hidden');
                const callerBgBlob = await getDBValue('callerBgBlob');
                if (callerBgBlob) {
                    if (callerBgObjectUrl) URL.revokeObjectURL(callerBgObjectUrl);
                    callerBgObjectUrl = URL.createObjectURL(callerBgBlob);
                    callerBgImg.src = callerBgObjectUrl;
                }
            } else {
                callerBgStatus.classList.add('hidden');
                btnRemoveCallerBg.classList.add('hidden');
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
            pendingVideoBlob = null;
        }
        
        if (pendingImageBlob) {
            await setDBValue('lockScreenBlob', pendingImageBlob);
            config.hasImage = true;
            pendingImageBlob = null;
        }

        if (pendingRingtoneBlob) {
            await setDBValue('ringtoneBlob', pendingRingtoneBlob);
            config.hasRingtone = true;
            pendingRingtoneBlob = null;
        }

        if (pendingCallerBgBlob) {
            await setDBValue('callerBgBlob', pendingCallerBgBlob);
            config.hasCallerBg = true;
            pendingCallerBgBlob = null;
        }
        
        await setDBValue('config', config);
        await loadSettings();
        
        btnSaveSettings.textContent = 'Save Settings';
        btnSaveSettings.disabled = false;
        
        settingsUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        resetApp();
    }
    
    inputVideo.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { pendingVideoBlob = file; videoStatus.textContent = `Selected: ${file.name}. Click Save!`; videoStatus.classList.remove('hidden'); }
    });
    inputImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { pendingImageBlob = file; imageStatus.textContent = `Selected: ${file.name}. Click Save!`; imageStatus.classList.remove('hidden'); }
    });
    inputRingtone.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { pendingRingtoneBlob = file; ringtoneStatus.textContent = `Selected: ${file.name}. Click Save!`; ringtoneStatus.classList.remove('hidden'); }
    });
    inputCallerBg.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { pendingCallerBgBlob = file; callerBgStatus.textContent = `Selected: ${file.name}. Click Save!`; callerBgStatus.classList.remove('hidden'); }
    });

    btnRemoveVideo.addEventListener('click', async () => {
        await removeDBValue('videoBlob');
        config.hasVideo = false; await setDBValue('config', config);
        inputVideo.value = ''; pendingVideoBlob = null;
        videoStatus.classList.add('hidden'); btnRemoveVideo.classList.add('hidden');
    });
    btnRemoveImage.addEventListener('click', async () => {
        await removeDBValue('lockScreenBlob');
        config.hasImage = false; await setDBValue('config', config);
        inputImage.value = ''; pendingImageBlob = null;
        imageStatus.classList.add('hidden'); btnRemoveImage.classList.add('hidden');
        lockScreenImg.src = ''; lockScreenImg.classList.add('hidden');
    });
    btnRemoveRingtone.addEventListener('click', async () => {
        await removeDBValue('ringtoneBlob');
        config.hasRingtone = false; await setDBValue('config', config);
        inputRingtone.value = ''; pendingRingtoneBlob = null;
        ringtoneStatus.classList.add('hidden'); btnRemoveRingtone.classList.add('hidden');
        callAudio.src = '';
    });
    btnRemoveCallerBg.addEventListener('click', async () => {
        await removeDBValue('callerBgBlob');
        config.hasCallerBg = false; await setDBValue('config', config);
        inputCallerBg.value = ''; pendingCallerBgBlob = null;
        callerBgStatus.classList.add('hidden'); btnRemoveCallerBg.classList.add('hidden');
        callerBgImg.src = '';
    });
    
    btnSaveSettings.addEventListener('click', saveSettings);
    btnCloseSettings.addEventListener('click', () => {
        settingsUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        loadSettings();
        pendingVideoBlob = pendingImageBlob = pendingRingtoneBlob = pendingCallerBgBlob = null;
    });
    
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
        
        if (config.hasVideo) {
            iconVideo.classList.remove('hidden');
            iconPhone.classList.add('hidden');
            callerTypeDisplay.textContent = "FaceTime Video";
            callerBgImg.classList.add('hidden');
            callerBgOverlay.classList.add('hidden');
        } else {
            iconPhone.classList.remove('hidden');
            iconVideo.classList.add('hidden');
            callerTypeDisplay.textContent = "Incoming Call";
            if (config.hasCallerBg && callerBgObjectUrl) {
                callerBgImg.classList.remove('hidden');
                callerBgOverlay.classList.remove('hidden');
            } else {
                callerBgImg.classList.add('hidden');
                callerBgOverlay.classList.add('hidden');
            }
        }

        if (config.hasRingtone && callAudio.src) {
            callAudio.play().catch(e => console.error("Audio playback failed", e));
        } else if (navigator.vibrate) {
            vibrationInterval = setInterval(() => {
                navigator.vibrate([1000, 500]);
            }, 1500);
            navigator.vibrate([1000, 500]);
        }
    }
    
    btnAccept.addEventListener('click', async () => {
        stopVibration();
        if (config.hasRingtone) callAudio.pause();
        
        fakeCallUI.classList.add('hidden');
        activeCallUI.classList.remove('hidden');
        
        if (config.hasVideo) {
            try {
                userCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
                userCamera.srcObject = userCameraStream;
                userCamera.classList.remove('hidden');
                userCamera.style.display = 'block';
            } catch (err) {
                console.error("Camera access denied or unavailable", err);
            }
            
            try {
                const videoBlob = await getDBValue('videoBlob');
                if (videoBlob) {
                    if (fakeVideoObjectUrl) URL.revokeObjectURL(fakeVideoObjectUrl);
                    fakeVideoObjectUrl = URL.createObjectURL(videoBlob);
                    fakeCallerVideo.src = fakeVideoObjectUrl;
                    fakeCallerVideo.classList.remove('hidden');
                    fakeCallerVideo.play().catch(e => console.error("Video play failed:", e));
                }
            } catch(e) {
                console.error("Failed to load videoBlob", e);
            }
        } else {
            userCamera.classList.add('hidden');
            fakeCallerVideo.classList.add('hidden');
            if (userCameraStream) {
                userCameraStream.getTracks().forEach(track => track.stop());
                userCameraStream = null;
            }
            
            activeCallUI.style.backgroundImage = config.hasCallerBg && callerBgObjectUrl ? `url(${callerBgObjectUrl})` : 'none';
            activeCallUI.style.backgroundSize = 'cover';
            activeCallUI.style.backgroundPosition = 'center';
            if (config.hasCallerBg) {
                activeCallUI.style.boxShadow = "inset 0 0 0 2000px rgba(0,0,0,0.7)";
            } else {
                activeCallUI.style.boxShadow = "none";
                activeCallUI.style.backgroundColor = "black";
            }
        }

        callSeconds = 0;
        updateCallDuration();
        callTimerInterval = setInterval(() => {
            callSeconds++;
            updateCallDuration();
        }, 1000);
    });
    
    btnDecline.addEventListener('click', endCall);
    btnEndCall.addEventListener('click', endCall);
    
    function endCall() {
        stopVibration();
        if (config.hasRingtone) {
            callAudio.pause();
            callAudio.currentTime = 0;
        }
        clearInterval(callTimerInterval);
        
        fakeCallerVideo.pause();
        fakeCallerVideo.src = '';
        fakeCallerVideo.classList.add('hidden');
        
        userCamera.classList.add('hidden');
        if (userCameraStream) {
            userCameraStream.getTracks().forEach(track => track.stop());
            userCamera.srcObject = null;
            userCameraStream = null;
        }
        
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
    
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(`sw.js`)
                .then(reg => {
                    console.log('SW registered!', reg);
                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New or updated content is available.');
                                // reload to get new content instantly if desired
                            }
                        };
                    };
                })
                .catch(err => console.error('SW Failed!', err));
        }
    }
    
    init();
});
