// MBE Pig Points - Audio System

// Audio system initialization for autoplay bypass
function initializeAudioSystem() {
    console.log('🔊 Initializing audio system for autoplay bypass...');
    
    // Try to create AudioContext (Web Audio API)
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        console.log('✅ AudioContext created successfully');
    } catch (e) {
        console.log('❌ AudioContext not supported:', e);
    }
    
    // Set up audio unlock listeners
    setupAudioUnlockListeners();
    
    // Preload DANGER ZONE audio
    preloadDangerZoneAudio();
}

function preloadDangerZoneAudio() {
    console.log('📥 Preloading DANGER ZONE audio...');
    
    // Create and preload audio element
    preloadedAudio = new Audio();
    preloadedAudio.src = 'danger-zone.mp3';
    preloadedAudio.preload = 'auto';
    preloadedAudio.muted = true; // Start muted to allow autoplay
    preloadedAudio.loop = false;
    
    // Try to load the audio
    preloadedAudio.load();
    
    preloadedAudio.addEventListener('canplaythrough', () => {
        console.log('✅ DANGER ZONE audio preloaded successfully');
    });
    
    preloadedAudio.addEventListener('error', (e) => {
        console.error('❌ Error preloading DANGER ZONE audio:', e);
    });
}

function setupAudioUnlockListeners() {
    console.log('🔓 Setting up audio unlock listeners...');
    
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'];
    
    function unlockAudio() {
        if (audioUnlocked) return;
        
        console.log('🔓 Attempting to unlock audio...');
        
        // Try to play a silent audio to unlock
        const silentAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU+ltryxnkpBSl+zPLaizsIGGS57OOYTQwKTKXh8bllHgg2jdXzzn0vBSF1xe/eizEIHWq+8+OWT");
        silentAudio.play().then(() => {
            silentAudio.pause();
            audioUnlocked = true;
            console.log('✅ Audio unlocked successfully!');
            
            // Remove listeners once unlocked
            unlockEvents.forEach(event => {
                document.removeEventListener(event, unlockAudio);
            });
        }).catch(() => {
            console.log('🔇 Audio still locked');
        });
        
        // Also try with AudioContext
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('✅ AudioContext resumed');
            });
        }
    }
    
    // Add listeners for all unlock events
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, { once: true, passive: true });
    });
}

function playDangerZoneAudio() {
    console.log('🔊 Attempting to play DANGER ZONE audio...');
    console.log('🔊 Audio unlocked status:', audioUnlocked);
    
    // Prevent multiple simultaneous playback
    if (audioPlayingSuccessfully) {
        console.log('🔊 Audio already playing, skipping...');
        return;
    }
    
    // Strategy 1: Try preloaded audio first (best chance for autoplay)
    if (preloadedAudio && audioUnlocked) {
        console.log('🔊 Strategy 1: Using preloaded audio (unlocked)');
        preloadedAudio.muted = false; // Unmute for actual playback
        preloadedAudio.currentTime = 0; // Reset to start
        
        preloadedAudio.play().then(() => {
            console.log('✅ SUCCESS! Preloaded audio playing');
            audioPlayingSuccessfully = true;
            
            // Reset flag when audio ends
            preloadedAudio.onended = () => {
                audioPlayingSuccessfully = false;
                console.log('🔊 Preloaded audio finished');
            };
        }).catch((error) => {
            console.log('❌ Preloaded audio failed:', error);
            tryAlternativeAudioMethods();
        });
    } else {
        console.log('🔊 Preloaded audio not available or audio locked, trying alternatives...');
        tryAlternativeAudioMethods();
    }
}

function tryAlternativeAudioMethods() {
    console.log('🔊 Trying alternative audio methods...');
    
    // Check if audio is already playing successfully
    if (audioPlayingSuccessfully) {
        console.log('🔊 Audio already playing successfully, stopping alternatives');
        return;
    }
    
    // Try multiple methods in parallel for best chance of success
    const audioFile = 'danger-zone.mp3';
    
    // Method 1: Standard Audio API
    tryStandardAudio(audioFile);
    
    // Method 2: Web Audio API (if available)
    setTimeout(() => tryWebAudioAPI(audioFile), 100);
    
    // Method 3: Force play with user interaction simulation (last resort)
    setTimeout(() => tryForcePlay(audioFile), 200);
    
    // Method 4: Show permission prompt if all else fails
    setTimeout(() => {
        if (!audioPlayingSuccessfully) {
            console.log('🔇 All audio methods failed, showing permission prompt');
            showAudioPermissionPrompt();
        }
    }, 1000);
    
    function tryStandardAudio(audioFile) {
        if (audioPlayingSuccessfully) return; // Stop if already playing
        
        const audio = new Audio();
        audio.src = audioFile;
        audio.volume = 0.8;
        
        audio.play().then(() => {
            if (!audioPlayingSuccessfully) {
                console.log(`✅ SUCCESS! Standard Audio API playing: ${audioFile}`);
                audioPlayingSuccessfully = true;
                
                // Reset flag when audio ends
                audio.onended = () => {
                    audioPlayingSuccessfully = false;
                    console.log('🔊 Standard audio finished');
                };
            }
        }).catch((error) => {
            console.log(`❌ Standard Audio API failed: ${error.message}`);
        });
    }
    
    function tryWebAudioAPI(audioFile) {
        if (audioPlayingSuccessfully) return; // Stop if already playing
        
        if (!audioContext) {
            console.log('🔇 Web Audio API not available');
            return;
        }
        
        fetch(audioFile)
            .then(response => response.arrayBuffer())
            .then(data => audioContext.decodeAudioData(data))
            .then(buffer => {
                if (!audioPlayingSuccessfully) {
                    const source = audioContext.createBufferSource();
                    const gainNode = audioContext.createGain();
                    
                    source.buffer = buffer;
                    gainNode.gain.value = 0.8;
                    
                    source.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    source.start(0);
                    console.log(`✅ SUCCESS! Web Audio API playing: ${audioFile}`);
                    audioPlayingSuccessfully = true;
                    
                    // Reset flag when audio ends
                    source.onended = () => {
                        audioPlayingSuccessfully = false;
                        console.log('🔊 Web Audio API finished');
                    };
                }
            })
            .catch((error) => {
                console.log(`❌ Web Audio API failed: ${error.message}`);
            });
    }
    
    function tryForcePlay(audioFile) {
        if (audioPlayingSuccessfully) return; // Stop if already playing
        
        // Only create one audio instance instead of 3
        const audio = new Audio(audioFile);
        audio.volume = 0.8;
        
        // Force play attempt
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (!audioPlayingSuccessfully) {
                    console.log(`✅ SUCCESS! Force play worked: ${audioFile}`);
                    audioPlayingSuccessfully = true;
                    
                    // Reset flag when audio ends
                    audio.onended = () => {
                        audioPlayingSuccessfully = false;
                        console.log('🔊 Force play audio finished');
                    };
                }
            }).catch((error) => {
                console.log(`❌ Force play failed: ${error.message}`);
            });
        }
    }
}

// Show a prompt to enable audio if autoplay is blocked
function showAudioPermissionPrompt() {
    // Only show once per session
    if (window.audioPermissionShown) return;
    window.audioPermissionShown = true;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align: center; max-width: 400px;">
            <h2 style="color: #8B0000;">🔊 AUDIO BLOCKED</h2>
            <p>Your browser blocked the DANGER ZONE audio!</p>
            <p>Click the button below to enable sound effects:</p>
            <button onclick="enableDangerZoneAudio()" style="
                background: linear-gradient(45deg, #8B0000, #A52A2A);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                cursor: pointer;
                margin: 10px;
            ">
                🔊 ENABLE DANGER ZONE AUDIO 🔊
            </button>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: #666;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">
                Skip Audio
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Function to enable audio after user interaction
function enableDangerZoneAudio() {
    console.log('🔊 User clicked to enable audio - attempting to play...');
    
    // Remove the prompt
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
    
    // Try to play the audio now that we have user interaction
    playDangerZoneAudio();
}

// Make audio functions globally accessible
window.initializeAudioSystem = initializeAudioSystem;
window.preloadDangerZoneAudio = preloadDangerZoneAudio;
window.setupAudioUnlockListeners = setupAudioUnlockListeners;
window.playDangerZoneAudio = playDangerZoneAudio;
window.tryAlternativeAudioMethods = tryAlternativeAudioMethods;
window.showAudioPermissionPrompt = showAudioPermissionPrompt;
window.enableDangerZoneAudio = enableDangerZoneAudio;
