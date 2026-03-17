// BailMeOut FaceTime Logic with IndexedDB
function initApp() {
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
    const audioCallerNameDisplay = document.getElementById('audio-caller-name');
    const callerTypeDisplay = document.getElementById('caller-type');
    const callDurationDisplay = document.getElementById('call-duration');
    const audioCallDurationDisplay = document.getElementById('audio-call-duration');
    const fakeCallerVideo = document.getElementById('fake-caller-video');
    const userCamera = document.getElementById('user-camera');
    const callerBgImg = document.getElementById('caller-bg-img');
    const callerBgOverlay = document.getElementById('caller-bg-overlay');
    const audioCallerBg = document.getElementById('audio-caller-bg');
    
    // UIs
    const activeAudioUI = document.getElementById('active-audio-ui');
    const iconPhoneIos = document.getElementById('icon-phone-ios');
    const iconVideoIos = document.getElementById('icon-video-ios');
    const iconPhoneAndroid = document.getElementById('icon-phone-android');
    const iconVideoAndroid = document.getElementById('icon-video-android');

    // Buttons
    const btnAcceptIos = document.getElementById('btn-accept-ios');
    const btnDeclineIos = document.getElementById('btn-decline-ios');
    const btnAcceptAndroid = document.getElementById('btn-accept-android');
    const btnDeclineAndroid = document.getElementById('btn-decline-android');
    const btnEndCall = document.getElementById('btn-end-call');
    const btnEndAudioCall = document.getElementById('btn-end-audio-call');
    
    // Theme Containers
    const themeIos = document.getElementById('theme-ios');
    const themeAndroid = document.getElementById('theme-android');
    
    // Settings Elements
    const settingsTrigger = document.getElementById('settings-trigger');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    
    const inputCallerName = document.getElementById('setting-caller-name');
    const inputTheme = document.getElementById('setting-theme');
    const inputDelay = document.getElementById('setting-delay');
    const inputScheduledTime = document.getElementById('setting-scheduled-time');
    const btnClearTime = document.getElementById('btn-clear-time');
    
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

    // Cropper & Toast Elements
    const cropperModal = document.getElementById('cropper-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const btnCropCancel = document.getElementById('btn-crop-cancel');
    const btnCropSave = document.getElementById('btn-crop-save');
    const toastNotification = document.getElementById('toast-notification');
    let cropper = null;
    let currentCropTarget = null; // 'lockScreen' or 'callerBg'
    
    // State
    let taps = 0;
    let tapTimeout = null;
    let longPressTimeout = null;
    let countdownTimeout = null;
    let vibrationInterval = null;
    let callTimerInterval = null;
    let callSeconds = 0;
    let isCallActive = false;
    
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
        theme: "ios", // 'ios' or 'android'
        delaySeconds: 5,
        scheduledTime: "", // "HH:MM"
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
            inputTheme.value = config.theme;
            inputDelay.value = config.delaySeconds;
            inputScheduledTime.value = config.scheduledTime;
            
            callerNameDisplay.textContent = config.callerName;
            activeCallerNameDisplay.textContent = config.callerName;
            audioCallerNameDisplay.textContent = config.callerName;
            
            if (config.hasVideo) {
                videoStatus.classList.remove('hidden');
                btnRemoveVideo.classList.remove('hidden');
                inputVideo.value = ''; // Prevent retaining old input file in standard flow visually
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
                    audioCallerBg.src = callerBgObjectUrl;
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
        config.theme = inputTheme.value || "ios";
        config.delaySeconds = parseInt(inputDelay.value) || 5;
        config.scheduledTime = inputScheduledTime.value || "";
        
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

        if (pendingCallerBgBlob) {
            await setDBValue('callerBgBlob', pendingCallerBgBlob);
            config.hasCallerBg = true;
            pendingCallerBgBlob = null;
        }

        if (pendingRingtoneBlob) {
            await setDBValue('ringtoneBlob', pendingRingtoneBlob);
            config.hasRingtone = true;
            pendingRingtoneBlob = null;
        }
        
        await setDBValue('config', config);
        await loadSettings(); // Ensures buttons pop up immediately without closing settings
        
        btnSaveSettings.textContent = 'Save Settings';
        btnSaveSettings.disabled = false;
        
        showToast();
    }

    function showToast() {
        toastNotification.style.top = '20px';
        toastNotification.style.opacity = '1';
        setTimeout(() => {
            toastNotification.style.top = '-100px';
            toastNotification.style.opacity = '0';
        }, 3000);
    }
    
    btnClearTime.addEventListener('click', () => {
        inputScheduledTime.value = '';
    });

    // File Inputs Listeners (Non-Crapping)
    inputVideo.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { pendingVideoBlob = file; videoStatus.textContent = `Selected: ${file.name}. Click Save!`; videoStatus.classList.remove('hidden'); }
    });

    inputRingtone.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { pendingRingtoneBlob = file; ringtoneStatus.textContent = `Selected: ${file.name}. Click Save!`; ringtoneStatus.classList.remove('hidden'); }
    });

    // File Input Listeners (Cropping Flow)
    function openCropper(file, target) {
        currentCropTarget = target;
        const url = URL.createObjectURL(file);
        imageToCrop.src = url;
        cropperModal.classList.remove('hidden');
        
        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(imageToCrop, {
            aspectRatio: 9 / 16,
            viewMode: 1,
            autoCropArea: 1,
            dragMode: 'move',
            background: false,
            modal: true,
            guides: true,
            center: true,
            highlight: false
        });
    }

    inputImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            openCropper(file, 'lockScreen');
        }
    });

    inputCallerBg.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            openCropper(file, 'callerBg');
        }
    });

    // Cropper Buttons
    btnCropCancel.addEventListener('click', () => {
        if (cropper) cropper.destroy();
        cropperModal.classList.add('hidden');
        imageToCrop.src = '';
        inputImage.value = '';
        inputCallerBg.value = ''; // Reset files
    });

    btnCropSave.addEventListener('click', () => {
        if (!cropper) return;
        
        btnCropSave.textContent = 'Processing...';
        btnCropSave.disabled = true;

        cropper.getCroppedCanvas({
            width: 1080,
            height: 1920,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        }).toBlob((blob) => {
            if (currentCropTarget === 'lockScreen') {
                pendingImageBlob = blob;
                imageStatus.textContent = 'Crop confirmed! Ready to save.';
                imageStatus.classList.remove('hidden');
                imageStatus.classList.remove('text-green-500');
                imageStatus.classList.add('text-yellow-500');
            } else if (currentCropTarget === 'callerBg') {
                pendingCallerBgBlob = blob;
                callerBgStatus.textContent = 'Crop confirmed! Ready to save.';
                callerBgStatus.classList.remove('hidden');
                callerBgStatus.classList.remove('text-green-500');
                callerBgStatus.classList.add('text-yellow-500');
            }

            if (cropper) cropper.destroy();
            cropperModal.classList.add('hidden');
            imageToCrop.src = '';
            
            btnCropSave.textContent = 'Confirm Crop';
            btnCropSave.disabled = false;
            
            // We DO NOT save to DB here to prevent erasing Caller Name inputs.
            // Wait for main 'Save Settings' button.
        }, 'image/jpeg', 0.9);
    });

    // Remove DB Listeners
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
        callerBgImg.src = ''; audioCallerBg.src = '';
    });
    
    btnSaveSettings.addEventListener('click', saveSettings);
    btnCloseSettings.addEventListener('click', () => {
        settingsUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        loadSettings();
        pendingVideoBlob = pendingImageBlob = pendingRingtoneBlob = pendingCallerBgBlob = null;
        
        // Reset yellow statuses
        imageStatus.classList.remove('text-yellow-500');
        imageStatus.classList.add('text-green-500');
        callerBgStatus.classList.remove('text-yellow-500');
        callerBgStatus.classList.add('text-green-500');
    });
    
    function startClock() {
        setInterval(() => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${hours}:${minutes}`;
            clockDisplay.textContent = currentTimeStr;

            // Check Scheduled Call Time (Only Trigger Once Per Cycle)
            if (config.scheduledTime && config.scheduledTime === currentTimeStr && fakeCallUI.classList.contains('hidden') && activeCallUI.classList.contains('hidden') && !isCallActive) {
                config.scheduledTime = ""; // Clear immediately
                setDBValue('config', config);
                inputScheduledTime.value = "";
                isCallActive = true; 
                showIncomingCall();
            }
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
        if (e.cancelable) {
            e.preventDefault();
        }
        cancelLongPress();
        longPressTimeout = setTimeout(() => {
            clockUI.classList.add('hidden');
            settingsUI.classList.remove('hidden');
        }, 3000);
    }
    
    function cancelLongPress() {
        clearTimeout(longPressTimeout);
    }
    
    settingsTrigger.addEventListener('touchstart', startLongPress, { passive: false });
    settingsTrigger.addEventListener('touchend', cancelLongPress);
    settingsTrigger.addEventListener('touchcancel', cancelLongPress);
    settingsTrigger.addEventListener('mousedown', startLongPress);
    settingsTrigger.addEventListener('mouseup', cancelLongPress);
    settingsTrigger.addEventListener('mouseleave', cancelLongPress);
    
    function startFakeCallSequence() {
        if (isCallActive) return;
        isCallActive = true; 
        
        clockDisplay.style.opacity = '0.5';
        setTimeout(() => clockDisplay.style.opacity = '1', 200);
        
        clearTimeout(countdownTimeout);
        countdownTimeout = setTimeout(() => {
            showIncomingCall();
        }, config.delaySeconds * 1000);
    }
    
    function applyTheme() {
        if (config.theme === 'android') {
            themeIos.classList.add('hidden');
            themeAndroid.classList.remove('hidden');
        } else {
            themeAndroid.classList.add('hidden');
            themeIos.classList.remove('hidden');
        }
    }

    function showIncomingCall() {
        clearTimeout(countdownTimeout);
        applyTheme();
        clockUI.classList.add('hidden');
        fakeCallUI.classList.remove('hidden');
        fakeCallUI.classList.add('animate-fade-in');
        
        if (config.hasVideo) {
            iconVideoIos.classList.remove('hidden');
            iconPhoneIos.classList.add('hidden');
            iconVideoAndroid.classList.remove('hidden');
            iconPhoneAndroid.classList.add('hidden');
            callerTypeDisplay.textContent = "FaceTime Video";
        } else {
            iconPhoneIos.classList.remove('hidden');
            iconVideoIos.classList.add('hidden');
            iconPhoneAndroid.classList.remove('hidden');
            iconVideoAndroid.classList.add('hidden');
            callerTypeDisplay.textContent = "Incoming Call";
        }

        // Always show Caller BG on incoming screen (unless absent)
        if (config.hasCallerBg && callerBgObjectUrl) {
            callerBgImg.classList.remove('hidden');
            callerBgOverlay.classList.remove('hidden');
        } else {
            callerBgImg.classList.add('hidden');
            callerBgOverlay.classList.add('hidden');
        }

        if (config.hasRingtone && callAudio.src) {
            callAudio.play().catch(e => console.error("Audio playback failed", e));
        }
        
        if (navigator.vibrate) {
            vibrationInterval = setInterval(() => {
                navigator.vibrate([1000, 500, 1000, 500]);
            }, 3000);
            navigator.vibrate([1000, 500, 1000, 500]);
        }
    }
    
    async function acceptCall() {
        stopVibration();
        if (config.hasRingtone) callAudio.pause();
        
        fakeCallUI.classList.add('hidden');
        
        if (config.hasVideo) {
            activeCallUI.classList.remove('hidden');
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

            activeCallUI.style.backgroundImage = 'none';
            activeCallUI.style.backgroundColor = "black";
        } else {
            // Audio-call opens new Active Audio UI screen
            activeAudioUI.classList.remove('hidden');

            if (config.hasCallerBg && callerBgObjectUrl) {
                audioCallerBg.classList.remove('hidden');
            } else {
                audioCallerBg.classList.add('hidden');
            }
        }

        callSeconds = 0;
        updateCallDuration();
        clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
            callSeconds++;
            updateCallDuration();
        }, 1000);
    }
    
    // Bind Action Buttons strictly using .onclick
    btnAcceptIos.onclick = acceptCall;
    btnAcceptAndroid.onclick = acceptCall;
    btnDeclineIos.onclick = endCall;
    btnDeclineAndroid.onclick = endCall;
    btnEndCall.onclick = endCall;
    btnEndAudioCall.onclick = endCall;
    
    function endCall() {
        stopVibration();
        if (config.hasRingtone) {
            callAudio.pause();
            callAudio.currentTime = 0;
        }
        clearInterval(callTimerInterval);
        clearTimeout(countdownTimeout);
        
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
        activeAudioUI.classList.add('hidden');
        clockUI.classList.remove('hidden');
        
        callSeconds = 0;
        isCallActive = false;
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
        audioCallDurationDisplay.textContent = `${m}:${s}`;
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
                            }
                        };
                    };
                })
                .catch(err => console.error('SW Failed!', err));
        }
    }
    
    init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
