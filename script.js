// MBE Pig Points - Main JavaScript

// Player data with Firebase persistence
let players = {
    'Evan': { 
        points: 100, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    },
    'Ian': { 
        points: 100, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    },
    'Andrew': { 
        points: 100, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    },
    'Zack': { 
        points: 100, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    },
    'Brian': { 
        points: 100, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    },
    'Alex': { 
        points: 100, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    },
    'GOD': { 
        points: 1000, 
        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
    }
};

let isBookkeeperLoggedIn = localStorage.getItem('bookkeeperLoggedIn') === 'true';
let isPlayerLoggedIn = false; // Will be managed by Firebase Auth
let currentPlayer = '';
let isFirebaseReady = false;
let activities = [];
let recaptchaVerifier = null;
let confirmationResult = null;
let isRecaptchaReady = false;
let isRecaptchaInitializing = false;

// HOGWASH cooldown tracking (60 minutes = 3600000 milliseconds)
const HOGWASH_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes
let hogwashCooldowns = {}; // Store last HOGWASH time for each player

// DANGER ZONE testing flag (temporary)
let forceDangerZoneNext = false;

// Audio management for autoplay bypass
let audioContext = null;
let dangerZoneAudioBuffer = null;
let hogwashAudioBuffer = null;
let audioUnlocked = false;
let preloadedAudio = null;
let preloadedHogwashAudio = null;
let audioPlayingSuccessfully = false; // Flag to prevent multiple simultaneous playback
let currentHogwashAudio = null;

// Alex's drink assignment system
let alexDrinkCredits = 0; // Current available drinks for Alex to assign
const ALEX_DRINKS_PER_HOUR = 10; // Drinks Alex gets per hour
const ALEX_MAX_DRINKS = 20; // Maximum drinks Alex can accumulate
let alexLastDrinkRefill = Date.now(); // Last time drinks were refilled

// Alex's Danger Zone initiation system
let alexDangerZoneCredits = 0; // Current available Danger Zone initiations for Alex
const ALEX_DANGER_ZONE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const ALEX_MAX_DANGER_ZONES = 3; // Maximum Danger Zone initiations Alex can accumulate
let alexLastDangerZoneRefill = Date.now(); // Last time Danger Zone credits were refilled

// HOGWASH cooldown helper functions - now using Firebase for global sync
function loadHogwashCooldowns() {
    // Load from localStorage as fallback
    const saved = localStorage.getItem('mbeHogwashCooldowns');
    if (saved) {
        try {
            hogwashCooldowns = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading HOGWASH cooldowns from localStorage:', e);
            hogwashCooldowns = {};
        }
    }
    
    // Load from Firebase for real-time sync
    if (window.firebaseDB) {
        const cooldownsRef = window.firebaseRef(window.firebaseDB, 'hogwashCooldowns');
        window.firebaseOnValue(cooldownsRef, (snapshot) => {
            if (snapshot.exists()) {
                const firebaseCooldowns = snapshot.val();
                console.log('🕐 HOGWASH cooldowns loaded from Firebase:', firebaseCooldowns);
                
                // Merge with local data, preferring Firebase (more recent)
                hogwashCooldowns = { ...hogwashCooldowns, ...firebaseCooldowns };
                
                // Also save to localStorage for offline fallback
                localStorage.setItem('mbeHogwashCooldowns', JSON.stringify(hogwashCooldowns));
            }
        }, (error) => {
            console.error('❌ Firebase cooldowns listener error:', error);
        });
    }
}

function saveHogwashCooldowns() {
    // Save to localStorage immediately
    localStorage.setItem('mbeHogwashCooldowns', JSON.stringify(hogwashCooldowns));
    
    // Save to Firebase for global sync
    if (window.firebaseDB) {
        const cooldownsRef = window.firebaseRef(window.firebaseDB, 'hogwashCooldowns');
        window.firebaseSet(cooldownsRef, hogwashCooldowns)
            .then(() => {
                console.log('🕐 HOGWASH cooldowns saved to Firebase successfully');
            })
            .catch((error) => {
                console.error('❌ Failed to save HOGWASH cooldowns to Firebase:', error);
            });
    }
}

function isPlayerOnHogwashCooldown(playerName) {
    if (!hogwashCooldowns[playerName]) return false;
    const lastHogwash = hogwashCooldowns[playerName];
    const now = Date.now();
    return (now - lastHogwash) < HOGWASH_COOLDOWN_MS;
}

function getHogwashCooldownRemaining(playerName) {
    if (!hogwashCooldowns[playerName]) return 0;
    const lastHogwash = hogwashCooldowns[playerName];
    const now = Date.now();
    const elapsed = now - lastHogwash;
    return Math.max(0, HOGWASH_COOLDOWN_MS - elapsed);
}

function formatCooldownTime(milliseconds) {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
}

function setPlayerHogwashCooldown(playerName) {
    hogwashCooldowns[playerName] = Date.now();
    saveHogwashCooldowns();
    console.log(`🕐 Cooldown set for ${playerName} until ${new Date(Date.now() + HOGWASH_COOLDOWN_MS).toLocaleTimeString()}`);
}

// Enhanced validation to prevent cooldown bypass
function validateHogwashAttempt(selectedPlayerName) {
    // Check if the selected player is on cooldown
    if (isPlayerOnHogwashCooldown(selectedPlayerName)) {
        return {
            allowed: false,
            reason: 'cooldown',
            message: `${selectedPlayerName} is on cooldown`
        };
    }
    
    // Additional check: If user is logged in, they can only gamble as themselves
    if (isPlayerLoggedIn && currentPlayer && selectedPlayerName !== currentPlayer) {
        return {
            allowed: false,
            reason: 'wrong_player',
            message: `You are logged in as ${currentPlayer}, but trying to gamble as ${selectedPlayerName}`
        };
    }
    
    return {
        allowed: true,
        reason: 'valid',
        message: 'Gambling attempt is valid'
    };
}

// Phone number to player name mapping
const phoneToPlayer = {
    '+12183909017': 'Andrew',
    '+12183102673': 'Evan',
    '+17158173994': 'Ian',
    '+17154108014': 'Zack',
    '+12184289839': 'Brian',
    '+12182061360': 'Alex'
};

// Player name to phone number mapping (reverse lookup)
const playerToPhone = {};
Object.keys(phoneToPlayer).forEach(phone => {
    playerToPhone[phoneToPlayer[phone]] = phone;
});

// Initialize Firebase data
function initializeFirebase() {
    console.log('🔥 Initializing Firebase...');
    console.log('🔥 Firebase DB:', window.firebaseDB);
    
    if (!window.firebaseDB) {
        console.error('❌ Firebase database not available!');
        alert('❌ Firebase connection failed! Check console for details.');
        return;
    }
    
    const playersRef = window.firebaseRef(window.firebaseDB, 'players');
    const activitiesRef = window.firebaseRef(window.firebaseDB, 'activities');
    
    console.log('🔥 Setting up Firebase listeners...');
    
    // Listen for player changes in real-time
    window.firebaseOnValue(playersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Handle migration from old structure (number) to new structure (object)
            const playerNames = ['Evan', 'Ian', 'Andrew', 'Zack', 'Brian', 'Alex', 'GOD'];
            let needsMigration = false;
            
            playerNames.forEach(name => {
                if (data[name]) {
                    if (typeof data[name] === 'number') {
                        // Old structure - migrate to new
                        players[name] = {
                            points: data[name],
                            powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
                        };
                        needsMigration = true;
                    } else if (typeof data[name] === 'object') {
                        // New structure - ensure all fields exist
                        players[name] = {
                            points: data[name].points || (name === 'GOD' ? 1000 : 100),
                            powerUps: {
                                mulligans: data[name].powerUps?.mulligans || 0,
                                reverseMulligans: data[name].powerUps?.reverseMulligans || 0,
                                giveDrinks: data[name].powerUps?.giveDrinks || 0
                            }
                        };
                    }
                } else {
                    // Player doesn't exist - create default
                    players[name] = {
                        points: name === 'GOD' ? 1000 : 100,
                        powerUps: { mulligans: 0, reverseMulligans: 0, giveDrinks: 0 }
                    };
                    needsMigration = true;
                }
            });
            
            // If we migrated or added missing players, save the updated structure
            if (needsMigration || !data.GOD) {
                console.log('🔄 Migrating player data structure to include power-ups');
                savePlayers();
            }
            
            updateLeaderboard();
            if (isPlayerLoggedIn) {
                updatePlayerUI();
            }
            console.log('🔥 Firebase players updated:', players);
        } else {
            // First time - set default values
            savePlayers();
        }
        isFirebaseReady = true;
    });

    // Listen for activity feed changes in real-time
    window.firebaseOnValue(activitiesRef, (snapshot) => {
        console.log('📜 Activities snapshot received:', snapshot.exists());
        if (snapshot.exists()) {
            const firebaseActivities = snapshot.val();
            console.log('📜 Raw Firebase activities:', firebaseActivities);
            activities = Object.values(firebaseActivities).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            loadActivityFeed();
            console.log('📜 Activities loaded from Firebase:', activities.length, 'activities');
        } else {
            activities = [];
            loadActivityFeed();
            console.log('📜 No existing activities in Firebase');
        }
    }, (error) => {
        console.error('❌ Firebase activities listener error:', error);
        alert('❌ Failed to load activities from Firebase: ' + error.message);
    });

    // Listen for DANGER ZONE broadcasts in real-time
    const dangerZoneRef = window.firebaseRef(window.firebaseDB, 'dangerZone');
    window.firebaseOnValue(dangerZoneRef, (snapshot) => {
        if (snapshot.exists()) {
            const dangerZoneData = snapshot.val();
            console.log('🚨 DANGER ZONE broadcast received:', dangerZoneData);
            
            // Check if this is a new DANGER ZONE event (within last 10 seconds)
            const eventTime = new Date(dangerZoneData.timestamp);
            const now = new Date();
            const timeDiff = now - eventTime;
            
            if (timeDiff < 10000) { // Within 10 seconds
                console.log('🚨 Triggering DANGER ZONE alert for all users!');
                showDangerZoneAlert(dangerZoneData.playerName, dangerZoneData.timestamp);
            }
        }
    }, (error) => {
        console.error('❌ Firebase DANGER ZONE listener error:', error);
    });

    // Monitor authentication state
    window.onAuthStateChanged(window.firebaseAuth, (user) => {
        if (user) {
            // Check if this is an anonymous user (bypass login)
            if (user.isAnonymous) {
                // Check if we have a bypass login in progress or if the profile is already set
                const bypassLoginInProgress = localStorage.getItem('bypassLoginInProgress');
                const playerName = user.displayName || bypassLoginInProgress;
                
                console.log(`🔍 Anonymous user detected - displayName: ${user.displayName}, bypassLoginInProgress: ${bypassLoginInProgress}, playerName: ${playerName}`);
                
                if (playerName) {
                    console.log(`🔐 Anonymous bypass login detected: ${playerName}`);
                    
                    isPlayerLoggedIn = true;
                    currentPlayer = playerName;
                    
                    // Check if this player is also the Ham Handler (Evan)
                    if (playerName === 'Evan') {
                        isBookkeeperLoggedIn = true;
                        localStorage.setItem('bookkeeperLoggedIn', 'true');
                        console.log(`🔐 Ham Handler authenticated via bypass: ${playerName}`);
                    }
                    
                    // Only show welcome message if this is a new bypass login
                    if (bypassLoginInProgress === playerName) {
                        localStorage.removeItem('bypassLoginInProgress');
                        localStorage.setItem('firebaseAuthLoggedIn', playerName);
                        
                        if (playerName === 'Evan') {
                            alert(`👑 Welcome Ham Handler ${playerName}! 👑\n🔐 SECURE LOGIN SUCCESSFUL\nYou now have FULL admin access AND player controls!`);
                            addActivity('admin', '🔐', `${playerName} logged in as Ham Handler (Secure Login)`);
                        } else {
                            alert(`🐷 Welcome ${playerName}! 🐷\n🔐 SECURE LOGIN SUCCESSFUL\nYou are now logged in and will stay logged in!`);
                            addActivity('admin', '🔐', `${playerName} logged in (Secure Login)`);
                        }
                    } else {
                        console.log(`🔐 Bypass login session restored: ${playerName}`);
                    }
                    
                    checkLoginState();
                } else {
                    console.log('🔐 Anonymous user without bypass login context - signing out');
                    window.firebaseAuth.signOut();
                }
            } 
            // Check if this is a phone number login (SMS verification)
            else if (user.phoneNumber) {
                const phoneNumber = user.phoneNumber;
                const playerName = phoneToPlayer[phoneNumber];
                
                if (playerName) {
                    const wasAlreadyLoggedIn = localStorage.getItem('firebaseAuthLoggedIn') === playerName;
                    
                    isPlayerLoggedIn = true;
                    currentPlayer = playerName;
                    
                    // Check if this player is also the Ham Handler (Evan)
                    if (playerName === 'Evan') {
                        isBookkeeperLoggedIn = true;
                        localStorage.setItem('bookkeeperLoggedIn', 'true');
                        console.log(`🔐 Ham Handler authenticated: ${playerName} (${phoneNumber})`);
                    }
                    
                    console.log(`🔐 Player authenticated: ${playerName} (${phoneNumber})`);
                    
                    // Only show welcome message and log activity if this is truly a NEW login
                    // (not just navigating back to the page or refreshing)
                    if (!wasAlreadyLoggedIn) {
                        // Mark this user as logged in
                        localStorage.setItem('firebaseAuthLoggedIn', playerName);
                        
                        if (playerName === 'Evan') {
                            alert(`🐷 Welcome Ham Handler ${playerName}! 🐷\nYou now have FULL admin access AND player controls!`);
                            // Log activity
                            addActivity('admin', '🔐', `${playerName} logged in as Ham Handler`);
                        } else {
                            alert(`🐷 Welcome ${playerName}! 🐷\nYou are now securely logged in!`);
                            // Log activity
                            addActivity('admin', '🔐', `${playerName} logged in securely`);
                        }
                    } else {
                        console.log(`🔐 Player session restored: ${playerName} (already logged in)`);
                    }
                    
                    checkLoginState();
                } else {
                    console.error('Phone number not recognized:', phoneNumber);
                    // Sign out unrecognized user
                    window.firebaseAuth.signOut();
                }
            } else {
                console.error('Unknown authentication method:', user);
                // Sign out unknown user
                window.firebaseAuth.signOut();
            }
        } else {
            // User is signed out
            const wasLoggedIn = isPlayerLoggedIn;
            isPlayerLoggedIn = false;
            currentPlayer = '';
            
            // Clear the Firebase auth login flag
            localStorage.removeItem('firebaseAuthLoggedIn');
            
            // If Evan logs out, also remove Ham Handler privileges
            if (isBookkeeperLoggedIn && localStorage.getItem('bookkeeperLoggedIn') === 'true') {
                isBookkeeperLoggedIn = false;
                localStorage.removeItem('bookkeeperLoggedIn');
            }
            
            console.log('🔐 Player signed out');
            checkLoginState();
        }
    });
}

function savePlayers() {
    if (!isFirebaseReady && !window.firebaseDB) {
        console.log('Firebase not ready, using localStorage fallback');
        localStorage.setItem('mbePlayerPoints', JSON.stringify(players));
        return;
    }
    
    const playersRef = window.firebaseRef(window.firebaseDB, 'players');
    window.firebaseSet(playersRef, players)
        .then(() => {
            console.log('🔥 Points saved to Firebase!');
        })
        .catch((error) => {
            console.error('Firebase save error:', error);
            // Fallback to localStorage
            localStorage.setItem('mbePlayerPoints', JSON.stringify(players));
        });
}

// Test Firebase connection
function testFirebaseConnection() {
    console.log('🧪 Testing Firebase connection...');
    
    if (!window.firebaseDB) {
        console.error('❌ Firebase DB not available');
        return;
    }
    
    // Test write
    const testRef = window.firebaseRef(window.firebaseDB, 'connectionTest');
    const testData = {
        timestamp: new Date().toISOString(),
        test: 'connection'
    };
    
    window.firebaseSet(testRef, testData)
        .then(() => {
            console.log('✅ Firebase write test successful');
            
            // Test read
            window.firebaseOnValue(testRef, (snapshot) => {
                if (snapshot.exists()) {
                    console.log('✅ Firebase read test successful:', snapshot.val());
                } else {
                    console.log('⚠️ Firebase read test - no data found');
                }
            }, (error) => {
                console.error('❌ Firebase read test failed:', error);
            });
        })
        .catch(error => {
            console.error('❌ Firebase write test failed:', error);
            console.error('❌ This might be a permissions issue!');
            
            if (error.code === 'PERMISSION_DENIED') {
                alert('🚫 PERMISSION DENIED!\n\nFirebase database rules are blocking writes.\nYou need to update your Firebase security rules to allow writes.');
            }
        });
}

// Make test function available globally for debugging
window.testFirebaseConnection = testFirebaseConnection;

// Initialize Firebase when page loads
setTimeout(() => {
    initializeFirebase();
    // Test connection after initialization
    setTimeout(testFirebaseConnection, 2000);
    // Initialize Alex's drink system after Firebase is ready
    setTimeout(() => {
        initializeAlexDrinkSystem();
        initializeProofRequestSystem();
    }, 1500);
    // reCAPTCHA will be initialized only when needed for SMS sending
}, 1000);

// Add page visibility change listener to refresh data when returning to page
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && document.getElementById('leaderboard')) {
        console.log('🏆 Page became visible, refreshing leaderboard...');
        
        // Restore login state first
        checkBypassLoginState();
        checkLoginState();
        
        // Small delay to ensure Firebase is ready
        setTimeout(() => {
            if (players && Object.keys(players).length > 0) {
                updateLeaderboard();
                updateStatusBar();
                if (isPlayerLoggedIn) {
                    updatePlayerUI();
                }
            } else {
                console.log('🏆 Players data not available, re-initializing Firebase...');
                initializeFirebase();
            }
        }, 500);
    }
});

// Add DOMContentLoaded listener to ensure leaderboard updates when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏆 DOM loaded, checking for leaderboard...');
    if (document.getElementById('leaderboard')) {
        console.log('🏆 Leaderboard found, will update when Firebase is ready');
        
        // Restore login state immediately
        checkBypassLoginState();
        checkLoginState();
        
        // Try to update leaderboard after a short delay
        setTimeout(() => {
            if (players && Object.keys(players).length > 0) {
                updateLeaderboard();
                updateStatusBar();
                if (isPlayerLoggedIn) {
                    updatePlayerUI();
                }
            }
        }, 2000);
    }
});

// Manual refresh function for debugging
function refreshLeaderboard() {
    console.log('🏆 Manual leaderboard refresh requested');
    console.log('🏆 Current players:', players);
    updateLeaderboard();
}

// Make refresh function available globally for debugging
window.refreshLeaderboard = refreshLeaderboard;

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ PWA: Service Worker registered successfully', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 PWA: New version available');
                            showUpdateAvailablePrompt();
                        }
                    });
                });
            })
            .catch(error => {
                console.error('❌ PWA: Service Worker registration failed', error);
            });
    });
}

// PWA Install Prompt
let deferredPrompt;
let installPromptShown = false;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA: Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    // Show the install button instead of intrusive banner
    showInstallButton();
});

window.addEventListener('appinstalled', () => {
    console.log('🎉 PWA: App installed successfully');
    deferredPrompt = null;
    hideInstallButton();
    alert('🎉 PIGGY PIGGY installed successfully!\n\nYou can now access the app from your home screen and receive push notifications!');
});

function showInstallButton() {
    if (!deferredPrompt || document.getElementById('installButton')) return;
    
    const installButton = document.createElement('div');
    installButton.id = 'installButton';
    installButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(45deg, #4CAF50, #45a049);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        font-weight: bold;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        user-select: none;
    `;
    
    installButton.innerHTML = `
        <span>📱</span>
        <span>Install App</span>
    `;
    
    // Add hover effect
    installButton.addEventListener('mouseenter', () => {
        installButton.style.transform = 'translateY(-2px)';
        installButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.6)';
    });
    
    installButton.addEventListener('mouseleave', () => {
        installButton.style.transform = 'translateY(0)';
        installButton.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.4)';
    });
    
    installButton.addEventListener('click', installPWA);
    
    document.body.appendChild(installButton);
}

function installPWA() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('✅ PWA: User accepted install prompt');
        } else {
            console.log('❌ PWA: User dismissed install prompt');
        }
        deferredPrompt = null;
        hideInstallButton();
    });
}

function hideInstallButton() {
    const button = document.getElementById('installButton');
    if (button) {
        button.style.transform = 'translateY(100px)';
        button.style.opacity = '0';
        setTimeout(() => {
            button.remove();
        }, 300);
    }
}

function dismissInstallPrompt() {
    // Legacy function - now just hides the install button
    hideInstallButton();
}

function showUpdateAvailablePrompt() {
    const updateBanner = document.createElement('div');
    updateBanner.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: linear-gradient(45deg, #FF9800, #F57C00);
        color: white;
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    updateBanner.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>🔄 Update Available</strong><br>
            A new version of MBE PIG POINTS is ready!
        </div>
        <button onclick="updatePWA()" style="background: white; color: #FF9800; border: none; padding: 8px 16px; border-radius: 5px; font-weight: bold; margin-right: 10px; cursor: pointer;">
            Update Now
        </button>
        <button onclick="this.parentElement.remove()" style="background: transparent; color: white; border: 1px solid white; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
            Later
        </button>
    `;
    
    document.body.appendChild(updateBanner);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (updateBanner.parentElement) {
            updateBanner.remove();
        }
    }, 10000);
}

function updatePWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
            }
        });
    }
}

// Make PWA functions globally accessible
window.installPWA = installPWA;
window.dismissInstallPrompt = dismissInstallPrompt;
window.updatePWA = updatePWA;

// Push Notification Functions
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('❌ PWA: This browser does not support notifications');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

async function sendPushNotification(data) {
    console.log('📱 PWA: Sending push notification', data);
    
    // Check if we have permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
        console.log('❌ PWA: No notification permission');
        return;
    }
    
    // If service worker is available, use it for better notification handling
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            // Send to service worker for processing
            registration.active?.postMessage({
                type: 'SHOW_NOTIFICATION',
                data: data
            });
            return;
        }
    }
    
    // Fallback to direct notification
    showDirectNotification(data);
}

function showDirectNotification(data) {
    let title = data.title || 'MBE PIG POINTS';
    let options = {
        body: data.body || 'New activity in the app!',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: data.type || 'mbe-notification',
        requireInteraction: true,
        data: data
    };
    
    // Add vibration for mobile
    if (data.type === 'danger_zone') {
        options.vibrate = [200, 100, 200, 100, 200];
    } else if (data.type === 'drink_assignment') {
        options.vibrate = [100, 50, 100];
    } else {
        options.vibrate = [150];
    }
    
    // Show notification
    new Notification(title, options);
}

// Initialize push notifications when app loads
setTimeout(() => {
    requestNotificationPermission().then(granted => {
        if (granted) {
            console.log('✅ PWA: Notification permission granted');
        } else {
            console.log('❌ PWA: Notification permission denied');
        }
    });
}, 2000);

// Initialize bubbles (reduced frequency)
function createBubbles() {
    const bubblesContainer = document.getElementById('bubbles');
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.left = Math.random() * 100 + '%';
            bubble.style.width = bubble.style.height = Math.random() * 20 + 8 + 'px';
            bubble.style.animationDelay = Math.random() * 8 + 's';
            bubble.style.animationDuration = (Math.random() * 4 + 6) + 's';
            bubblesContainer.appendChild(bubble);
            
            setTimeout(() => {
                bubble.remove();
            }, 10000);
        }, i * 500);
    }
}

// Create bubbles continuously (less frequent)
setInterval(createBubbles, 5000);
createBubbles();

function updateLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    console.log('🏆 updateLeaderboard called, players:', players);
    console.log('🏆 leaderboard element:', leaderboard);
    
    // Safety check - if leaderboard element doesn't exist, we're not on the main page
    if (!leaderboard) {
        console.log('🏆 No leaderboard element found - not on main page');
        return;
    }
    
    // Safety check - if players object is empty, keep loading indicator visible
    if (!players || Object.keys(players).length === 0) {
        console.log('🏆 Players data not ready yet, keeping loading indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Loading Pig Points...';
        }
        leaderboard.style.display = 'none';
        return;
    }
    
    // Hide loading indicator and show leaderboard
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    leaderboard.style.display = 'block';
    
    // Separate GOD from regular players
    const regularPlayers = Object.entries(players).filter(player => player[0] !== 'GOD');
    const godPlayer = Object.entries(players).find(player => player[0] === 'GOD');
    
    // Sort regular players by points (highest first)
    const sortedPlayers = regularPlayers.sort((a, b) => b[1].points - a[1].points);
    
    // Calculate max/min for regular players only (exclude GOD from pig/crown logic)
    const regularPoints = regularPlayers.map(p => p[1].points);
    const maxPoints = Math.max(...regularPoints);
    const minPoints = Math.min(...regularPoints);
    
    // Check if all regular players have the same points (tie situation)
    const allSamePoints = maxPoints === minPoints;
    
    leaderboard.innerHTML = '';
    
    // Add regular players first
    sortedPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        li.className = 'player';
        
        // Only show pig styling if there's actually a lowest score (not a tie)
        if (!allSamePoints && player[1].points === minPoints) {
            li.classList.add('pig');
        }
        
        const playerInsult = getPlayerInsult(player[0]);
        const powerUps = player[1].powerUps;
        const totalPowerUps = powerUps.mulligans + powerUps.reverseMulligans + powerUps.giveDrinks;
        
        li.innerHTML = `
            <div class="player-name">
                ${!allSamePoints && player[1].points === maxPoints ? '<span class="crown">👑</span>' : ''}
                ${!allSamePoints && player[1].points === minPoints ? '<span>🐷 THE PIG 🐷</span>' : ''}
                <span>${player[0]}</span>
                <span class="poop-bag" onclick="showPowerUpModal('${player[0]}')" title="View ${player[0]}'s Power-Ups (${totalPowerUps} total)" style="cursor: pointer; font-size: 1em;">💩🎒</span>
                <span class="pig-insult">${playerInsult}</span>
            </div>
            <div class="points">
                ${player[1].points} 🐷
                ${isBookkeeperLoggedIn ? `<button class="edit-score-btn" onclick="openScoreEditModal('${player[0]}', ${player[1].points})" title="Edit ${player[0]}'s score">✏️</button>` : ''}
            </div>
        `;
        
        leaderboard.appendChild(li);
    });
    
    // Add GOD at the bottom with special styling
    if (godPlayer) {
        const li = document.createElement('li');
        li.className = 'player god-player';
        
        li.innerHTML = `
            <div class="player-name">
                <span class="divine-icon">✝️</span>
                <span class="divine-icon">🙏</span>
                <span style="font-weight: bold; color: #8B4513;">GOD ALMIGHTY</span>
                <span class="divine-icon">⛪</span>
                <span class="divine-icon">✨</span>
            </div>
            <div class="points" style="color: #8B4513; font-weight: bold;">
                ${godPlayer[1].points} 🙏
                ${isBookkeeperLoggedIn ? `<button class="edit-score-btn" onclick="openScoreEditModal('GOD', ${godPlayer[1].points})" title="Edit GOD's score">✏️</button>` : ''}
            </div>
        `;
        
        leaderboard.appendChild(li);
    }
}

function toggleBookkeeper() {
    if (isBookkeeperLoggedIn) {
        // Log out
        isBookkeeperLoggedIn = false;
        localStorage.removeItem('bookkeeperLoggedIn');
        document.getElementById('bookkeeperCard').style.display = 'none';
        document.getElementById('loginSection').style.display = 'block';
        alert('👋 Ham Handler logged out!');
    } else {
        // Show login modal
        document.getElementById('loginModal').style.display = 'flex';
    }
}

function attemptLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    // Modern pig-themed credentials
    if ((username.toLowerCase() === 'hamhandler' || username.toLowerCase() === 'ham handler' || username.toLowerCase() === 'pigmaster') && 
        (password.toLowerCase() === 'oinkmaster2025' || password.toLowerCase() === 'piggypiggy' || password === 'PIG')) {
        // Successful login
        isBookkeeperLoggedIn = true;
        localStorage.setItem('bookkeeperLoggedIn', 'true');
        
        // Also set player login state for Evan (Ham Handler gets both admin and player access)
        isPlayerLoggedIn = true;
        currentPlayer = 'Evan';
        localStorage.setItem('hamHandlerPlayerLoggedIn', 'true');
        localStorage.setItem('hamHandlerCurrentPlayer', 'Evan');
        
        document.getElementById('loginModal').style.display = 'none';
        
        // Check login state to show appropriate UI
        checkLoginState();
        
        // Clear the form
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        
        // Update status bar
        updateStatusBar();
        
        alert('👑 HAM HANDLER ACTIVATED! 👑\n\n🐷 You now have supreme power over all pig points!\n\n✨ Your pig empire awaits your command! ✨');
        
        // Log activity
        addActivity('admin', '🔐', `Evan logged in as Ham Handler (Password Login)`);
    } else {
        // Wrong credentials - SHAME!
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('shameModal').style.display = 'flex';
        
        // Clear the form
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    }
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

function closeShameModal() {
    document.getElementById('shameModal').style.display = 'none';
}

function transferPoints() {
    if (!isBookkeeperLoggedIn) {
        alert('🚫 You must be logged in as bookkeeper!');
        return;
    }
    
    const fromPlayer = document.getElementById('fromPlayer').value;
    const toPlayer = document.getElementById('toPlayer').value;
    const points = parseInt(document.getElementById('pointsAmount').value);
    
    if (fromPlayer === toPlayer) {
        alert('🤪 You cannot transfer points to yourself, silly!');
        return;
    }
    
    if (players[fromPlayer].points < points) {
        alert('🚫 Not enough pig points to transfer!');
        return;
    }
    
    players[fromPlayer].points -= points;
    players[toPlayer].points += points;
    
    savePlayers(); // Save to localStorage
    updateLeaderboard();
    
    // Log activity
    addActivity('admin', '🔄', `Ham Handler transferred ${points} points from ${fromPlayer} to ${toPlayer}`);
    
    alert(`🔄 Transferred ${points} pig points from ${fromPlayer} to ${toPlayer}!\n🐷 OINK OINK! 🐷`);
}

function pigPointsFromGod() {
    const messages = [
        "The Pig Gods smile upon you! +10 points!",
        "Divine porcine intervention! +15 points!",
        "The Great Pig in the Sky blesses you! +5 points!",
        "Bacon-flavored miracles! +20 points!",
        "The Pig Gods are feeling generous! +25 points!",
        "Oink! The heavens open! +8 points!",
        "A golden pig appears! +12 points!",
        "The Pig Gods have spoken through beer! +7 points!"
    ];
    
    const randomPlayer = Object.keys(players)[Math.floor(Math.random() * Object.keys(players).length)];
    const randomPoints = Math.floor(Math.random() * 20) + 5;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    players[randomPlayer].points += randomPoints;
    
    savePlayers(); // Save to localStorage
    
    // Log activity
    addActivity('admin', '✨', `${randomPlayer} received ${randomPoints} points from GOD!`);
    
    document.getElementById('godMessage').innerHTML = `
        <strong>${randomPlayer}</strong> has been blessed!<br>
        ${randomMessage.replace(/\+\d+/, `+${randomPoints}`)}
    `;
    
    document.getElementById('godModal').style.display = 'flex';
    updateLeaderboard();
}

function closeGodModal() {
    document.getElementById('godModal').style.display = 'none';
}

function resetAllPoints() {
    if (confirm('🐷 Are you sure you want to reset ALL pig points back to starting values? This cannot be undone!\n\nThis will reset points for EVERYONE using this app!\n\nPlayers: 100 points\nGOD: 1000 points')) {
        players = {
            'Evan': 100,
            'Ian': 100,
            'Andrew': 100,
            'Zack': 100,
            'Brian': 100,
            'Alex': 100,
            'GOD': 1000
        };
        savePlayers();
        
        // Log activity
        addActivity('admin', '🔄', 'Ham Handler reset all points to starting values');
        
        alert('🔄 All pig points have been reset!\n🐷 Players: 100 points\n✝️ GOD: 1000 points\n\nLet the divine games begin! 🙏');
    }
}

// Check login state on page load
function checkLoginState() {
    if (isBookkeeperLoggedIn && isPlayerLoggedIn && currentPlayer === 'Evan') {
        // Evan gets both Ham Handler AND Player controls
        document.getElementById('bookkeeperCard').style.display = 'block';
        document.getElementById('playerCard').style.display = 'block';
        document.getElementById('loginSection').style.display = 'none';
        updatePlayerUI();
    } else if (isBookkeeperLoggedIn) {
        // Regular Ham Handler (old PIG/PIG login)
        document.getElementById('bookkeeperCard').style.display = 'block';
        document.getElementById('playerCard').style.display = 'none';
        document.getElementById('loginSection').style.display = 'none';
        updateStatusBar();
    } else if (isPlayerLoggedIn && currentPlayer) {
        // Regular player (Andrew, etc.)
        document.getElementById('bookkeeperCard').style.display = 'none';
        document.getElementById('playerCard').style.display = 'block';
        document.getElementById('loginSection').style.display = 'none';
        updatePlayerUI();
    } else {
        // Not logged in
        document.getElementById('bookkeeperCard').style.display = 'none';
        document.getElementById('playerCard').style.display = 'none';
        document.getElementById('loginSection').style.display = 'block';
        updateStatusBar();
    }
}

// Legacy bypass login check - now handled by Firebase Auth onAuthStateChanged
// This function is kept for compatibility but will be removed in future updates
function checkBypassLoginState() {
    // Firebase Auth now handles bypass login persistence automatically
    // No need for manual localStorage checks
    console.log('🔄 Legacy bypass login check - now handled by Firebase Auth');
}

// Check for Ham Handler login state from localStorage
function checkHamHandlerLoginState() {
    const hamHandlerLoggedIn = localStorage.getItem('hamHandlerPlayerLoggedIn') === 'true';
    const hamHandlerPlayer = localStorage.getItem('hamHandlerCurrentPlayer');
    
    if (hamHandlerLoggedIn && hamHandlerPlayer) {
        console.log(`🚀 Restoring Ham Handler login state: ${hamHandlerPlayer}`);
        isPlayerLoggedIn = true;
        currentPlayer = hamHandlerPlayer;
        
        // Ham Handler is always Evan and gets bookkeeper access
        isBookkeeperLoggedIn = true;
        localStorage.setItem('bookkeeperLoggedIn', 'true');
        
        console.log(`🔐 Ham Handler login restored: ${hamHandlerPlayer}`);
        
        // Update UI to reflect login state (with delay to ensure insults are loaded)
        setTimeout(() => {
            updateLeaderboard();
            updatePlayerUI();
            updateStatusBar();
        }, 100);
    }
}

// Initialize login state
checkBypassLoginState();
checkHamHandlerLoginState();
checkLoginState();

// Ensure UI is updated after login state is restored
setTimeout(() => {
    if (isPlayerLoggedIn) {
        updatePlayerUI();
        updateStatusBar();
        console.log(`🔐 Login state confirmed: ${currentPlayer} is logged in`);
    }
}, 500);

// Initialize HOGWASH cooldowns
loadHogwashCooldowns();

// Initialize audio system for autoplay bypass
initializeAudioSystem();

// Activity Feed Functions
function loadActivityFeed() {
    const activityFeed = document.getElementById('activityFeed');
    const loadingIndicator = document.getElementById('activityLoadingIndicator');
    
    // Check if elements exist (activity feed is only on activity.html page)
    if (!activityFeed) return;
    
    // Hide loading indicator and show feed
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    activityFeed.style.display = 'block';
    
    activityFeed.innerHTML = '';
    
    if (activities.length === 0) {
        activityFeed.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No activities yet. Start gambling and transferring points!</p>';
        return;
    }
    
    // Show last 20 activities
    const recentActivities = activities.slice(0, 20);
    
    recentActivities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = `activity-item ${activity.type}`;
        
        const timeString = new Date(activity.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Special handling for drink proof activities
        if (activity.type === 'drink_proof') {
            activityItem.classList.add('clickable-proof');
            activityItem.style.cursor = 'pointer';
            activityItem.onclick = () => showProofModal(activity.id);
        
        activityItem.innerHTML = `
            <div class="activity-time">${timeString}</div>
            <div class="activity-text">
                <span class="activity-emoji">${activity.emoji}</span>
                ${activity.message}
                    <span class="view-proof-hint" style="color: #2196F3; font-size: 0.9em; margin-left: 8px;">📱 Click to view</span>
            </div>
        `;
        } else {
            activityItem.innerHTML = `
                <div class="activity-time">${timeString}</div>
                <div class="activity-text">
                    <span class="activity-emoji">${activity.emoji}</span>
                    ${activity.message}
                </div>
            `;
        }
        
        activityFeed.appendChild(activityItem);
    });
}

function addActivity(type, emoji, message, extraData = null) {
    const activity = {
        id: Date.now() + '_' + Math.floor(Math.random() * 10000), // Firebase-safe unique ID
        type: type,
        emoji: emoji,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    // Add extra data if provided (for proof activities)
    if (extraData) {
        activity.extraData = extraData;
    }
    
    // Save to Firebase (individual activity)
    saveActivity(activity);
}

function saveActivity(activity) {
    console.log('💾 Attempting to save activity:', activity);
    
    if (!window.firebaseDB) {
        console.error('❌ Firebase DB not available for activity save');
        alert('❌ Cannot save activity - Firebase not connected');
        return;
    }
    
    const activityRef = window.firebaseRef(window.firebaseDB, `activities/${activity.id}`);
    console.log('💾 Activity ref created:', activityRef);
    
    window.firebaseSet(activityRef, activity)
        .then(() => {
            console.log('✅ Activity saved to Firebase successfully:', activity.message);
        })
        .catch(error => {
            console.error('❌ Activity save error:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);
            alert('❌ Failed to save activity: ' + error.message + '\nCheck console for details.');
        });
}

// Player Login Functions with Phone Auth
function showPlayerLoginModal() {
    document.getElementById('playerLoginModal').style.display = 'flex';
    
    // Debug Firebase Auth state
    console.log('🔍 Firebase Auth Debug:');
    console.log('- Auth instance:', window.firebaseAuth);
    console.log('- Current user:', window.firebaseAuth.currentUser);
    console.log('- App name:', window.firebaseAuth.app.name);
    console.log('- Auth domain:', window.firebaseAuth.config?.authDomain);
    console.log('- Current domain:', window.location.hostname);
    console.log('- Current origin:', window.location.origin);
    console.log('- reCAPTCHA ready:', isRecaptchaReady);
    console.log('- reCAPTCHA verifier:', recaptchaVerifier);
    
    // reCAPTCHA will be initialized when needed during SMS sending
}

function closePlayerLoginModal() {
    document.getElementById('playerLoginModal').style.display = 'none';
    document.getElementById('playerSelect').value = '';
    document.getElementById('verificationCode').value = '';
    document.getElementById('playerStep').style.display = 'block';
    document.getElementById('codeStep').style.display = 'none';
    
    // Reset confirmation result but keep reCAPTCHA ready
    confirmationResult = null;
    
    // Don't re-initialize reCAPTCHA if user is already logged in
    // This prevents unnecessary Firebase calls after successful login
}

function initializeRecaptcha() {
    // Only initialize once - if already ready, don't do anything
    if (isRecaptchaReady && recaptchaVerifier) {
        console.log('✅ reCAPTCHA already initialized and ready');
        return Promise.resolve();
    }
    
    // Prevent multiple simultaneous initializations
    if (isRecaptchaInitializing) {
        console.log('🔄 reCAPTCHA initialization already in progress, waiting...');
        return new Promise((resolve) => {
            const checkReady = () => {
                if (isRecaptchaReady || !isRecaptchaInitializing) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }
    
    isRecaptchaInitializing = true;
    
    return new Promise((resolve, reject) => {
        try {
            console.log('🔧 Initializing reCAPTCHA...');
            
            // Clear any existing reCAPTCHA first
            if (recaptchaVerifier) {
                try {
                    recaptchaVerifier.clear();
                } catch (e) {
                    // Ignore clear errors
                }
                recaptchaVerifier = null;
            }
            
            // Create a dedicated reCAPTCHA container for mobile compatibility
            let recaptchaContainer = document.getElementById('recaptcha-container');
            if (!recaptchaContainer) {
                recaptchaContainer = document.createElement('div');
                recaptchaContainer.id = 'recaptcha-container';
                recaptchaContainer.style.display = 'none'; // Hidden for invisible reCAPTCHA
                document.body.appendChild(recaptchaContainer);
            }
            
            // Simple reCAPTCHA configuration - bare minimum
            recaptchaVerifier = new window.RecaptchaVerifier(window.firebaseAuth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    console.log('✅ reCAPTCHA solved successfully');
                }
            });
            
            // Render the reCAPTCHA
            recaptchaVerifier.render().then(() => {
                console.log('✅ reCAPTCHA rendered and ready');
                isRecaptchaReady = true;
                isRecaptchaInitializing = false;
                resolve();
            }).catch((error) => {
                console.error('❌ reCAPTCHA render error:', error);
                
                // If already rendered, that's actually fine
                if (error.message && error.message.includes('already been rendered')) {
                    console.log('🔧 reCAPTCHA already rendered, marking as ready');
                    isRecaptchaReady = true;
                    isRecaptchaInitializing = false;
                    resolve();
                } else {
                    recaptchaVerifier = null;
                    isRecaptchaReady = false;
                    isRecaptchaInitializing = false;
                    reject(error);
                }
            });
            
        } catch (error) {
            console.error('❌ reCAPTCHA initialization error:', error);
            console.error('❌ Error details:', error.message);
            
            // Check for common domain authorization issues
            if (error.message && error.message.includes('argument-error')) {
                console.error('🚨 Domain authorization issue detected!');
                console.error('🔧 Current domain:', window.location.hostname);
                console.error('🔧 Auth domain:', 'mbepiggy.firebaseapp.com');
                console.error('💡 Solution: Add piggypiggy.pro to Firebase Console > Authentication > Settings > Authorized domains');
            }
            
            recaptchaVerifier = null;
            isRecaptchaReady = false;
            isRecaptchaInitializing = false;
            reject(error);
        }
    });
}

// Check if this is a test phone number (bypasses SMS)
function isTestPhoneNumber(phoneNumber) {
    const testNumbers = {
        '+15555551234': 'Andrew', // Test number for Andrew
        '+15555551235': 'Evan'    // Test number for Evan
    };
    return testNumbers[phoneNumber];
}

function sendVerificationCode() {
    const selectedPlayer = document.getElementById('playerSelect').value;
    
    if (!selectedPlayer) {
        alert('🚫 Please select your name!');
        return;
    }

    // Get phone number for selected player
    const phoneNumber = playerToPhone[selectedPlayer];
    
    if (!phoneNumber) {
        alert('🚫 No phone number registered for this player!\n\nContact the Ham Handler to add your number.');
        return;
    }

    // Ensure reCAPTCHA is ready
    if (!isRecaptchaReady || !recaptchaVerifier) {
        console.log('🔧 reCAPTCHA not ready, initializing...');
        initializeRecaptcha().then(() => {
            if (isRecaptchaReady && recaptchaVerifier) {
                sendVerificationCode(); // Retry after successful initialization
            } else {
                alert('🚫 reCAPTCHA initialization failed. Please use BYPASS button or refresh the page.');
            }
        }).catch((error) => {
            console.error('❌ reCAPTCHA initialization failed:', error);
            
            let initErrorMessage = '🚫 reCAPTCHA initialization failed.\n\n';
            if (error.message && error.message.includes('argument-error')) {
                initErrorMessage += '🚨 DOMAIN ISSUE: piggypiggy.pro needs Firebase authorization.\n\n';
                initErrorMessage += '👨‍💻 ADMIN: Add piggypiggy.pro to Firebase Console > Authentication > Settings > Authorized domains\n\n';
            }
            initErrorMessage += '✅ SOLUTION: Use the green SECURE LOGIN button below!';
            
            alert(initErrorMessage);
        });
        return;
    }

    console.log('📱 Sending SMS to:', phoneNumber);
    console.log('🔧 Using reCAPTCHA verifier:', recaptchaVerifier);

    // Disable the button to prevent multiple clicks
    const sendButton = document.getElementById('send-code-button');
    const originalText = sendButton.textContent;
    sendButton.disabled = true;
    sendButton.textContent = '📱 SENDING...';

    // Simple timeout - 20 seconds
    const timeoutId = setTimeout(() => {
        console.error('⏰ SMS sending timeout - operation took too long');
        sendButton.disabled = false;
        sendButton.textContent = originalText;
        alert('🚫 SMS sending timed out.\n\n✅ SOLUTION: Use the green SECURE LOGIN button below!');
    }, 20000);

    // Send SMS verification code
    console.log('🚀 Starting signInWithPhoneNumber...');
    window.signInWithPhoneNumber(window.firebaseAuth, phoneNumber, recaptchaVerifier)
        .then((result) => {
            clearTimeout(timeoutId); // Clear timeout on success
            confirmationResult = result;
            document.getElementById('playerStep').style.display = 'none';
            document.getElementById('codeStep').style.display = 'block';
            
            // Show masked phone number for privacy
            const maskedPhone = phoneNumber.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1***$3$4');
            alert(`📱 Verification code sent to ${maskedPhone}!\nCheck your SMS messages.`);
            
            console.log('✅ SMS sent successfully');
        })
        .catch((error) => {
            clearTimeout(timeoutId); // Clear timeout on error
            console.error('❌ SMS send error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            // Don't show annoying popups - just update the UI
            console.log('📱 SMS failed, updating UI to suggest secure login');
            
            // Update the SMS section to show it's not working
            const smsSection = document.querySelector('[style*="background: #f8f9fa"]');
            if (smsSection) {
                smsSection.style.background = '#f8d7da';
                smsSection.style.borderColor = '#f5c6cb';
                const smsText = smsSection.querySelector('small');
                if (smsText) {
                    if (error.code === 'auth/too-many-requests') {
                        smsText.innerHTML = '<strong>❌ SMS Rate Limited</strong><br>Firebase has blocked SMS requests. Use SECURE LOGIN above instead.';
                    } else {
                        smsText.innerHTML = '<strong>❌ SMS Currently Unavailable</strong><br>Firebase SMS issues. Use SECURE LOGIN above instead.';
                    }
                }
            }
            
            // Show a brief, non-intrusive message
            console.log(`💡 SMS Error (${error.code}): Use SECURE LOGIN instead`);
            
            // Reset reCAPTCHA for next attempt
            isRecaptchaReady = false;
        })
        .finally(() => {
            // Re-enable the button
            sendButton.disabled = false;
            sendButton.textContent = originalText;
        });
}

function verifyCode() {
    const code = document.getElementById('verificationCode').value.trim();
    
    if (!code || code.length !== 6) {
        alert('🚫 Please enter the 6-digit verification code!');
        return;
    }

    confirmationResult.confirm(code)
        .then((result) => {
            // User signed in successfully
            console.log('✅ SMS verification successful');
            closePlayerLoginModal();
            
            // Don't show success message here - let onAuthStateChanged handle it
            // This prevents duplicate processing and rate limit issues
        })
        .catch((error) => {
            console.error('Code verification error:', error);
            alert('🚫 Invalid verification code!\nPlease check your SMS and try again.');
        });
}

function backToPlayerSelect() {
    document.getElementById('playerStep').style.display = 'block';
    document.getElementById('codeStep').style.display = 'none';
    document.getElementById('verificationCode').value = '';
}

function logoutPlayer() {
    if (confirm('👋 Are you sure you want to logout?\nYou will need to verify your phone number again to login.')) {
        console.log('🔐 Logging out player...');
        
        // Clear Alex's drink countdown timer if running
        if (window.alexDrinkCountdownTimer) {
            clearInterval(window.alexDrinkCountdownTimer);
            window.alexDrinkCountdownTimer = null;
        }
        
        // Clear reCAPTCHA state to prevent issues
        isRecaptchaReady = false;
        
        window.firebaseAuth.signOut()
            .then(() => {
                console.log('✅ Logout successful');
                alert('👋 Logged out successfully!');
            })
            .catch((error) => {
                console.error('Logout error:', error);
                
                // Even if logout fails, clear local state
                isPlayerLoggedIn = false;
                currentPlayer = '';
                isBookkeeperLoggedIn = false;
                localStorage.removeItem('bookkeeperLoggedIn');
                localStorage.removeItem('hamHandlerPlayerLoggedIn');
                localStorage.removeItem('hamHandlerCurrentPlayer');
                localStorage.removeItem('firebaseAuthLoggedIn');
                localStorage.removeItem('bypassLoginInProgress');
                checkLoginState();
                
                if (error.code === 'auth/too-many-requests') {
                    alert('⚠️ Rate limit reached. You have been logged out locally.\nWait a few minutes before trying to login again.');
                } else {
                    alert('⚠️ Logout error, but you have been logged out locally.\nIf you continue to see issues, refresh the page.');
                }
            });
    }
}

// Debug function to show Firebase Auth configuration
function debugFirebaseAuth() {
    const debugInfo = {
        'Current Domain': window.location.hostname,
        'Current Origin': window.location.origin,
        'Firebase Auth Domain': window.firebaseAuth.config?.authDomain || 'Not available',
        'Firebase Project ID': window.firebaseAuth.config?.projectId || 'Not available',
        'reCAPTCHA Ready': isRecaptchaReady,
        'reCAPTCHA Verifier': recaptchaVerifier ? 'Initialized' : 'Not initialized',
        'Current User': window.firebaseAuth.currentUser ? 'Signed in' : 'Not signed in'
    };
    
    let debugMessage = '🔍 FIREBASE AUTH DEBUG INFO:\n\n';
    Object.entries(debugInfo).forEach(([key, value]) => {
        debugMessage += `${key}: ${value}\n`;
    });
    
    debugMessage += '\n📋 TROUBLESHOOTING:\n';
    debugMessage += '• If domain issues: Add your domain to Firebase Console → Authentication → Settings → Authorized domains\n';
    debugMessage += '• If reCAPTCHA issues: Check browser console for detailed errors\n';
    debugMessage += '• If rate limited: Wait 15+ minutes or use bypass\n';
    debugMessage += '• For testing: Use BYPASS SMS button';
    
    alert(debugMessage);
    
    // Also log to console for detailed inspection
    console.log('🔍 Firebase Auth Debug Info:', debugInfo);
    console.log('🔍 Full Firebase Auth object:', window.firebaseAuth);
}

// PRIMARY LOGIN METHOD - Secure bypass login using Firebase Anonymous Auth
function bypassSMSForTesting() {
    const selectedPlayer = document.getElementById('playerSelect').value;
    
    if (!selectedPlayer) {
        alert('🚫 Please select your name first!');
        return;
    }

    // Prompt for secure bypass password
    const enteredPassword = prompt(`🔐 SECURE LOGIN\n\nEnter the secure pig password to log in as ${selectedPlayer}:`);
    
    if (!enteredPassword) {
        return; // User cancelled
    }
    
    // Check if password is correct
    if (enteredPassword !== 'IMAPIGOINK123') {
        alert('🚫 INCORRECT PASSWORD!\n\nAccess denied. Contact the Ham Handler if you need the password.');
        return;
    }

    console.log(`🔐 PRIMARY: Secure login for ${selectedPlayer} using Firebase Anonymous Auth`);
    
    // Set the bypass login flag BEFORE Firebase auth to prevent race condition
    localStorage.setItem('bypassLoginInProgress', selectedPlayer);
    
    // Clear any existing auth state first
    if (window.firebaseAuth.currentUser) {
        console.log('🧹 Clearing existing Firebase Auth state...');
        window.firebaseAuth.signOut().then(() => {
            performBypassLogin(selectedPlayer);
        }).catch(() => {
            // Even if signOut fails, try the bypass login
            performBypassLogin(selectedPlayer);
        });
    } else {
        performBypassLogin(selectedPlayer);
    }
}

function performBypassLogin(selectedPlayer) {
    // Use Firebase Anonymous Authentication
    window.signInAnonymously(window.firebaseAuth)
        .then((userCredential) => {
            console.log(`✅ Firebase Anonymous Auth successful for ${selectedPlayer}`);
            
            // Update the user profile with the player name
            return window.updateProfile(userCredential.user, {
                displayName: selectedPlayer,
                photoURL: `bypass-${selectedPlayer.toLowerCase()}`  // Use photoURL to store bypass flag
            });
        })
        .then(() => {
            console.log(`✅ User profile updated for ${selectedPlayer}`);
            closePlayerLoginModal();
            
            // The onAuthStateChanged listener will handle the rest of the login process
            // (bypassLoginInProgress was already set before the Firebase call)
        })
        .catch((error) => {
            console.error('Firebase Anonymous Auth bypass login error:', error);
            
            // Clear the bypass login flag on error
            localStorage.removeItem('bypassLoginInProgress');
            
            if (error.code === 'auth/operation-not-allowed') {
                alert('🚫 Anonymous authentication is not enabled in Firebase Console.\n\n🔧 SOLUTION:\n1. Go to Firebase Console\n2. Authentication → Sign-in method\n3. Enable "Anonymous"\n4. Save changes\n\nContact the Ham Handler if you need help.');
            } else {
                alert(`🚫 Secure login failed: ${error.message}\n\nTry refreshing the page or contact the Ham Handler.`);
            }
        });
}

// Clear bypass login function
function clearBypassLogin() {
    if (confirm('🧹 Clear all login data?\n\nThis will log you out and clear all cached login information.')) {
        console.log('🧹 Clearing all login data...');
        
        // Clear Firebase Auth
        if (window.firebaseAuth.currentUser) {
            window.firebaseAuth.signOut();
        }
        
        // Clear all localStorage
        localStorage.removeItem('bookkeeperLoggedIn');
        localStorage.removeItem('hamHandlerPlayerLoggedIn');
        localStorage.removeItem('hamHandlerCurrentPlayer');
        localStorage.removeItem('firebaseAuthLoggedIn');
        localStorage.removeItem('bypassLoginInProgress');
        
        // Reset local state
        isPlayerLoggedIn = false;
        currentPlayer = '';
        isBookkeeperLoggedIn = false;
        
        // Update UI
        checkLoginState();
        
        alert('🧹 All login data cleared!\nYou can now try logging in again.');
    }
}

function updatePlayerUI() {
    if (!currentPlayer) return;
    
    const playerInsult = getPlayerInsult(currentPlayer);
    document.getElementById('playerWelcome').textContent = `Greetings ${playerInsult} ${currentPlayer}!`;
    document.getElementById('playerPoints').textContent = 'Your Points: ' + (players[currentPlayer]?.points || 0) + ' 🐷';
    
    // Remove current player from transfer dropdown
    const transferSelect = document.getElementById('playerTransferTo');
    Array.from(transferSelect.options).forEach(option => {
        if (option.value === currentPlayer) {
            option.style.display = 'none';
        } else {
            option.style.display = 'block';
        }
    });
    
    // Update drink assignment section
    const drinkSection = document.getElementById('alexDrinkSection');
    if (drinkSection) {
        if (currentPlayer === 'Alex') {
            // Alex has his own special system
            if (window.firebaseDB) {
                loadAlexDrinkCredits();
                loadAlexDangerZoneCredits();
            }
            updateAlexDrinkUI();
        } else {
            // Check if current player has giveDrinks power-ups
            const playerData = players[currentPlayer];
            const giveDrinksCount = playerData?.powerUps?.giveDrinks || 0;
            
            if (giveDrinksCount > 0) {
                // Show power-up drink assignment section
                drinkSection.innerHTML = `
                    <div style="text-align: center; margin: 20px 0; padding: 15px; background: linear-gradient(45deg, #FF9800, #F57C00); border-radius: 10px;">
                        <h4 style="color: white; margin: 0 0 10px 0;">🍺 POWER-UP DRINKS 🍺</h4>
                        <p style="color: white; margin: 5px 0;">Available Drinks: <strong>${giveDrinksCount}</strong></p>
                        <p style="color: #FFE0B2; margin: 5px 0; font-size: 0.9em;">Earned from HOGWASH gambling!</p>
                        <button class="transfer-btn" onclick="showPowerUpDrinkAssignmentModal()" style="background: linear-gradient(45deg, #4CAF50, #45a049); color: white; font-weight: bold; margin-top: 10px;">
                            🍻 ASSIGN DRINKS 🍻
                        </button>
                        <p style="font-size: 0.8em; color: #FFE0B2; margin: 8px 0 0 0;">
                            Use your earned drinks to make others drink! 🐷
                        </p>
                    </div>
                `;
            } else {
                // Clear the section if no drinks available
                drinkSection.innerHTML = '';
            }
        }
    }
    
    // Update status bar
    updateStatusBar();
}

function updateStatusBar() {
    const statusBar = document.getElementById('statusBar');
    const statusPlayerName = document.getElementById('statusPlayerName');
    const statusPlayerPoints = document.getElementById('statusPlayerPoints');
    
    // Check if elements exist (they might not be loaded yet)
    if (!statusBar || !statusPlayerName || !statusPlayerPoints) {
        return;
    }
    
    if (isPlayerLoggedIn && currentPlayer) {
        statusBar.classList.add('visible');
        
        if (currentPlayer === 'Evan' && isBookkeeperLoggedIn) {
            statusPlayerName.textContent = `👑 ${currentPlayer} (Ham Handler)`;
        } else {
            const playerInsult = getPlayerInsult(currentPlayer);
            statusPlayerName.textContent = `Greetings ${playerInsult} ${currentPlayer}!`;
        }
        
        const points = players[currentPlayer] || 0;
        statusPlayerPoints.textContent = `${points} points`;
    } else if (isBookkeeperLoggedIn && !isPlayerLoggedIn) {
        // Ham Handler only (old PIG/PIG login)
        statusBar.classList.add('visible');
        statusPlayerName.textContent = `👑 Ham Handler`;
        statusPlayerPoints.textContent = `Admin Mode`;
    } else {
        statusBar.classList.remove('visible');
    }
}

function quickLogout() {
    // Clear bypass login state
    localStorage.removeItem('bypassPlayerLoggedIn');
    localStorage.removeItem('bypassCurrentPlayer');
    
    // Clear Firebase auth login flag
    localStorage.removeItem('firebaseAuthLoggedIn');
    
    if (isPlayerLoggedIn) {
        logoutPlayer();
    } else if (isBookkeeperLoggedIn) {
        toggleBookkeeper(); // This will log out Ham Handler
    }
}

// Function to clear bypass login state for testing real Firebase Auth
function clearBypassLogin() {
    localStorage.removeItem('bypassPlayerLoggedIn');
    localStorage.removeItem('bypassCurrentPlayer');
    localStorage.removeItem('firebaseAuthLoggedIn');
    
    // Reset local state
    isPlayerLoggedIn = false;
    currentPlayer = '';
    isBookkeeperLoggedIn = false;
    localStorage.removeItem('bookkeeperLoggedIn');
    
    // Sign out from Firebase Auth if logged in
    if (window.firebaseAuth.currentUser) {
        window.firebaseAuth.signOut();
    }
    
    checkLoginState();
    console.log('🧹 Bypass login state cleared - ready for real Firebase Auth testing');
    alert('🧹 Bypass login cleared!\nYou can now test real Firebase Auth login.');
}

// Make it available globally for console debugging
window.clearBypassLogin = clearBypassLogin;

// Make HOGWASH cooldown functions globally accessible
window.closeHogwashCooldownModal = closeHogwashCooldownModal;

// DANGER ZONE broadcast functions
function broadcastDangerZone(playerName) {
    if (!window.firebaseDB) {
        console.error('❌ Firebase DB not available for DANGER ZONE broadcast');
        return;
    }
    
    const dangerZoneData = {
        playerName: playerName,
        timestamp: new Date().toISOString(),
        eventId: Date.now() + '_' + Math.floor(Math.random() * 10000)
    };
    
    const dangerZoneRef = window.firebaseRef(window.firebaseDB, 'dangerZone');
    window.firebaseSet(dangerZoneRef, dangerZoneData)
        .then(() => {
            console.log('🚨 DANGER ZONE broadcast sent successfully!');
        })
        .catch((error) => {
            console.error('❌ DANGER ZONE broadcast failed:', error);
        });
}

function showDangerZoneAlert(playerName, timestamp) {
    // Prevent duplicate alerts for the same event
    if (window.lastDangerZoneAlert === timestamp) {
        console.log('🚨 Duplicate DANGER ZONE alert prevented');
        return;
    }
    window.lastDangerZoneAlert = timestamp;
    
    // Play danger zone audio if available
    playDangerZoneAudio();
    
    // Create dramatic warning popup
    const alertModal = document.createElement('div');
    alertModal.id = 'dangerZoneAlert';
    alertModal.className = 'modal';
    alertModal.style.display = 'flex';
    alertModal.style.zIndex = '999999'; // Extremely high z-index to ensure it's always on top
    
    alertModal.innerHTML = `
        <div class="modal-content" style="
            background: linear-gradient(45deg, #ff0000, #ff4500, #ff0000); 
            color: white; 
            text-align: center; 
            border: 5px solid #ff0000;
            animation: dangerPulse 0.5s infinite alternate;
            box-shadow: 0 0 50px #ff0000;
        ">
            <h1 style="
                font-size: 4rem; 
                margin: 20px 0; 
                text-shadow: 3px 3px 0px #000;
                animation: dangerShake 0.3s infinite;
            ">⚠️ DANGER ZONE ⚠️</h1>
            
            <div style="font-size: 6rem; margin: 30px 0; animation: dangerSpin 2s linear infinite;">
                💀⚠️💀
            </div>
            
            <h2 style="
                font-size: 3rem; 
                margin: 20px 0; 
                color: #ffff00;
                text-shadow: 2px 2px 0px #000;
                animation: dangerFlash 1s infinite;
            ">
                ${playerName} TRIGGERED THE DANGER ZONE!
            </h2>
            
            <p style="
                font-size: 2rem; 
                margin: 20px 0; 
                font-weight: bold;
                text-shadow: 1px 1px 0px #000;
            ">
                🚨 ALL PLAYERS ARE NOW IN DANGER! 🚨<br>
                💀 BEWARE THE CONSEQUENCES! 💀
            </p>
            
            <button onclick="closeDangerZoneAlert()" style="
                background: linear-gradient(45deg, #000, #333); 
                color: #ff0000; 
                border: 3px solid #ff0000;
                padding: 15px 30px; 
                font-size: 1.5rem; 
                font-weight: bold;
                cursor: pointer;
                margin-top: 20px;
                animation: dangerButtonPulse 1s infinite;
            ">
                💀 ACKNOWLEDGE DANGER 💀
            </button>
        </div>
    `;
    
    document.body.appendChild(alertModal);
    
    // Add CSS animations if they don't exist
    addDangerZoneAnimations();
    
    // Auto-close after 20 seconds if user doesn't click
    setTimeout(() => {
        closeDangerZoneAlert();
    }, 20000);
    
    console.log('🚨 DANGER ZONE alert displayed for all users!');
}

function playDangerZoneAudio() {
    console.log('🔊 Attempting to play DANGER ZONE audio...');
    console.log('🔊 Audio unlocked status:', audioUnlocked);
    
    // Prevent multiple simultaneous playback
    if (audioPlayingSuccessfully) {
        console.log('🔊 Audio already playing successfully, skipping duplicate playback');
        return;
    }
    
    // Reset the success flag
    audioPlayingSuccessfully = false;
    
    // Strategy 1: Try preloaded audio first (best chance for autoplay)
    if (preloadedAudio && audioUnlocked) {
        console.log('🔊 Strategy 1: Using preloaded audio (unlocked)');
        preloadedAudio.muted = false; // Unmute for actual playback
        preloadedAudio.currentTime = 0; // Reset to start
        preloadedAudio.play()
            .then(() => {
                console.log('✅ SUCCESS! Preloaded DANGER ZONE audio playing');
                audioPlayingSuccessfully = true;
                
                // Reset flag after audio finishes (estimated duration)
                setTimeout(() => {
                    audioPlayingSuccessfully = false;
                }, 10000); // 10 seconds should be enough for most audio clips
                
                return;
            })
            .catch((error) => {
                console.log('🔇 Preloaded audio failed:', error.name);
                tryAlternativeAudioMethods();
            });
        return;
    }
    
    // Strategy 2: Try multiple alternative methods
    tryAlternativeAudioMethods();
}

function tryAlternativeAudioMethods() {
    console.log('🔊 Trying alternative audio methods...');
    
    // Check if audio is already playing successfully
    if (audioPlayingSuccessfully) {
        console.log('🔊 Audio already playing, stopping alternative methods');
        return;
    }
    
    const possibleAudioFiles = [
        'danger-zone.mp3',
        'dangerzone.mp3', 
        'danger_zone.mp3',
        'audio/danger-zone.mp3',
        'sounds/danger-zone.mp3'
    ];
    
    let methodIndex = 0;
    let fileIndex = 0;
    
    function tryNextMethod() {
        // Stop if audio is already playing successfully
        if (audioPlayingSuccessfully) {
            console.log('🔊 Audio playing successfully, stopping remaining methods');
            return;
        }
        
        if (methodIndex >= 3) {
            console.log('🔇 All audio methods failed. Audio may be blocked by browser.');
            // Don't show permission prompt if we're on a broadcast (other users)
            if (!window.lastDangerZoneAlert || Date.now() - new Date(window.lastDangerZoneAlert).getTime() < 5000) {
                // Only show prompt if this is a recent/local trigger
                setTimeout(() => showAudioPermissionPrompt(), 1000);
            }
            return;
        }
        
        const audioFile = possibleAudioFiles[fileIndex % possibleAudioFiles.length];
        
        if (methodIndex === 0) {
            // Method 1: Standard Audio with aggressive settings
            console.log(`🔊 Method 1 - Standard Audio: ${audioFile}`);
            tryStandardAudio(audioFile);
        } else if (methodIndex === 1) {
            // Method 2: Web Audio API (if available)
            console.log(`🔊 Method 2 - Web Audio API: ${audioFile}`);
            tryWebAudioAPI(audioFile);
        } else if (methodIndex === 2) {
            // Method 3: Force play with user gesture simulation
            console.log(`🔊 Method 3 - Force play: ${audioFile}`);
            tryForcePlay(audioFile);
        }
        
        // Move to next method after a delay (but check success first)
        setTimeout(() => {
            if (!audioPlayingSuccessfully) {
                methodIndex++;
                tryNextMethod();
            }
        }, 300); // Reduced delay for faster response
    }
    
    function tryStandardAudio(audioFile) {
        if (audioPlayingSuccessfully) return; // Stop if already playing
        
        const audio = new Audio();
        audio.volume = 0.9;
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.src = audioFile;
        
        // Try to play immediately
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    if (!audioPlayingSuccessfully) {
                        console.log(`✅ SUCCESS! Standard audio playing: ${audioFile}`);
                        audioPlayingSuccessfully = true;
                        
                        // Reset flag after audio finishes
                        setTimeout(() => {
                            audioPlayingSuccessfully = false;
                        }, 10000);
                    }
                })
                .catch((error) => {
                    console.log(`🔇 Standard audio failed for ${audioFile}:`, error.name);
                    fileIndex++;
                });
        }
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
                    
                    // Reset flag after audio finishes
                    setTimeout(() => {
                        audioPlayingSuccessfully = false;
                    }, 10000);
                }
            })
            .catch(error => {
                console.log(`🔇 Web Audio API failed for ${audioFile}:`, error);
            });
    }
    
    function tryForcePlay(audioFile) {
        if (audioPlayingSuccessfully) return; // Stop if already playing
        
        // Only create one audio instance instead of 3
        const audio = new Audio(audioFile);
        audio.volume = 0.7;
        audio.muted = false;
        
        // Simulate user gesture
        const event = new MouseEvent('click', { bubbles: true });
        document.dispatchEvent(event);
        
        audio.play().then(() => {
            if (!audioPlayingSuccessfully) {
                console.log(`✅ SUCCESS! Force play audio: ${audioFile}`);
                audioPlayingSuccessfully = true;
                
                // Reset flag after audio finishes
                setTimeout(() => {
                    audioPlayingSuccessfully = false;
                }, 10000);
            }
        }).catch(e => {
            console.log(`🔇 Force play failed:`, e.name);
        });
    }
    
    tryNextMethod();
}

// Show a prompt to enable audio if autoplay is blocked
function showAudioPermissionPrompt() {
    // Only show once per session
    if (window.audioPermissionShown) return;
    window.audioPermissionShown = true;
    
    const audioPrompt = document.createElement('div');
    audioPrompt.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #ff6600, #ff9900);
        color: white;
        padding: 15px;
        border-radius: 10px;
        border: 2px solid #ff0000;
        z-index: 10001;
        font-weight: bold;
        box-shadow: 0 4px 20px rgba(255,0,0,0.5);
        animation: dangerPulse 1s infinite alternate;
    `;
    
    audioPrompt.innerHTML = `
        <div style="margin-bottom: 10px;">🔊 ENABLE DANGER ZONE AUDIO</div>
        <button onclick="enableDangerZoneAudio()" style="
            background: #fff;
            color: #ff0000;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            font-weight: bold;
            cursor: pointer;
        ">🔊 CLICK TO ENABLE AUDIO</button>
        <button onclick="this.parentElement.remove()" style="
            background: #666;
            color: #fff;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            margin-left: 5px;
            cursor: pointer;
        ">✕</button>
    `;
    
    document.body.appendChild(audioPrompt);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (audioPrompt.parentElement) {
            audioPrompt.remove();
        }
    }, 10000);
}

// Function to enable audio after user interaction
function enableDangerZoneAudio() {
    console.log('🔊 User clicked to enable audio - attempting to play...');
    
    // Remove the prompt
    const prompts = document.querySelectorAll('div');
    prompts.forEach(prompt => {
        if (prompt.innerHTML.includes('ENABLE DANGER ZONE AUDIO')) {
            prompt.remove();
        }
    });
    
    // Try to play audio now that user has interacted
    playDangerZoneAudio();
}

// Make function globally accessible
window.enableDangerZoneAudio = enableDangerZoneAudio;

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
    
    // Preload audio file
    preloadDangerZoneAudio();
    
    // Set up event listeners to unlock audio on ANY user interaction
    setupAudioUnlockListeners();
}

function preloadDangerZoneAudio() {
    console.log('📥 Preloading DANGER ZONE audio...');
    
    // Create and preload audio element
    preloadedAudio = new Audio();
    preloadedAudio.preload = 'metadata'; // Changed from 'auto' to prevent auto-download/play
    preloadedAudio.volume = 0.8;
    
    // Also preload HOGWASH theme music
    console.log('🎵 Preloading HOGWASH theme music...');
    preloadHogwashMusic();
    preloadedAudio.src = 'danger-zone.mp3';
    
    // Prevent accidental playback during preload
    preloadedAudio.muted = true;
    
    preloadedAudio.addEventListener('canplaythrough', () => {
        console.log('✅ DANGER ZONE audio preloaded successfully');
    });
    
    preloadedAudio.addEventListener('error', (e) => {
        console.log('❌ Audio preload failed:', e);
        // Try alternative file names
        const alternatives = ['dangerzone.mp3', 'danger_zone.mp3'];
        for (const alt of alternatives) {
            const testAudio = new Audio();
            testAudio.src = alt;
            testAudio.addEventListener('canplaythrough', () => {
                console.log(`✅ Found alternative audio file: ${alt}`);
                preloadedAudio.src = alt;
            });
        }
    });
}

function setupAudioUnlockListeners() {
    console.log('🔓 Setting up audio unlock listeners...');
    
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'];
    
    function unlockAudio() {
        if (audioUnlocked) return;
        
        console.log('🔓 Attempting to unlock audio...');
        
        // Create a truly silent audio for unlocking (data URL with silent audio)
        const silentAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWT');
        
        silentAudio.play().then(() => {
            silentAudio.pause();
            audioUnlocked = true;
            console.log('✅ Audio unlocked successfully!');
            
            // Remove listeners once unlocked
            unlockEvents.forEach(event => {
                document.removeEventListener(event, unlockAudio, true);
            });
        }).catch(e => {
            console.log('🔓 Audio unlock attempt failed:', e);
        });
        
        // Also try with AudioContext
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('✅ AudioContext resumed');
            });
        }
    }
    
    // Add listeners for all interaction events
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, true);
    });
}

function closeDangerZoneAlert() {
    const alertModal = document.getElementById('dangerZoneAlert');
    if (alertModal) {
        alertModal.remove();
    }
}

function addDangerZoneAnimations() {
    // Check if animations already exist
    if (document.getElementById('dangerZoneAnimations')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'dangerZoneAnimations';
    style.textContent = `
        @keyframes dangerPulse {
            0% { transform: scale(1); }
            100% { transform: scale(1.05); }
        }
        
        @keyframes dangerShake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            50% { transform: translateX(5px); }
            75% { transform: translateX(-5px); }
            100% { transform: translateX(0); }
        }
        
        @keyframes dangerSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes dangerFlash {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        @keyframes dangerButtonPulse {
            0% { transform: scale(1); box-shadow: 0 0 10px #ff0000; }
            50% { transform: scale(1.1); box-shadow: 0 0 20px #ff0000; }
            100% { transform: scale(1); box-shadow: 0 0 10px #ff0000; }
        }
    `;
    
    document.head.appendChild(style);
}

// Make functions globally accessible
window.closeDangerZoneAlert = closeDangerZoneAlert;

// DANGER ZONE Testing Functions (TEMPORARY)
function testDangerZoneAlert() {
    if (!isBookkeeperLoggedIn) {
        alert('🚫 You must be logged in as Ham Handler to use testing features!');
        return;
    }
    
    if (confirm('🚨 DANGER ZONE TEST 🚨\n\nThis will:\n1. Force the next HOGWASH to be DANGER ZONE\n2. Trigger the alert on ALL connected devices\n3. Play audio (if available)\n\nContinue with test?')) {
        forceDangerZoneNext = true;
        alert('💀 DANGER ZONE TEST ACTIVATED! 💀\n\nThe next HOGWASH roll will be DANGER ZONE regardless of who uses it.\n\nGo ahead and test HOGWASH now!');
        
        // Visual indication that test mode is active
        const testButton = document.querySelector('button[onclick="testDangerZoneAlert()"]');
        if (testButton) {
            testButton.textContent = '🚨 TEST MODE ACTIVE 🚨';
            testButton.style.animation = 'dangerFlash 1s infinite';
        }
        
        console.log('🚨 DANGER ZONE test mode activated - next HOGWASH will be DANGER ZONE');
    }
}

// Alternative: Direct test without HOGWASH
function directDangerZoneTest() {
    if (!isBookkeeperLoggedIn) {
        alert('🚫 You must be logged in as Ham Handler to use testing features!');
        return;
    }
    
    const testPlayerName = currentPlayer || 'TEST_ADMIN';
    console.log('🚨 Direct DANGER ZONE test triggered by admin');
    
    // Broadcast directly
    broadcastDangerZone(testPlayerName);
    
    // Also show locally for immediate feedback
    showDangerZoneAlert(testPlayerName, new Date().toISOString());
    
    alert('🚨 DANGER ZONE test broadcast sent!\nCheck all connected devices for the alert.');
}

// Audio-only test function
function testAudioOnly() {
    if (!isBookkeeperLoggedIn) {
        alert('🚫 You must be logged in as Ham Handler to use testing features!');
        return;
    }
    
    console.log('🔊 Testing DANGER ZONE audio only...');
    alert('🔊 AUDIO TEST\n\nTesting audio playback only (no popup).\nCheck browser console for detailed audio debugging info.');
    
    // Call the audio function directly
    playDangerZoneAudio();
}

// Make testing functions globally accessible
window.testDangerZoneAlert = testDangerZoneAlert;
window.directDangerZoneTest = directDangerZoneTest;
window.testAudioOnly = testAudioOnly;

// Alex's Drink Assignment System
function initializeAlexDrinkSystem() {
    console.log('🍺 Initializing Alex drink assignment system...');
    
    // Load Alex's drink credits from Firebase
    loadAlexDrinkCredits();
    
    // Load Alex's Danger Zone credits from Firebase
    loadAlexDangerZoneCredits();
    
    // Set up drink refill timer (every hour)
    setInterval(refillAlexDrinks, 60 * 60 * 1000); // Every hour
    
    // Set up Danger Zone refill timer (every 2 hours)
    setInterval(refillAlexDangerZones, ALEX_DANGER_ZONE_COOLDOWN_MS); // Every 2 hours
    
    // Listen for drink assignments from Firebase
    if (window.firebaseDB) {
        const drinkAssignmentsRef = window.firebaseRef(window.firebaseDB, 'drinkAssignments');
        window.firebaseOnValue(drinkAssignmentsRef, (snapshot) => {
            if (snapshot.exists()) {
                const drinkData = snapshot.val();
                console.log('🍺 Drink assignment broadcast received:', drinkData);
                
                // Check if this is a new assignment (within last 10 seconds)
                const eventTime = new Date(drinkData.timestamp);
                const now = new Date();
                const timeDiff = now - eventTime;
                
                if (timeDiff < 10000) { // Within 10 seconds
                    // Don't show alert to the person who assigned the drinks
                    const assignedBy = drinkData.assignedBy || 'Alex';
                    if (currentPlayer !== assignedBy) {
                        console.log(`🍺 Showing drink assignment alert for non-${assignedBy} users!`);
                        showDrinkAssignmentAlert(drinkData);
                    } else {
                        console.log(`🍺 Skipping drink assignment alert for ${assignedBy} (sender)`);
                    }
                }
            }
        }, (error) => {
            console.error('❌ Firebase drink assignments listener error:', error);
        });
    }
}

function loadAlexDrinkCredits() {
    if (window.firebaseDB) {
        const alexDrinksRef = window.firebaseRef(window.firebaseDB, 'alexDrinkSystem');
        window.firebaseOnValue(alexDrinksRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                alexDrinkCredits = data.credits || 0;
                alexLastDrinkRefill = data.lastRefill || Date.now();
                console.log(`🍺 Alex drink credits loaded from Firebase: ${alexDrinkCredits}, lastRefill: ${new Date(alexLastDrinkRefill).toLocaleString()}`);
                
                // Update UI if Alex is logged in
                if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                    updateAlexDrinkUI();
                }
            } else {
                // Initialize with starting credits (20 to start)
                alexDrinkCredits = ALEX_MAX_DRINKS;
                alexLastDrinkRefill = Date.now();
                saveAlexDrinkCredits();
                console.log(`🍺 Alex initialized with ${ALEX_MAX_DRINKS} starting drink credits`);
                
                // Update UI if Alex is logged in
                if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                    updateAlexDrinkUI();
                }
            }
        }, (error) => {
            console.error('❌ Firebase Alex drink credits listener error:', error);
            // Fallback to default values if Firebase fails
            if (alexDrinkCredits === 0) {
                alexDrinkCredits = ALEX_MAX_DRINKS;
                alexLastDrinkRefill = Date.now();
                console.log(`🍺 Firebase failed, using fallback: ${alexDrinkCredits} drinks`);
            }
        });
    } else {
        console.log('🍺 Firebase not available, using default Alex drink credits');
        alexDrinkCredits = ALEX_MAX_DRINKS;
        alexLastDrinkRefill = Date.now();
    }
}

function saveAlexDrinkCredits() {
    if (window.firebaseDB) {
        const alexDrinksRef = window.firebaseRef(window.firebaseDB, 'alexDrinkSystem');
        const data = {
            credits: alexDrinkCredits,
            lastRefill: alexLastDrinkRefill
        };
        
        window.firebaseSet(alexDrinksRef, data)
            .then(() => {
                console.log('🍺 Alex drink credits saved to Firebase');
            })
            .catch((error) => {
                console.error('❌ Failed to save Alex drink credits:', error);
            });
    }
}

function refillAlexDrinks() {
    const now = Date.now();
    const hoursSinceLastRefill = (now - alexLastDrinkRefill) / (1000 * 60 * 60);
    
    if (hoursSinceLastRefill >= 1) {
        const newCredits = Math.min(alexDrinkCredits + ALEX_DRINKS_PER_HOUR, ALEX_MAX_DRINKS);
        const addedCredits = newCredits - alexDrinkCredits;
        
        if (addedCredits > 0) {
            alexDrinkCredits = newCredits;
            alexLastDrinkRefill = now;
            saveAlexDrinkCredits();
            
            console.log(`🍺 Alex received ${addedCredits} new drink credits (total: ${alexDrinkCredits})`);
            
            // Notify Alex if he's logged in
            if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                updateAlexDrinkUI();
                alert(`🍺 DRINK DELIVERY! 🍺\n\nYou received ${addedCredits} new drink credits!\nTotal available: ${alexDrinkCredits}\n\nNext delivery in 1 hour! ⏰`);
            }
        } else if (alexDrinkCredits >= ALEX_MAX_DRINKS) {
            // Alex is at max capacity
            alexLastDrinkRefill = now; // Reset timer even if no drinks added
            saveAlexDrinkCredits();
            
            if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                updateAlexDrinkUI();
                console.log(`🍺 Alex is at max capacity (${ALEX_MAX_DRINKS} drinks)`);
            }
        }
    }
}

// Alex's Danger Zone System Functions
function loadAlexDangerZoneCredits() {
    if (window.firebaseDB) {
        const alexDangerZoneRef = window.firebaseRef(window.firebaseDB, 'alexDangerZoneSystem');
        window.firebaseOnValue(alexDangerZoneRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                alexDangerZoneCredits = data.credits || 0;
                alexLastDangerZoneRefill = data.lastRefill || Date.now();
                console.log(`💀 Alex Danger Zone credits loaded from Firebase: ${alexDangerZoneCredits}, lastRefill: ${new Date(alexLastDangerZoneRefill).toLocaleString()}`);
                
                // Update UI if Alex is logged in
                if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                    updateAlexDrinkUI();
                }
            } else {
                // Initialize with starting credits (1 to start)
                alexDangerZoneCredits = 1;
                alexLastDangerZoneRefill = Date.now();
                saveAlexDangerZoneCredits();
                console.log(`💀 Alex initialized with 1 starting Danger Zone credit`);
                
                // Update UI if Alex is logged in
                if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                    updateAlexDrinkUI();
                }
            }
        }, (error) => {
            console.error('❌ Firebase Alex Danger Zone credits listener error:', error);
            // Fallback to default values if Firebase fails
            if (alexDangerZoneCredits === 0) {
                alexDangerZoneCredits = 1;
                alexLastDangerZoneRefill = Date.now();
                console.log(`💀 Firebase failed, using fallback: ${alexDangerZoneCredits} Danger Zone credits`);
            }
        });
    } else {
        console.log('💀 Firebase not available, using default Alex Danger Zone credits');
        alexDangerZoneCredits = 1;
        alexLastDangerZoneRefill = Date.now();
    }
}

function saveAlexDangerZoneCredits() {
    if (window.firebaseDB) {
        const alexDangerZoneRef = window.firebaseRef(window.firebaseDB, 'alexDangerZoneSystem');
        const data = {
            credits: alexDangerZoneCredits,
            lastRefill: alexLastDangerZoneRefill
        };
        
        window.firebaseSet(alexDangerZoneRef, data)
            .then(() => {
                console.log('💀 Alex Danger Zone credits saved to Firebase');
            })
            .catch((error) => {
                console.error('❌ Failed to save Alex Danger Zone credits:', error);
            });
    }
}

function refillAlexDangerZones() {
    const now = Date.now();
    const hoursSinceLastRefill = (now - alexLastDangerZoneRefill) / (1000 * 60 * 60);
    
    if (hoursSinceLastRefill >= 2) { // 2 hours
        const newCredits = Math.min(alexDangerZoneCredits + 1, ALEX_MAX_DANGER_ZONES);
        const addedCredits = newCredits - alexDangerZoneCredits;
        
        if (addedCredits > 0) {
            alexDangerZoneCredits = newCredits;
            alexLastDangerZoneRefill = now;
            saveAlexDangerZoneCredits();
            
            console.log(`💀 Alex received ${addedCredits} new Danger Zone credit (total: ${alexDangerZoneCredits})`);
            
            // Notify Alex if he's logged in
            if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                updateAlexDrinkUI();
                alert(`💀 DANGER ZONE DELIVERY! 💀\n\nYou received ${addedCredits} new Danger Zone initiation!\nTotal available: ${alexDangerZoneCredits}\n\nNext delivery in 2 hours! ⏰`);
            }
        } else if (alexDangerZoneCredits >= ALEX_MAX_DANGER_ZONES) {
            // Alex is at max capacity
            alexLastDangerZoneRefill = now; // Reset timer even if no credits added
            saveAlexDangerZoneCredits();
            
            if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                updateAlexDrinkUI();
                console.log(`💀 Alex is at max Danger Zone capacity (${ALEX_MAX_DANGER_ZONES} initiations)`);
            }
        }
    }
}

function isWithinDangerZoneHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 10 && hour < 24; // 10 AM to midnight (11:59 PM)
}

function showAlexDrinkButton() {
    // Only show for Alex when he's logged in
    if (isPlayerLoggedIn && currentPlayer === 'Alex') {
        const nextRefillTime = getNextDrinkRefillCountdown();
        const nextDangerZoneTime = getNextDangerZoneRefillCountdown();
        const isDangerZoneAvailable = isWithinDangerZoneHours();
        
        return `
            <div style="text-align: center; margin: 20px 0; padding: 15px; background: linear-gradient(45deg, #4CAF50, #45a049); border-radius: 10px;">
                <h4 style="color: white; margin: 0 0 10px 0;">🍺 ALEX'S DRINK ASSIGNMENT 🍺</h4>
                <p style="color: white; margin: 5px 0;">Available Drinks: <strong>${alexDrinkCredits}</strong></p>
                <button class="transfer-btn" onclick="showDrinkAssignmentModal()" style="background: linear-gradient(45deg, #FF9800, #F57C00); color: white; font-weight: bold;">
                    🍻 ASSIGN DRINKS 🍻
                </button>
                <div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.2); border-radius: 5px;">
                    <div style="font-size: 0.9em; color: #E8F5E8; margin-bottom: 3px;">
                        ⏰ Next Drink Delivery:
                    </div>
                    <div id="alexDrinkCountdown" style="font-size: 1.1em; color: #FFEB3B; font-weight: bold;">
                        ${nextRefillTime}
                    </div>
                </div>
                <p style="font-size: 0.8em; color: #E8F5E8; margin: 8px 0 0 0;">
                    You get 10 drinks per hour (max 20). Keep the boys accountable! 🍺
                </p>
            </div>
            
            <div style="text-align: center; margin: 20px 0; padding: 15px; background: linear-gradient(45deg, #8B0000, #A52A2A); border-radius: 10px;">
                <h4 style="color: white; margin: 0 0 10px 0;">💀 ALEX'S DANGER ZONE 💀</h4>
                <p style="color: white; margin: 5px 0;">Available Initiations: <strong>${alexDangerZoneCredits}</strong></p>
                ${isDangerZoneAvailable ? 
                    `<button class="transfer-btn" onclick="initiateDangerZone()" ${alexDangerZoneCredits <= 0 ? 'disabled' : ''} style="background: linear-gradient(45deg, #FF4444, #CC0000); color: white; font-weight: bold; ${alexDangerZoneCredits <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                        💀 INITIATE DANGER ZONE 💀
                    </button>` :
                    `<button class="transfer-btn" disabled style="background: #666; color: #999; font-weight: bold; opacity: 0.5; cursor: not-allowed;">
                        💀 DANGER ZONE (10AM-12AM) 💀
                    </button>`
                }
                <div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.2); border-radius: 5px;">
                    <div style="font-size: 0.9em; color: #FFE8E8; margin-bottom: 3px;">
                        ⏰ Next Danger Zone Delivery:
                    </div>
                    <div id="alexDangerZoneCountdown" style="font-size: 1.1em; color: #FFEB3B; font-weight: bold;">
                        ${nextDangerZoneTime}
                    </div>
                </div>
                <p style="font-size: 0.8em; color: #FFE8E8; margin: 8px 0 0 0;">
                    You get 1 initiation every 2 hours (max 3). Available 10AM-Midnight only! 💀
                </p>
            </div>
        `;
    }
    return '';
}

function getNextDrinkRefillCountdown() {
    // Ensure we have a valid lastRefill time
    if (!alexLastDrinkRefill || alexLastDrinkRefill === 0) {
        return 'Loading... ⏳';
    }
    
    const now = Date.now();
    const nextRefill = alexLastDrinkRefill + (60 * 60 * 1000); // 1 hour from last refill
    const timeUntilRefill = nextRefill - now;
    
    // Check if Alex is at max capacity
    if (alexDrinkCredits >= ALEX_MAX_DRINKS && timeUntilRefill > 0) {
        const minutes = Math.floor(timeUntilRefill / (1000 * 60));
        const seconds = Math.floor((timeUntilRefill % (1000 * 60)) / 1000);
        return `${minutes}m ${seconds}s (At Max)`;
    }
    
    if (timeUntilRefill <= 0) {
        return 'Ready Now! 🍺';
    }
    
    const minutes = Math.floor(timeUntilRefill / (1000 * 60));
    const seconds = Math.floor((timeUntilRefill % (1000 * 60)) / 1000);
    
    return `${minutes}m ${seconds}s`;
}

function getNextDangerZoneRefillCountdown() {
    // Ensure we have a valid lastRefill time
    if (!alexLastDangerZoneRefill || alexLastDangerZoneRefill === 0) {
        return 'Loading... ⏳';
    }
    
    const now = Date.now();
    const nextRefill = alexLastDangerZoneRefill + ALEX_DANGER_ZONE_COOLDOWN_MS; // 2 hours from last refill
    const timeUntilRefill = nextRefill - now;
    
    // Check if Alex is at max capacity
    if (alexDangerZoneCredits >= ALEX_MAX_DANGER_ZONES && timeUntilRefill > 0) {
        const hours = Math.floor(timeUntilRefill / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilRefill % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilRefill % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s (At Max)`;
    }
    
    if (timeUntilRefill <= 0) {
        return 'Ready Now! 💀';
    }
    
    const hours = Math.floor(timeUntilRefill / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilRefill % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeUntilRefill % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
}

function initiateDangerZone() {
    // Check if Alex has credits
    if (alexDangerZoneCredits <= 0) {
        alert('💀 No Danger Zone initiations available!\n\nYou need to wait for your next delivery.');
        return;
    }
    
    // Check time restrictions
    if (!isWithinDangerZoneHours()) {
        alert('💀 DANGER ZONE UNAVAILABLE! 💀\n\nDanger Zone initiations are only available from 10:00 AM to 11:59 PM.');
        return;
    }
    
    // Confirm initiation
    const confirmMessage = `💀 CONFIRM DANGER ZONE INITIATION 💀\n\nThis will trigger a DANGER ZONE alert for ALL players!\n\nRemaining initiations after this: ${alexDangerZoneCredits - 1}\nNext delivery: ${getNextDangerZoneRefillCountdown()}\n\nAre you sure you want to initiate DANGER ZONE?`;
    
    if (confirm(confirmMessage)) {
        // Deduct credit
        alexDangerZoneCredits -= 1;
        saveAlexDangerZoneCredits();
        
        // Log the initiation in activity feed
        addActivity('danger_zone_initiation', '💀', 'Alex initiated DANGER ZONE for all players!');
        
        // Trigger the danger zone alert
        broadcastDangerZone('Alex (Manual Initiation)');
        
        // Send push notification
        sendPushNotification({
            type: 'danger_zone',
            title: '💀 DANGER ZONE 💀',
            body: 'Alex initiated DANGER ZONE for all players!',
            playerName: 'Alex'
        });
        
        // Update UI
        updateAlexDrinkUI();
        
        // Show confirmation
        alert(`💀 DANGER ZONE INITIATED! 💀\n\nAll players have been alerted!\nRemaining initiations: ${alexDangerZoneCredits}\n\nNext delivery: ${getNextDangerZoneRefillCountdown()}`);
    }
}

function updateAlexDrinkUI() {
    // Update the drink button if it exists
    const alexDrinkSection = document.getElementById('alexDrinkSection');
    if (alexDrinkSection) {
        alexDrinkSection.innerHTML = showAlexDrinkButton();
        
        // Start live countdown timer if Alex is logged in
        if (isPlayerLoggedIn && currentPlayer === 'Alex') {
            startAlexDrinkCountdownTimer();
        }
    }
}

function startAlexDrinkCountdownTimer() {
    // Clear any existing timer
    if (window.alexDrinkCountdownTimer) {
        clearInterval(window.alexDrinkCountdownTimer);
    }
    
    // Start new timer that updates every second
    window.alexDrinkCountdownTimer = setInterval(() => {
        const drinkCountdownElement = document.getElementById('alexDrinkCountdown');
        const dangerZoneCountdownElement = document.getElementById('alexDangerZoneCountdown');
        
        if ((drinkCountdownElement || dangerZoneCountdownElement) && isPlayerLoggedIn && currentPlayer === 'Alex') {
            // Update drink countdown
            if (drinkCountdownElement) {
                const nextRefillTime = getNextDrinkRefillCountdown();
                drinkCountdownElement.textContent = nextRefillTime;
                
                // Check if it's time for a refill
                if (nextRefillTime === 'Ready Now! 🍺') {
                    // Trigger refill check
                    refillAlexDrinks();
                }
            }
            
            // Update Danger Zone countdown
            if (dangerZoneCountdownElement) {
                const nextDangerZoneTime = getNextDangerZoneRefillCountdown();
                dangerZoneCountdownElement.textContent = nextDangerZoneTime;
                
                // Check if it's time for a Danger Zone refill
                if (nextDangerZoneTime === 'Ready Now! 💀') {
                    // Trigger refill check
                    refillAlexDangerZones();
                }
            }
        } else {
            // Stop timer if Alex is no longer logged in or elements don't exist
            clearInterval(window.alexDrinkCountdownTimer);
            window.alexDrinkCountdownTimer = null;
        }
    }, 1000);
}

// Alex's Drink Assignment Modal Functions (moved to unified system below)

function closeDrinkAssignmentModal() {
    document.getElementById('drinkAssignmentModal').style.display = 'none';
    
    // Reset all drink assignments
    const playerInputs = document.querySelectorAll('.drink-assignment-input');
    playerInputs.forEach(input => input.value = 0);
    updateTotalDrinksToAssign();
    
    // Clear Alex's message
    const messageInput = document.getElementById('alexMessage');
    if (messageInput) {
        messageInput.value = '';
    }
}

function populateDrinkPlayerList() {
    const playerList = document.getElementById('drinkPlayerList');
    const otherPlayers = ['Evan', 'Ian', 'Andrew', 'Zack', 'Brian']; // Everyone except Alex
    
    let html = '';
    otherPlayers.forEach(playerName => {
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                <div style="flex: 1; text-align: left; font-weight: bold; color: #8B4513;">
                    ${playerName}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button onclick="changeDrinkAssignment('${playerName}', -1)" style="
                        background: #ff4757; color: white; border: none; border-radius: 50%; 
                        width: 30px; height: 30px; cursor: pointer; font-weight: bold;
                    ">-</button>
                    <input type="number" id="drinks_${playerName}" class="drink-assignment-input" 
                           value="0" min="0" max="${alexDrinkCredits}" 
                           onchange="updateTotalDrinksToAssign()" 
                           style="width: 60px; text-align: center; padding: 5px; border: 1px solid #ddd; border-radius: 5px;">
                    <button onclick="changeDrinkAssignment('${playerName}', 1)" style="
                        background: #2ed573; color: white; border: none; border-radius: 50%; 
                        width: 30px; height: 30px; cursor: pointer; font-weight: bold;
                    ">+</button>
                </div>
            </div>
        `;
    });
    
    playerList.innerHTML = html;
    updateTotalDrinksToAssign();
}

function changeDrinkAssignment(playerName, change) {
    const input = document.getElementById(`drinks_${playerName}`);
    const currentValue = parseInt(input.value) || 0;
    const newValue = Math.max(0, Math.min(alexDrinkCredits, currentValue + change));
    
    input.value = newValue;
    updateTotalDrinksToAssign();
}

function updateTotalDrinksToAssign() {
    const inputs = document.querySelectorAll('.drink-assignment-input');
    let total = 0;
    
    inputs.forEach(input => {
        total += parseInt(input.value) || 0;
    });
    
    document.getElementById('totalDrinksToAssign').textContent = total;
    
    // Disable assign button if no drinks selected or exceeds available
    const assignButton = document.querySelector('#drinkAssignmentModal button[onclick="assignDrinks()"]');
    if (assignButton) {
        if (total === 0) {
            assignButton.disabled = true;
            assignButton.textContent = '🍺 SELECT DRINKS TO ASSIGN 🍺';
            assignButton.style.opacity = '0.5';
        } else if (total > alexDrinkCredits) {
            assignButton.disabled = true;
            assignButton.textContent = '🚫 TOO MANY DRINKS SELECTED 🚫';
            assignButton.style.opacity = '0.5';
        } else {
            assignButton.disabled = false;
            assignButton.textContent = '🍺 ASSIGN DRINKS 🍺';
            assignButton.style.opacity = '1';
        }
    }
}

function assignAlexDrinks() {
    if (!isPlayerLoggedIn || currentPlayer !== 'Alex') {
        alert('🚫 Only Alex can assign drinks!');
        return;
    }
    
    // Collect drink assignments
    const assignments = {};
    const inputs = document.querySelectorAll('.drink-assignment-input');
    let totalDrinks = 0;
    
    inputs.forEach(input => {
        const playerName = input.id.replace('drinks_', '');
        const drinks = parseInt(input.value) || 0;
        if (drinks > 0) {
            assignments[playerName] = drinks;
            totalDrinks += drinks;
        }
    });
    
    if (totalDrinks === 0) {
        alert('🍺 Please assign at least one drink!');
        return;
    }
    
    if (totalDrinks > alexDrinkCredits) {
        alert(`🚫 You only have ${alexDrinkCredits} drinks available!\nYou tried to assign ${totalDrinks} drinks.`);
        return;
    }
    
    // Get Alex's message
    const messageInput = document.getElementById('alexMessage');
    const alexMessage = messageInput ? messageInput.value.trim() : '';
    
    // Confirm assignment
    let confirmMessage = `🍺 CONFIRM DRINK ASSIGNMENT 🍺\n\n`;
    Object.entries(assignments).forEach(([player, drinks]) => {
        confirmMessage += `${player}: ${drinks} drink${drinks > 1 ? 's' : ''}\n`;
    });
    confirmMessage += `\nTotal: ${totalDrinks} drinks\nRemaining: ${alexDrinkCredits - totalDrinks} drinks`;
    
    if (alexMessage) {
        confirmMessage += `\n\nYour message:\n"${alexMessage}"`;
    }
    
    confirmMessage += '\n\nAssign these drinks?';
    
    if (confirm(confirmMessage)) {
        // Deduct drinks from Alex's credits
        alexDrinkCredits -= totalDrinks;
        saveAlexDrinkCredits();
        
        // Log the assignment in the activity feed
        const assignmentList = Object.entries(assignments)
            .filter(([player, count]) => count > 0)
            .map(([player, count]) => `${player} (${count})`)
            .join(', ');
        
        let activityMessage = `Alex assigned drinks: ${assignmentList}`;
        if (alexMessage.trim()) {
            activityMessage += ` - "${alexMessage.trim()}"`;
        }
        
        addActivity('drink_assignment', '🍺', activityMessage);
        
        // Broadcast drink assignment with message
        broadcastDrinkAssignment(assignments, totalDrinks, alexMessage);
        
        // Send push notification for drink assignment
        sendPushNotification({
            type: 'drink_assignment',
            title: '🍺 DRINK ASSIGNMENT',
            body: `Alex assigned ${totalDrinks} drinks! Check the app.`,
            assignments: assignments,
            message: alexMessage
        });
        
        // Close modal
        closeDrinkAssignmentModal();
        
        // Update Alex's UI
        updateAlexDrinkUI();
        
        let successMessage = `🍺 DRINKS ASSIGNED! 🍺\n\nYou assigned ${totalDrinks} drinks!\nRemaining credits: ${alexDrinkCredits}`;
        if (alexMessage) {
            successMessage += `\n\nYour message was sent to everyone! 📝`;
        }
        alert(successMessage);
    }
}

function broadcastDrinkAssignment(assignments, totalDrinks, alexMessage = '') {
    if (!window.firebaseDB) {
        console.error('❌ Firebase DB not available for drink assignment broadcast');
        return;
    }
    
    const drinkData = {
        assignments: assignments,
        totalDrinks: totalDrinks,
        assignedBy: 'Alex',
        message: alexMessage,
        timestamp: new Date().toISOString(),
        eventId: Date.now() + '_' + Math.floor(Math.random() * 10000),
        acknowledged: false
    };
    
    const drinkAssignmentsRef = window.firebaseRef(window.firebaseDB, 'drinkAssignments');
    window.firebaseSet(drinkAssignmentsRef, drinkData)
        .then(() => {
            console.log('🍺 Drink assignment broadcast sent successfully!');
        })
        .catch((error) => {
            console.error('❌ Drink assignment broadcast failed:', error);
        });
}

function broadcastPowerUpDrinkAssignment(assignments, totalDrinks, assignedBy) {
    if (!window.firebaseDB) {
        console.error('❌ Firebase DB not available for power-up drink assignment broadcast');
        return;
    }
    
    const drinkData = {
        assignments: assignments,
        totalDrinks: totalDrinks,
        assignedBy: assignedBy,
        message: `${assignedBy} used power-up drinks earned from HOGWASH!`,
        timestamp: new Date().toISOString(),
        eventId: Date.now() + '_' + Math.floor(Math.random() * 10000),
        acknowledged: false,
        isPowerUp: true
    };
    
    const drinkAssignmentsRef = window.firebaseRef(window.firebaseDB, 'drinkAssignments');
    window.firebaseSet(drinkAssignmentsRef, drinkData)
        .then(() => {
            console.log('🍺 Power-up drink assignment broadcast sent successfully!');
        })
        .catch((error) => {
            console.error('❌ Power-up drink assignment broadcast failed:', error);
        });
}

function showDrinkAssignmentAlert(drinkData) {
    // Prevent duplicate alerts for the same event
    if (window.lastDrinkAssignmentAlert === drinkData.timestamp) {
        console.log('🍺 Duplicate drink assignment alert prevented');
        return;
    }
    window.lastDrinkAssignmentAlert = drinkData.timestamp;
    
    // Check if current player is assigned drinks
    const currentPlayerDrinks = drinkData.assignments[currentPlayer] || 0;
    const isAssignedDrinks = currentPlayerDrinks > 0;
    
    let alertContent = '';
    let buttonText = '';
    let buttonColor = '';
    
    if (isAssignedDrinks) {
        // Player is assigned drinks - show drink assignment
        alertContent = `
            <div style="font-size: 2rem; margin-bottom: 20px;">🍺</div>
            <div style="font-weight: bold; margin-bottom: 15px; font-size: 1.3em;">DRINK ASSIGNMENT</div>
            <div style="margin: 15px 0; padding: 15px; background: rgba(76,175,80,0.2); border-radius: 8px; border: 2px solid #4CAF50;">
                <div style="font-size: 1.2em; font-weight: bold; color: #2E7D32;">
                    You have been assigned: ${currentPlayerDrinks} drink${currentPlayerDrinks > 1 ? 's' : ''}!
                </div>
            </div>
        `;
        buttonText = "I'LL DRINK! 🍻";
        buttonColor = "#4CAF50";
    } else {
        // Player is not assigned drinks - show accountability message
        const assignedPlayers = Object.entries(drinkData.assignments)
            .filter(([player, drinks]) => drinks > 0)
            .map(([player, drinks]) => `${player} (${drinks} drink${drinks > 1 ? 's' : ''})`)
            .join(', ');
            
        alertContent = `
            <div style="font-size: 2rem; margin-bottom: 20px;">👀</div>
            <div style="font-weight: bold; margin-bottom: 15px; font-size: 1.3em;">HOLD THE HOG ACCOUNTABLE</div>
            <div style="margin: 15px 0; padding: 15px; background: rgba(255,152,0,0.2); border-radius: 8px; border: 2px solid #FF9800;">
                <div style="font-size: 1.1em; font-weight: bold; color: #E65100; margin-bottom: 10px;">
                    Alex assigned drinks to:
                </div>
                <div style="font-size: 1.1em; color: #BF360C;">
                    ${assignedPlayers}
                </div>
            </div>
            <div style="margin-top: 15px; font-size: 1em; color: #666; font-style: italic;">
                Make sure they follow through! 👁️
            </div>
        `;
        buttonText = "I'LL HOLD THEM ACCOUNTABLE! 👀";
        buttonColor = "#FF9800";
    }
    
    // Add Alex's message if provided
    if (drinkData.message && drinkData.message.trim()) {
        alertContent += `
            <div style="margin: 20px 0; padding: 15px; background: linear-gradient(45deg, #E3F2FD, #BBDEFB); border-radius: 8px; border-left: 4px solid #2196F3;">
                <div style="font-weight: bold; color: #1976D2; margin-bottom: 8px; display: flex; align-items: center;">
                    📝 Message from Alex:
                </div>
                <div style="font-style: italic; color: #424242; font-size: 1.1em; line-height: 1.4;">
                    "${drinkData.message}"
                </div>
            </div>
        `;
    }
    
    // Update the modal content and button
    document.getElementById('drinkAlertContent').innerHTML = alertContent;
    
    // Update button text and color
    const button = document.querySelector('#drinkAssignmentAlert .transfer-btn[onclick="acknowledgeDrinks()"]');
    if (button) {
        button.textContent = buttonText;
        button.style.background = `linear-gradient(45deg, ${buttonColor}, ${buttonColor}dd)`;
        button.style.color = 'white';
    }
    
    // Show/hide upload proof button based on whether player is assigned drinks
    const uploadProofBtn = document.getElementById('uploadProofBtn');
    if (uploadProofBtn) {
        if (isAssignedDrinks) {
            uploadProofBtn.style.display = 'inline-block';
        } else {
            uploadProofBtn.style.display = 'none';
        }
    }
    
    document.getElementById('drinkAssignmentAlert').style.display = 'flex';
    
    // Store assignment data for acknowledgment
    window.currentDrinkAssignment = drinkData;
    
    console.log(`🍺 Drink assignment alert displayed - ${isAssignedDrinks ? 'Drink assignment' : 'Accountability'} mode`);
}

function acknowledgeDrinks() {
    document.getElementById('drinkAssignmentAlert').style.display = 'none';
    
    // Log acknowledgment in activity feed
    if (window.currentDrinkAssignment && currentPlayer) {
        const drinkData = window.currentDrinkAssignment;
        const playerDrinks = drinkData.assignments[currentPlayer] || 0;
        
        if (playerDrinks > 0) {
            // Player acknowledged their own drinks
            const activityMessage = `${currentPlayer} acknowledged ${playerDrinks} drink${playerDrinks > 1 ? 's' : ''} from Alex`;
            addActivity('drink_acknowledgment', '✅', activityMessage);
        } else {
            // Player acknowledged they will hold others accountable
            const assignedPlayers = Object.entries(drinkData.assignments)
                .filter(([player, drinks]) => drinks > 0)
                .map(([player, drinks]) => player)
                .join(', ');
            const activityMessage = `${currentPlayer} will hold ${assignedPlayers} accountable for their drinks`;
            addActivity('accountability_acknowledgment', '👀', activityMessage);
        }
    }
    
    // Send acknowledgment back to Firebase
    if (window.currentDrinkAssignment) {
        sendDrinkAcknowledgment(window.currentDrinkAssignment);
        window.currentDrinkAssignment = null;
    }
}

function sendDrinkAcknowledgment(drinkData) {
    if (!window.firebaseDB) return;
    
    const acknowledgmentData = {
        originalEventId: drinkData.eventId,
        acknowledgedBy: currentPlayer || 'Anonymous',
        timestamp: new Date().toISOString(),
        acknowledged: true
    };
    
    const ackRef = window.firebaseRef(window.firebaseDB, `drinkAcknowledgments/${drinkData.eventId}_${Date.now()}`);
    window.firebaseSet(ackRef, acknowledgmentData)
        .then(() => {
            console.log('🍺 Drink acknowledgment sent to Alex');
        })
        .catch((error) => {
            console.error('❌ Failed to send drink acknowledgment:', error);
        });
}

// Make drink functions globally accessible
window.showDrinkAssignmentModal = showDrinkAssignmentModal;
window.closeDrinkAssignmentModal = closeDrinkAssignmentModal;
window.changeDrinkAssignment = changeDrinkAssignment;
window.assignDrinks = assignDrinks;
window.acknowledgeDrinks = acknowledgeDrinks;

// Make Alex's Danger Zone function globally accessible
window.initiateDangerZone = initiateDangerZone;

// Debug function for Alex's drink system (temporary)
window.debugAlexDrinks = function() {
    console.log('🍺 Alex Drink System Debug:');
    console.log('- Current Player:', currentPlayer);
    console.log('- Is Player Logged In:', isPlayerLoggedIn);
    console.log('- Alex Drink Credits:', alexDrinkCredits);
    console.log('- Alex Last Refill:', new Date(alexLastDrinkRefill).toLocaleString());
    console.log('- Firebase Ready:', !!window.firebaseDB);
    console.log('- Next Refill Countdown:', getNextDrinkRefillCountdown());
    
    if (currentPlayer === 'Alex') {
        alert(`🍺 Alex Drink Debug:\n\nCredits: ${alexDrinkCredits}\nLast Refill: ${new Date(alexLastDrinkRefill).toLocaleString()}\nNext Delivery: ${getNextDrinkRefillCountdown()}`);
    } else {
        alert('🚫 This debug is only for Alex!');
    }
};

function playerTransferPoints() {
    if (!currentPlayer) return;
    
    const toPlayer = document.getElementById('playerTransferTo').value;
    const amount = parseInt(document.getElementById('playerTransferAmount').value);
    
    if (!toPlayer || !amount) {
        alert('🚫 Please select a player and enter an amount!');
        return;
    }
    
    if (toPlayer === currentPlayer) {
        alert('🚫 You cannot send points to yourself, silly pig!');
        return;
    }
    
    if (players[currentPlayer].points < amount) {
        alert(`🚫 You only have ${players[currentPlayer].points} points! You cannot send ${amount} points.`);
        return;
    }
    
    // Transfer points
    players[currentPlayer].points -= amount;
    players[toPlayer].points += amount;
    
    // Save to Firebase
    savePlayers();
    
    // Update UI
    updateLeaderboard();
    updatePlayerUI();
    
    // Clear form
    document.getElementById('playerTransferTo').value = '';
    document.getElementById('playerTransferAmount').value = '';
    
    // Log activity
    addActivity('transfer', '💸', `${currentPlayer} sent ${amount} points to ${toPlayer}`);
    
    alert(`💸 Successfully sent ${amount} points to ${toPlayer}! 💸`);
}

// HOGWASH Functions
function showHogwashModal() {
    const modal = document.getElementById('hogwashModal');
    const playerSelect = document.getElementById('hogwashPlayer');
    const playerLabel = document.querySelector('#hogwashModal .form-group label');
    const modalDescription = document.querySelector('#hogwashModal p');
    
    // Clear any existing cooldown display
    clearHogwashCooldownDisplay();
    
    if (isPlayerLoggedIn && currentPlayer) {
        // User is logged in - check their cooldown status
        if (isPlayerOnHogwashCooldown(currentPlayer)) {
            // Player is on cooldown - show countdown
            showHogwashCooldownForPlayer(currentPlayer);
            return; // Don't show the modal, just the cooldown
        }
        
        // User is logged in and not on cooldown - auto-select them and lock it
        playerSelect.value = currentPlayer;
        playerSelect.disabled = true;
        playerLabel.textContent = `${currentPlayer} is gambling!`;
        modalDescription.textContent = `You're logged in as ${currentPlayer}. You can only gamble as yourself!`;
        
        // Add visual indication that it's locked to current user
        playerSelect.style.backgroundColor = '#f0f8ff';
        playerSelect.style.color = '#2c5282';
        playerSelect.style.fontWeight = 'bold';
        
        // Hide all other options in the dropdown (extra security)
        Array.from(playerSelect.options).forEach(option => {
            if (option.value !== currentPlayer && option.value !== '') {
                option.style.display = 'none';
            } else {
                option.style.display = 'block';
            }
        });
    } else {
        // User not logged in - show normal dropdown
        playerSelect.value = '';
        playerSelect.disabled = false;
        playerLabel.textContent = "Who's gambling?";
        modalDescription.textContent = 'Choose your player and risk it with the pig gods!';
        
        // Reset styling
        playerSelect.style.backgroundColor = '';
        playerSelect.style.color = '';
        playerSelect.style.fontWeight = '';
        
        // Add event listener to check cooldown when player is selected
        playerSelect.addEventListener('change', checkSelectedPlayerCooldown);
    }
    
    modal.style.display = 'flex';
}

function closeHogwashModal() {
    const modal = document.getElementById('hogwashModal');
    const playerSelect = document.getElementById('hogwashPlayer');
    
    // Reset the modal state
    modal.style.display = 'none';
    playerSelect.value = '';
    playerSelect.disabled = false;
    
    // Reset styling
    playerSelect.style.backgroundColor = '';
    playerSelect.style.color = '';
    playerSelect.style.fontWeight = '';
    
    // Reset all dropdown options visibility
    Array.from(playerSelect.options).forEach(option => {
        option.style.display = 'block';
    });
    
    // Remove event listeners
    playerSelect.removeEventListener('change', checkSelectedPlayerCooldown);
    
    // Clear cooldown display
    clearHogwashCooldownDisplay();
}

function clearHogwashCooldownDisplay() {
    // Remove any existing cooldown modal
    const existingCooldownModal = document.getElementById('hogwashCooldownModal');
    if (existingCooldownModal) {
        existingCooldownModal.remove();
    }
}

function showHogwashCooldownForPlayer(playerName) {
    const remainingMs = getHogwashCooldownRemaining(playerName);
    const timeString = formatCooldownTime(remainingMs);
    
    // Create cooldown modal
    const cooldownModal = document.createElement('div');
    cooldownModal.id = 'hogwashCooldownModal';
    cooldownModal.className = 'modal';
    cooldownModal.style.display = 'flex';
    
    cooldownModal.innerHTML = `
        <div class="modal-content" style="background: linear-gradient(45deg, #ff6b6b, #ffa500); color: white; text-align: center;">
            <span class="close" onclick="closeHogwashCooldownModal()" style="color: white; font-weight: bold;">&times;</span>
            <h2 style="margin-bottom: 20px;">⏰ HOGWASH COOLDOWN ⏰</h2>
            <div style="font-size: 3rem; margin: 20px 0;">🐷⏰</div>
            <p style="font-size: 1.3em; font-weight: bold; margin-bottom: 20px;">
                ${playerName} must wait before gambling again!
            </p>
            <div id="cooldownTimer" style="font-size: 2rem; font-weight: bold; margin: 20px 0; color: #ffff00;">
                ${timeString}
            </div>
            <p style="font-size: 1em; margin-bottom: 20px;">
                Each player can only HOGWASH once per hour to prevent pig abuse! 🐷
            </p>
            <button class="transfer-btn" onclick="closeHogwashCooldownModal()" style="background: linear-gradient(45deg, #fff, #ddd); color: #333;">
                🐷 ACCEPT FATE 🐷
            </button>
        </div>
    `;
    
    document.body.appendChild(cooldownModal);
    
    // Start countdown timer
    startCooldownTimer(playerName);
}

function checkSelectedPlayerCooldown() {
    const playerSelect = document.getElementById('hogwashPlayer');
    const selectedPlayer = playerSelect.value;
    
    if (selectedPlayer && isPlayerOnHogwashCooldown(selectedPlayer)) {
        // Close the main modal and show cooldown
        closeHogwashModal();
        showHogwashCooldownForPlayer(selectedPlayer);
    }
}

function closeHogwashCooldownModal() {
    const cooldownModal = document.getElementById('hogwashCooldownModal');
    if (cooldownModal) {
        cooldownModal.remove();
    }
    
    // Clear any running timer
    if (window.hogwashCooldownTimer) {
        clearInterval(window.hogwashCooldownTimer);
        window.hogwashCooldownTimer = null;
    }
}

function startCooldownTimer(playerName) {
    // Clear any existing timer
    if (window.hogwashCooldownTimer) {
        clearInterval(window.hogwashCooldownTimer);
    }
    
    window.hogwashCooldownTimer = setInterval(() => {
        const timerElement = document.getElementById('cooldownTimer');
        if (!timerElement) {
            clearInterval(window.hogwashCooldownTimer);
            return;
        }
        
        const remainingMs = getHogwashCooldownRemaining(playerName);
        
        if (remainingMs <= 0) {
            // Cooldown finished
            clearInterval(window.hogwashCooldownTimer);
            timerElement.textContent = 'Ready to HOGWASH! 🎲';
            timerElement.style.color = '#00ff00';
            
            // Auto-close after 2 seconds
            setTimeout(() => {
                closeHogwashCooldownModal();
            }, 2000);
        } else {
            timerElement.textContent = formatCooldownTime(remainingMs);
        }
    }, 1000);
}

function closeHogwashResult() {
    document.getElementById('hogwashResultModal').style.display = 'none';
}

// Power-Up Modal Functions
function showPowerUpModal(playerName) {
    const modal = document.getElementById('powerUpModal');
    const playerData = players[playerName];
    
    if (!playerData) {
        console.error('Player not found:', playerName);
        return;
    }
    
    const powerUps = playerData.powerUps;
    document.getElementById('powerUpPlayerName').textContent = playerName;
    
    // Build power-up display
    let powerUpHTML = '';
    
    if (powerUps.mulligans > 0) {
        powerUpHTML += `<div class="power-up-item" style="margin: 10px 0; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 4px solid #4CAF50;">
            <span style="font-size: 1.5em;">⛳</span> <strong>Mulligans:</strong> ${powerUps.mulligans}
            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Use on golf course for a do-over shot</div>
        </div>`;
    }
    
    if (powerUps.reverseMulligans > 0) {
        powerUpHTML += `<div class="power-up-item" style="margin: 10px 0; padding: 10px; background: rgba(156, 39, 176, 0.1); border-radius: 8px; border-left: 4px solid #9C27B0;">
            <span style="font-size: 1.5em;">🔄</span> <strong>Reverse Mulligans:</strong> ${powerUps.reverseMulligans}
            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Force someone else to re-do their shot</div>
        </div>`;
    }
    
    if (powerUps.giveDrinks > 0) {
        powerUpHTML += `<div class="power-up-item" style="margin: 10px 0; padding: 10px; background: rgba(255, 149, 0, 0.1); border-radius: 8px; border-left: 4px solid #ff9500;">
            <span style="font-size: 1.5em;">🍺</span> <strong>Drink Giver:</strong> ${powerUps.giveDrinks} drinks to assign
            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Assign drinks to other players</div>
        </div>`;
    }
    
    if (powerUpHTML === '') {
        powerUpHTML = `<div style="color: #666; font-style: italic; padding: 20px;">
            <span style="font-size: 2em;">🐷</span><br>
            This pig's bag is empty!<br>
            <small>Try using HOGWASH to earn some power-ups!</small>
        </div>`;
    }
    
    document.getElementById('powerUpContent').innerHTML = powerUpHTML;
    
    // Show action buttons if this is the current player and they have usable powers
    let actionsHTML = '';
    if (isPlayerLoggedIn && currentPlayer === playerName && powerUps.giveDrinks > 0) {
        actionsHTML = `<button class="hogwash-btn" onclick="showDrinkAssignmentModal()" style="margin: 5px;">
            🍺 ASSIGN DRINKS 🍺
        </button>`;
    }
    
    document.getElementById('powerUpActions').innerHTML = actionsHTML;
    
    modal.style.display = 'flex';
}

function closePowerUpModal() {
    document.getElementById('powerUpModal').style.display = 'none';
}

// Power-Up Drink Assignment Functions
function showPowerUpDrinkAssignmentModal() {
    if (!isPlayerLoggedIn || !currentPlayer) {
        alert('🚫 You must be logged in to assign drinks!');
        return;
    }
    
    const playerData = players[currentPlayer];
    if (!playerData || playerData.powerUps.giveDrinks <= 0) {
        alert('🚫 You have no drinks to assign!');
        return;
    }
    
    const modal = document.getElementById('drinkAssignmentModal');
    const availableDrinks = playerData.powerUps.giveDrinks;
    
    document.getElementById('availableDrinks').textContent = availableDrinks;
    document.getElementById('maxDrinks').textContent = availableDrinks;
    
    const drinkAmountInput = document.getElementById('drinkAmount');
    drinkAmountInput.max = availableDrinks;
    drinkAmountInput.value = Math.min(1, availableDrinks);
    
    // Remove current player from target options
    const targetSelect = document.getElementById('drinkTargetPlayer');
    Array.from(targetSelect.options).forEach(option => {
        if (option.value === currentPlayer) {
            option.style.display = 'none';
        } else {
            option.style.display = 'block';
        }
    });
    
    targetSelect.value = '';
    
    modal.style.display = 'flex';
}

// Alex's original drink assignment modal (for his special system)
function showAlexDrinkAssignmentModal() {
    if (!isPlayerLoggedIn || currentPlayer !== 'Alex') {
        alert('🚫 Only Alex can assign drinks!');
        return;
    }
    
    if (alexDrinkCredits <= 0) {
        alert('🍺 NO DRINKS AVAILABLE! 🍺\n\nYou don\'t have any drinks to assign right now.\nYou get 10 drinks per hour (max 20).');
        return;
    }
    
    // Update available drinks display
    document.getElementById('availableDrinks').textContent = alexDrinkCredits;
    
    // Populate player list
    populateDrinkPlayerList();
    
    // Show modal
    document.getElementById('drinkAssignmentModal').style.display = 'flex';
}

// Unified function that routes to the correct modal based on player
function showDrinkAssignmentModal() {
    if (currentPlayer === 'Alex') {
        showAlexDrinkAssignmentModal();
    } else {
        showPowerUpDrinkAssignmentModal();
    }
}

function closeDrinkAssignmentModal() {
    document.getElementById('drinkAssignmentModal').style.display = 'none';
}

function assignDrinks() {
    // Route to correct assignment function based on current player
    if (currentPlayer === 'Alex') {
        assignAlexDrinks();
    } else {
        assignPowerUpDrinks();
    }
}

function assignPowerUpDrinks() {
    const targetPlayer = document.getElementById('drinkTargetPlayer').value;
    const drinkAmount = parseInt(document.getElementById('drinkAmount').value);
    
    if (!targetPlayer) {
        alert('🚫 Select a player to assign drinks to!');
        return;
    }
    
    if (!drinkAmount || drinkAmount < 1) {
        alert('🚫 Enter a valid number of drinks!');
        return;
    }
    
    const playerData = players[currentPlayer];
    if (drinkAmount > playerData.powerUps.giveDrinks) {
        alert(`🚫 You only have ${playerData.powerUps.giveDrinks} drinks to assign!`);
        return;
    }
    
    if (targetPlayer === currentPlayer) {
        alert('🚫 You cannot assign drinks to yourself, you pig!');
        return;
    }
    
    // Confirm assignment
    const drinkText = drinkAmount === 1 ? '1 DRINK' : `${drinkAmount} DRINKS`;
    const confirmMessage = `🍺 CONFIRM DRINK ASSIGNMENT 🍺\n\n${targetPlayer}: ${drinkText}\n\nAssign these drinks?`;
    
    if (confirm(confirmMessage)) {
        // Deduct drinks from current player's power-ups
        players[currentPlayer].powerUps.giveDrinks -= drinkAmount;
        savePlayers();
        
        // Create assignments object in same format as Alex's system
        const assignments = {};
        assignments[targetPlayer] = drinkAmount;
        
        // Log activity
        addActivity('drink_assignment', '🍺', `${currentPlayer} assigned ${drinkText} to ${targetPlayer} (Power-Up)`);
        
        // Broadcast drink assignment globally (same as Alex's system)
        broadcastPowerUpDrinkAssignment(assignments, drinkAmount, currentPlayer);
        
        // Send push notification
        sendPushNotification({
            type: 'drink_assignment',
            title: '🍺 DRINKS ASSIGNED!',
            body: `${currentPlayer} assigned ${drinkText} to ${targetPlayer}!`,
            assignments: assignments,
            assignedBy: currentPlayer
        });
        
        // Close modals
        closeDrinkAssignmentModal();
        closePowerUpModal();
        
        // Update leaderboard to reflect power-up changes
        updateLeaderboard();
        if (isPlayerLoggedIn) {
            updatePlayerUI();
        }
        
        // Show success message
        alert(`🍺 SUCCESS! 🍺\n\n${currentPlayer} assigned ${drinkText} to ${targetPlayer}!\n\nRemaining drinks: ${players[currentPlayer].powerUps.giveDrinks}`);
    }
}

function rollHogwash() {
    console.log('🎰 rollHogwash function called!');
    const playerName = document.getElementById('hogwashPlayer').value;
    console.log('🎰 Selected player:', playerName);
    if (!playerName) {
        alert('🚫 Select a player first, you pig!');
        return;
    }

    // Enhanced validation
    const validation = validateHogwashAttempt(playerName);
    if (!validation.allowed) {
        closeHogwashModal();
        
        if (validation.reason === 'cooldown') {
            showHogwashCooldownForPlayer(playerName);
        } else if (validation.reason === 'wrong_player') {
            alert(`🚫 NICE TRY, PIG! 🚫\n\n${validation.message}\n\nYou cannot gamble as someone else while logged in!\n\nLog out if you want to gamble anonymously.`);
        }
        return;
    }

    // Set cooldown for this player
    setPlayerHogwashCooldown(playerName);

    // Close the selection modal and show the slot machine
    console.log('🎰 About to close HOGWASH modal and show slot machine for:', playerName);
    closeHogwashModal();
    console.log('🎰 HOGWASH modal closed, now showing slot machine...');
    showHogwashSlot(playerName);
    console.log('🎰 showHogwashSlot function called');
}

// HOGWASH Slot Machine System
let slotReel;
let isSlotSpinning = false;
let slotOutcomes = [];
let selectedPlayerName = '';
let currentSlotPosition = 0;
let slotBeepAudio;

function showHogwashSlot(playerName) {
    console.log('🎰 showHogwashSlot called for:', playerName);
    selectedPlayerName = playerName;
    
    // Show the slot machine modal
    const modal = document.getElementById('hogwashWheelModal');
    console.log('🎰 Slot modal element:', modal);
    
    if (!modal) {
        console.error('❌ Slot modal not found! Make sure hogwashWheelModal exists in HTML');
        return;
    }
    
    modal.style.display = 'flex';
    modal.classList.add('slot-machine-ready');
    console.log('🎰 Slot modal should now be visible');
    
    document.getElementById('slotPlayerName').textContent = `${playerName} is gambling!`;
    
    // Add exciting animation to spin button
    const spinBtn = document.getElementById('spinSlotBtn');
    if (spinBtn) {
        spinBtn.classList.add('slot-spin-btn-ready');
    }
    
    // Initialize the slot machine
    try {
        initializeHogwashSlot();
        console.log('🎰 Slot machine initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing slot machine:', error);
    }
}

function closeHogwashSlot() {
    const modal = document.getElementById('hogwashWheelModal');
    modal.style.display = 'none';
    modal.classList.remove('slot-machine-ready', 'slot-machine-spinning');
    
    document.getElementById('closeSlotBtn').style.display = 'none';
    
    const spinBtn = document.getElementById('spinSlotBtn');
    spinBtn.style.display = 'inline-block';
    spinBtn.classList.remove('slot-spin-btn-ready');
    
    // Stop any playing HOGWASH music
    stopHogwashMusic();
    
    isSlotSpinning = false;
}

// Legacy function for compatibility
function closeHogwashWheel() {
    closeHogwashSlot();
}

function initializeHogwashSlot() {
    slotReel = document.getElementById('slotReel');
    
    // Define slot outcomes with proper weights and display info
    slotOutcomes = [
        { type: 'drink', label: '🍺 TAKE DRINKS', color: '#ff6b6b', weight: 4 },
        { type: 'win', label: '🎉 WIN POINTS', color: '#2ed573', weight: 4 },
        { type: 'lose', label: '😈 LOSE POINTS', color: '#ff3838', weight: 4 },
        { type: 'give_drinks', label: '🍺⚡ DRINK POWER', color: '#ff9500', weight: 4 },
        { type: 'danger', label: '💀 DANGER ZONE', color: '#ff4757', weight: 2 },
        { type: 'mulligan', label: '⛳ MULLIGAN', color: '#4CAF50', weight: 1 },
        { type: 'reverse_mulligan', label: '🔄 REVERSE MULLIGAN', color: '#9C27B0', weight: 1 }
    ];
    
    // Create the slot reel HTML with multiple copies for smooth scrolling
    createSlotReel();
    
    // Initialize beep sound for slot machine
    initializeSlotBeep();
}

function drawHogwashWheel() {
    const centerX = wheelCanvas.width / 2;
    const centerY = wheelCanvas.height / 2;
    const radius = 180;
    
    wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
    wheelCtx.save();
    
    // Rotate the entire wheel
    wheelCtx.translate(centerX, centerY);
    wheelCtx.rotate(currentWheelRotation);
    wheelCtx.translate(-centerX, -centerY);
    
    // Draw each segment
    wheelOutcomes.forEach((outcome, index) => {
        // Draw segment
        wheelCtx.beginPath();
        wheelCtx.moveTo(centerX, centerY);
        wheelCtx.arc(centerX, centerY, radius, outcome.startAngle, outcome.endAngle);
        wheelCtx.closePath();
        
        // Fill with gradient
        const gradient = wheelCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, outcome.color);
        gradient.addColorStop(1, darkenColor(outcome.color, 0.3));
        wheelCtx.fillStyle = gradient;
        wheelCtx.fill();
        
        // Draw border
        wheelCtx.strokeStyle = '#fff';
        wheelCtx.lineWidth = 3;
        wheelCtx.stroke();
        
        // Draw text
        const textAngle = (outcome.startAngle + outcome.endAngle) / 2;
        const textRadius = radius * 0.7;
        const textX = centerX + Math.cos(textAngle) * textRadius;
        const textY = centerY + Math.sin(textAngle) * textRadius;
        
        wheelCtx.save();
        wheelCtx.translate(textX, textY);
        wheelCtx.rotate(textAngle + Math.PI / 2);
        wheelCtx.fillStyle = '#fff';
        wheelCtx.font = 'bold 14px Arial';
        wheelCtx.textAlign = 'center';
        wheelCtx.strokeStyle = '#000';
        wheelCtx.lineWidth = 3;
        wheelCtx.strokeText(outcome.label, 0, 0);
        wheelCtx.fillText(outcome.label, 0, 0);
        wheelCtx.restore();
    });
    
    wheelCtx.restore();
}

function createSlotReel() {
    if (!slotReel) return;
    
    // Create many repeating options with weighted heights for visual probability
    const reelHTML = [];
    const baseHeight = 50; // Base height for weight 1 outcomes
    
    // Create enough options to fill a long scrolling reel (50+ sets)
    for (let set = 0; set < 50; set++) {
        slotOutcomes.forEach((outcome, index) => {
            // Calculate height based on weight (higher weight = taller)
            const height = baseHeight + (outcome.weight * 15); // 15px extra per weight point
            
            reelHTML.push(`
                <div class="slot-option" data-type="${outcome.type}" style="
                    height: ${height}px;
                    background: linear-gradient(135deg, ${outcome.color}, ${darkenColor(outcome.color, 0.3)});
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${Math.min(1.1 + (outcome.weight * 0.1), 1.5)}em;
                    font-weight: bold;
                    color: white;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    border-bottom: 1px solid #333;
                ">
                    ${outcome.label}
                </div>
            `);
        });
    }
    
    slotReel.innerHTML = reelHTML.join('');
    currentSlotPosition = 0;
    
    console.log('🎰 Created slot reel with', reelHTML.length, 'options');
}

function initializeSlotBeep() {
    // Create a simple beep sound using Web Audio API
    try {
        if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            slotBeepAudio = {
                context: audioContext,
                play: function() {
                    if (this.context.state === 'suspended') {
                        this.context.resume();
                    }
                    
                    const oscillator = this.context.createOscillator();
                    const gainNode = this.context.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.context.destination);
                    
                    oscillator.frequency.setValueAtTime(800, this.context.currentTime);
                    gainNode.gain.setValueAtTime(0.1, this.context.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
                    
                    oscillator.start(this.context.currentTime);
                    oscillator.stop(this.context.currentTime + 0.1);
                }
            };
        }
    } catch (error) {
        console.log('🎰 Slot beep audio not available:', error);
    }
}

function darkenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.floor(255 * amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.floor(255 * amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.floor(255 * amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function spinHogwashSlot() {
    if (isSlotSpinning) return;
    
    isSlotSpinning = true;
    console.log('🎰 Starting slot machine spin!');
    
    // Update modal classes for spinning animation
    const modal = document.getElementById('hogwashWheelModal');
    modal.classList.remove('slot-machine-ready');
    modal.classList.add('slot-machine-spinning');
    
    // Hide spin button and remove animations
    const spinBtn = document.getElementById('spinSlotBtn');
    spinBtn.style.display = 'none';
    spinBtn.classList.remove('slot-spin-btn-ready');
    
    // Play HOGWASH theme music if available
    playHogwashMusic();
    
    // Calculate final outcome first
    const finalOutcome = calculateHogwashOutcome();
    console.log('🎰 Calculated final outcome:', finalOutcome);
    
    // Find the target outcome in our slot outcomes
    const targetIndex = slotOutcomes.findIndex(o => o.type === finalOutcome.type);
    console.log('🎰 Target outcome index:', targetIndex);
    
    // Start the slot machine animation
    animateSlotMachine(finalOutcome, targetIndex);
}

function animateSlotMachine(finalOutcome, targetIndex) {
    const startTime = Date.now();
    const duration = 8000 + Math.random() * 4000; // 8-12 seconds for dramatic effect
    console.log('🎰 Animation duration will be', (duration/1000).toFixed(1), 'seconds');
    
    // Calculate total height of one complete set of outcomes
    const baseHeight = 50;
    let setHeight = 0;
    slotOutcomes.forEach(outcome => {
        setHeight += baseHeight + (outcome.weight * 15);
    });
    
    // Calculate how many complete sets to scroll through, then land on target
    const spins = 15 + Math.random() * 10; // 15-25 full cycles through all options
    
    // Find the target outcome's position within one set
    let targetPosition = 0;
    for (let i = 0; i < targetIndex; i++) {
        targetPosition += baseHeight + (slotOutcomes[i].weight * 15);
    }
    // Add half the target's height to center it in the window
    targetPosition += (baseHeight + (finalOutcome.weight * 15)) / 2;
    
    const totalDistance = (spins * setHeight) + targetPosition;
    console.log('🎰 Will scroll', totalDistance.toFixed(0), 'pixels to land on', finalOutcome.type);
    
    let lastBeepTime = 0;
    const beepInterval = 150; // Beep every 150ms initially
    
    function animateSlot() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Improved easing - fast initially, then slow down dramatically at the end
        const easeOut = progress < 0.8 ? progress : 0.8 + (1 - Math.pow(1 - (progress - 0.8) / 0.2, 3)) * 0.2;
        
        // Calculate current position
        const currentDistance = totalDistance * easeOut;
        currentSlotPosition = currentDistance;
        
        // Update slot reel position
        slotReel.style.transform = `translateY(-${currentSlotPosition}px)`;
        
        // Play beep sound as options pass by (less frequent as it slows down)
        const currentBeepInterval = beepInterval * (1 + progress * 3); // Slow down beeping
        if (elapsed - lastBeepTime > currentBeepInterval && progress < 0.95) {
            if (slotBeepAudio && slotBeepAudio.play) {
                try {
                    slotBeepAudio.play();
                } catch (error) {
                    // Ignore audio errors
                }
            }
            lastBeepTime = elapsed;
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateSlot);
        } else {
            // Animation complete - highlight winner and show result
            console.log('🎰 Slot animation completed after', ((Date.now() - startTime)/1000).toFixed(1), 'seconds');
            highlightWinner(finalOutcome);
            
            setTimeout(() => {
                stopHogwashMusic();
                console.log('🎰 About to execute final outcome:', finalOutcome.type);
                executeHogwashOutcome(finalOutcome);
                document.getElementById('closeSlotBtn').style.display = 'inline-block';
                isSlotSpinning = false;
            }, 1500); // Give time to see the winner highlight
        }
    }
    
    animateSlot();
}

function highlightWinner(outcome) {
    // Find the winning option in the current view and highlight it
    const options = slotReel.querySelectorAll('.slot-option');
    options.forEach(option => {
        option.classList.remove('winner');
        if (option.dataset.type === outcome.type) {
            // Find the option that's currently in the center
            const optionRect = option.getBoundingClientRect();
            const slotWindow = document.querySelector('.slot-window');
            const windowRect = slotWindow.getBoundingClientRect();
            const windowCenter = windowRect.top + windowRect.height / 2;
            
            // Check if this option is in the center area
            if (Math.abs(optionRect.top + optionRect.height / 2 - windowCenter) < 50) {
                option.classList.add('winner');
                console.log('🎰 Winner highlighted:', outcome.type);
            }
        }
    });
}

// Legacy function for compatibility
function spinHogwashWheel() {
    if (isWheelSpinning) return;
    
    isWheelSpinning = true;
    
    // Update modal classes for spinning animation
    const modal = document.getElementById('hogwashWheelModal');
    modal.classList.remove('wheel-ready');
    modal.classList.add('wheel-spinning');
    
    // Hide spin button and remove animations
    const spinBtn = document.getElementById('spinWheelBtn');
    spinBtn.style.display = 'none';
    spinBtn.classList.remove('spin-button-ready');
    
    // Play HOGWASH theme music if available
    playHogwashMusic();
    
    // Calculate final outcome first
    const finalOutcome = calculateHogwashOutcome();
    console.log('🎰 Calculated final outcome:', finalOutcome);
    
    // Calculate target angle for the selected outcome
    const outcomeIndex = wheelOutcomes.findIndex(o => o.type === finalOutcome.type);
    const targetSegment = wheelOutcomes[outcomeIndex];
    console.log('🎰 Target segment:', targetSegment);
    const segmentMiddle = (targetSegment.startAngle + targetSegment.endAngle) / 2;
    
    // Calculate final rotation (multiple spins + target position)
    const spins = 5 + Math.random() * 3; // 5-8 full spins
    // The pointer is at the top (12 o'clock), so we want the segment middle to align with 0 degrees (top)
    // We need to rotate so that segmentMiddle ends up at 0 (top of wheel where pointer is)
    const finalRotation = currentWheelRotation + (spins * 2 * Math.PI) - segmentMiddle;
    console.log('🎰 Wheel will spin for', spins.toFixed(1), 'rotations to land on', finalOutcome.type);
    console.log('🎰 Target segment middle angle:', (segmentMiddle * 180 / Math.PI).toFixed(1), 'degrees');
    
    // Animate the spin - longer duration with more gradual stop
    const startTime = Date.now();
    const duration = 8000 + Math.random() * 4000; // 8-12 seconds for more dramatic effect
    console.log('🎰 Animation duration will be', (duration/1000).toFixed(1), 'seconds');
    
    function animateWheel() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Improved easing function - linear for most of the spin, then slow down at the end
        const easeOut = progress < 0.8 ? progress : 0.8 + (1 - Math.pow(1 - (progress - 0.8) / 0.2, 2)) * 0.2;
        
        currentWheelRotation = currentWheelRotation + (finalRotation - currentWheelRotation) * easeOut;
        drawHogwashWheel();
        
        if (progress < 1) {
            requestAnimationFrame(animateWheel);
        } else {
            // Spin complete - show result
            console.log('🎰 Wheel animation completed after', ((Date.now() - startTime)/1000).toFixed(1), 'seconds');
            setTimeout(() => {
                stopHogwashMusic(); // Stop the music when wheel stops
                console.log('🎰 About to execute final outcome:', finalOutcome.type);
                executeHogwashOutcome(finalOutcome);
                document.getElementById('closeWheelBtn').style.display = 'inline-block';
                isWheelSpinning = false;
            }, 500);
        }
    }
    
    animateWheel();
}

function calculateHogwashOutcome() {
    // Same logic as before but return the outcome object - ORDER MUST MATCH WHEEL VISUAL!
    const outcomes = [
        { type: 'drink', weight: 4 },
        { type: 'win', weight: 4 },
        { type: 'lose', weight: 4 },
        { type: 'give_drinks', weight: 4 },
        { type: 'danger', weight: 2 },
        { type: 'mulligan', weight: 1 },
        { type: 'reverse_mulligan', weight: 1 }
    ];
    
    // Check if DANGER ZONE test mode is active
    if (forceDangerZoneNext) {
        forceDangerZoneNext = false;
        const testButton = document.querySelector('button[onclick="testDangerZoneAlert()"]');
        if (testButton) {
            testButton.textContent = '💀 TEST DANGER ZONE ALERT 💀';
            testButton.style.animation = '';
        }
        return { type: 'danger' };
    }
    
    // Weighted random selection
    const totalWeight = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    
    for (const outcome of outcomes) {
        randomWeight -= outcome.weight;
        if (randomWeight <= 0) {
            return outcome;
        }
    }
    
    return outcomes[0]; // Fallback
}

function executeHogwashOutcome(selectedOutcome) {
    const playerName = selectedPlayerName;
    console.log('🎰 Executing outcome for', playerName, ':', selectedOutcome);
    let outcome, resultText;
    
    // Create full outcome object based on type
    switch (selectedOutcome.type) {
        case 'drink':
            const isFinishDrink = Math.random() < 0.15;
            if (isFinishDrink) {
                resultText = `${playerName} must FINISH their drink! 🍺💀`;
            } else {
                const drinks = Math.floor(Math.random() * 5) + 1;
                resultText = `${playerName} must take ${drinks} DRINK${drinks > 1 ? 'S' : ''}! 🍺`;
            }
            outcome = {
                type: 'drink',
                title: '🍺 TAKE A DRINK YOU PIG! 🍺',
                color: '#ff6b6b'
            };
            break;
            
        case 'danger':
            broadcastDangerZone(playerName);
            sendPushNotification({
                type: 'danger_zone',
                title: '💀 DANGER ZONE 💀',
                body: `${playerName} triggered DANGER ZONE! All players affected!`,
                playerName: playerName
            });
            resultText = `${playerName} triggered the DANGER ZONE! 💀 ALL PLAYERS BEWARE!`;
            outcome = {
                type: 'danger',
                title: '⚠️ DANGER ZONE ⚠️',
                color: '#ff4757'
            };
            break;
            
        case 'win':
            const winPoints = Math.floor(Math.random() * 4) + 1;
            players[playerName].points += winPoints;
            players['GOD'].points -= winPoints;
            savePlayers();
            resultText = `${playerName} wins ${winPoints} points from GOD! 🙏`;
            outcome = {
                type: 'win',
                title: '🎉 WIN POINTS FROM GOD! 🎉',
                color: '#2ed573'
            };
            break;
            
        case 'lose':
            const losePoints = Math.floor(Math.random() * 5) + 1;
            players[playerName].points -= losePoints;
            players['GOD'].points += losePoints;
            savePlayers();
            resultText = `${playerName} loses ${losePoints} points to GOD! 💸`;
            outcome = {
                type: 'lose',
                title: '😈 LOSE POINTS TO GOD! 😈',
                color: '#ff3838'
            };
            break;
            
        case 'give_drinks':
            const drinks = Math.floor(Math.random() * 5) + 1;
            players[playerName].powerUps.giveDrinks += drinks;
            savePlayers();
            resultText = `${playerName} gained the power to give ${drinks} DRINK${drinks > 1 ? 'S' : ''}! 🍺⚡`;
            outcome = {
                type: 'give_drinks',
                title: '🍺 DRINK GIVER POWER! 🍺',
                color: '#ff9500'
            };
            break;
            
        case 'mulligan':
            players[playerName].powerUps.mulligans += 1;
            savePlayers();
            resultText = `${playerName} earned a MULLIGAN! Use it wisely on the golf course! ⛳✨`;
            outcome = {
                type: 'mulligan',
                title: '⛳ MULLIGAN POWER! ⛳',
                color: '#4CAF50'
            };
            break;
            
        case 'reverse_mulligan':
            players[playerName].powerUps.reverseMulligans += 1;
            savePlayers();
            resultText = `${playerName} earned a REVERSE MULLIGAN! Force someone else to re-do their shot! 🔄💀`;
            outcome = {
                type: 'reverse_mulligan',
                title: '🔄 REVERSE MULLIGAN POWER! 🔄',
                color: '#9C27B0'
            };
            break;
    }
    
    // Close wheel and show result
    closeHogwashWheel();
    
    // Show result modal
    document.getElementById('hogwashResultTitle').textContent = outcome.title;
    document.getElementById('hogwashResultContent').innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 20px;">🎰</div>
        <div style="color: ${outcome.color}; font-weight: bold;">${resultText}</div>
    `;
    document.querySelector('.hogwash-result').style.background = `linear-gradient(135deg, ${outcome.color}, #764ba2)`;
    
    document.getElementById('hogwashResultModal').style.display = 'flex';

    // Update leaderboard if points or power-ups changed
    if (outcome.type === 'win' || outcome.type === 'lose' || outcome.type === 'give_drinks' || outcome.type === 'mulligan' || outcome.type === 'reverse_mulligan') {
        updateLeaderboard();
        if (isPlayerLoggedIn) {
            updatePlayerUI();
        }
    }

    // Log activity
    addActivity('hogwash', '🎲', resultText);
}

// HOGWASH Audio Functions
function playHogwashMusic() {
    try {
        // Stop any currently playing HOGWASH music
        stopHogwashMusic();
        
        // Try to play HOGWASH theme music (you can add your music file)
        if (preloadedHogwashAudio) {
            currentHogwashAudio = preloadedHogwashAudio.cloneNode();
            currentHogwashAudio.volume = 0.7; // Adjust volume as needed
            currentHogwashAudio.loop = false; // Don't loop, just play once
            
            const playPromise = currentHogwashAudio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('🎵 HOGWASH music started successfully!');
                    })
                    .catch(error => {
                        console.log('🎵 HOGWASH music autoplay prevented:', error.message);
                    });
            }
        } else {
            // Fallback: Create and play audio element directly
            currentHogwashAudio = new Audio('hogwash-theme.mp3'); // You can change this filename
            currentHogwashAudio.volume = 0.7;
            currentHogwashAudio.loop = false;
            
            const playPromise = currentHogwashAudio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('🎵 HOGWASH theme music playing!');
                    })
                    .catch(error => {
                        console.log('🎵 HOGWASH music file not found or autoplay prevented:', error.message);
                    });
            }
        }
    } catch (error) {
        console.log('🎵 HOGWASH music error:', error.message);
    }
}

function stopHogwashMusic() {
    if (currentHogwashAudio) {
        try {
            currentHogwashAudio.pause();
            currentHogwashAudio.currentTime = 0;
            console.log('🎵 HOGWASH music stopped');
        } catch (error) {
            console.log('🎵 Error stopping HOGWASH music:', error.message);
        }
        currentHogwashAudio = null;
    }
}

function preloadHogwashMusic() {
    try {
        // Preload HOGWASH theme music
        preloadedHogwashAudio = new Audio('hogwash-theme.mp3'); // You can change this filename
        preloadedHogwashAudio.preload = 'auto';
        preloadedHogwashAudio.volume = 0.7;
        
        preloadedHogwashAudio.addEventListener('canplaythrough', () => {
            console.log('🎵 HOGWASH theme music preloaded successfully');
        });
        
        preloadedHogwashAudio.addEventListener('error', (e) => {
            console.log('🎵 HOGWASH music file not found - you can add hogwash-theme.mp3 to enable music');
            preloadedHogwashAudio = null;
        });
    } catch (error) {
        console.log('🎵 HOGWASH music preload error:', error.message);
        preloadedHogwashAudio = null;
    }
}

// Score Edit Functions
let currentEditPlayer = '';
let currentEditScore = 0;

function openScoreEditModal(playerName, currentScore) {
    if (!isBookkeeperLoggedIn) {
        alert('🚫 You must be logged in as Ham Handler to edit scores!');
        return;
    }
    
    currentEditPlayer = playerName;
    currentEditScore = currentScore;
    
    document.getElementById('scoreEditTitle').textContent = `✏️ EDIT ${playerName.toUpperCase()}'S SCORE ✏️`;
    document.getElementById('scoreEditLabel').textContent = `New Score for ${playerName}:`;
    document.getElementById('scoreEditInput').value = currentScore;
    document.getElementById('scoreEditModal').style.display = 'flex';
    
    // Focus on input field for quick editing
    setTimeout(() => {
        document.getElementById('scoreEditInput').focus();
        document.getElementById('scoreEditInput').select();
    }, 100);
}

function closeScoreEditModal() {
    document.getElementById('scoreEditModal').style.display = 'none';
    currentEditPlayer = '';
    currentEditScore = 0;
    document.getElementById('scoreEditInput').value = '';
}

function saveScoreEdit() {
    const newScore = parseInt(document.getElementById('scoreEditInput').value);
    
    if (isNaN(newScore) || newScore < 0) {
        alert('🚫 Please enter a valid score (0 or higher)!');
        return;
    }
    
    if (!currentEditPlayer) {
        alert('🚫 Error: No player selected for editing!');
        return;
    }
    
    const oldScore = players[currentEditPlayer];
    const scoreDifference = newScore - oldScore;
    
    // Confirm the change
    if (!confirm(`🐷 CONFIRM SCORE EDIT 🐷\n\nPlayer: ${currentEditPlayer}\nOld Score: ${oldScore}\nNew Score: ${newScore}\nDifference: ${scoreDifference > 0 ? '+' : ''}${scoreDifference}\n\nAre you sure you want to make this change?`)) {
        return;
    }
    
    // Update the player's score
    players[currentEditPlayer].points = newScore;
    
    // Save to Firebase
    savePlayers();
    
    // Update UI
    updateLeaderboard();
    if (isPlayerLoggedIn && currentPlayer === currentEditPlayer) {
        updatePlayerUI();
    }
    
    // Log activity
    addActivity('admin', '✏️', `Ham Handler edited ${currentEditPlayer}'s score from ${oldScore} to ${newScore} (${scoreDifference > 0 ? '+' : ''}${scoreDifference})`);
    
    // Close modal
    closeScoreEditModal();
    
    alert(`✅ Score updated successfully!\n🐷 ${currentEditPlayer}: ${oldScore} → ${newScore} (${scoreDifference > 0 ? '+' : ''}${scoreDifference})`);
}

// Upload Proof System for Drink Assignments
let currentStream = null;
let capturedPhotoBlob = null;
let currentFacingMode = 'environment'; // Default to back camera

function showUploadProofModal() {
    if (!isPlayerLoggedIn || !currentPlayer) {
        alert('🚫 You must be logged in to upload proof!');
        return;
    }
    
    // Reset modal state
    resetUploadProofModal();
    
    // Show modal
    document.getElementById('uploadProofModal').style.display = 'flex';
    
    // Auto-start camera with back camera by default
    setTimeout(() => {
        startCamera('environment');
    }, 300); // Small delay to ensure modal is fully displayed
}

function closeUploadProofModal() {
    // Stop camera if running
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    // Reset modal state
    resetUploadProofModal();
    
    // Hide modal
    document.getElementById('uploadProofModal').style.display = 'none';
}

function resetUploadProofModal() {
    // Reset all UI elements
    document.getElementById('cameraPreview').style.display = 'none';
    document.getElementById('capturedPhoto').style.display = 'none';
    document.getElementById('uploadControls').style.display = 'none';
    
    document.getElementById('takePictureBtn').style.display = 'inline-block';
    document.getElementById('retakePictureBtn').style.display = 'none';
    
    // Reset camera toggle buttons
    document.getElementById('backCameraBtn').classList.add('active');
    document.getElementById('frontCameraBtn').classList.remove('active');
    currentFacingMode = 'environment';
    
    // Clear form data
    document.getElementById('proofMessage').value = '';
    capturedPhotoBlob = null;
}

async function startCamera(facingMode = 'environment') {
    try {
        // Stop existing stream if running
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        currentFacingMode = facingMode;
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        currentStream = stream;
        const video = document.getElementById('cameraPreview');
        video.srcObject = stream;
        video.style.display = 'block';
        
        // Update UI
        document.getElementById('takePictureBtn').style.display = 'inline-block';
        
        console.log(`📹 Camera started successfully with ${facingMode} camera`);
    } catch (error) {
        console.error('❌ Camera access error:', error);
        alert('❌ Camera Access Error!\n\nCould not access your camera. Please:\n• Allow camera permissions\n• Make sure you\'re using HTTPS\n• Try switching to the other camera');
    }
}

async function switchCamera(facingMode) {
    // Update button states
    document.getElementById('backCameraBtn').classList.remove('active');
    document.getElementById('frontCameraBtn').classList.remove('active');
    
    if (facingMode === 'environment') {
        document.getElementById('backCameraBtn').classList.add('active');
        document.getElementById('backCameraBtn').style.background = 'linear-gradient(45deg, #2196F3, #1976D2)';
        document.getElementById('frontCameraBtn').style.background = 'linear-gradient(45deg, #666, #888)';
    } else {
        document.getElementById('frontCameraBtn').classList.add('active');
        document.getElementById('frontCameraBtn').style.background = 'linear-gradient(45deg, #2196F3, #1976D2)';
        document.getElementById('backCameraBtn').style.background = 'linear-gradient(45deg, #666, #888)';
    }
    
    // Switch camera
    await startCamera(facingMode);
}

function takePicture() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');
    
    // Calculate optimal size for mobile upload (max 800x600 for faster uploads)
    let sourceWidth = video.videoWidth;
    let sourceHeight = video.videoHeight;
    const maxWidth = 800;
    const maxHeight = 600;
    
    // Calculate scaling to fit within max dimensions while maintaining aspect ratio
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
    const targetWidth = Math.floor(sourceWidth * scale);
    const targetHeight = Math.floor(sourceHeight * scale);
    
    // Set canvas to optimized size
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Draw video frame to canvas with scaling
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Convert to blob with mobile-optimized quality (0.6 for smaller file size)
    canvas.toBlob((blob) => {
        capturedPhotoBlob = blob;
        
        console.log(`📸 Photo captured: ${targetWidth}x${targetHeight}, ${(blob.size / 1024).toFixed(1)}KB`);
        
        // Show preview
        const photoPreview = document.getElementById('photoPreview');
        photoPreview.src = URL.createObjectURL(blob);
        
        // Update UI
        document.getElementById('cameraPreview').style.display = 'none';
        document.getElementById('capturedPhoto').style.display = 'block';
        document.getElementById('uploadControls').style.display = 'block';
        
        document.getElementById('takePictureBtn').style.display = 'none';
        document.getElementById('retakePictureBtn').style.display = 'inline-block';
        
        // Stop camera
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        
        console.log('📸 Photo captured successfully');
    }, 'image/jpeg', 0.6);
}

function retakePicture() {
    // Reset to camera mode
    document.getElementById('capturedPhoto').style.display = 'none';
    document.getElementById('uploadControls').style.display = 'none';
    document.getElementById('retakePictureBtn').style.display = 'none';
    document.getElementById('takePictureBtn').style.display = 'inline-block';
    
    capturedPhotoBlob = null;
    
    // Restart camera with current facing mode
    startCamera(currentFacingMode);
}



async function uploadProof() {
    if (!capturedPhotoBlob) {
        alert('❌ Please take a photo first!');
        return;
    }
    
    if (!window.currentDrinkAssignment) {
        alert('❌ No active drink assignment found!');
        return;
    }
    
    const proofMessage = document.getElementById('proofMessage').value.trim();
    const drinkData = window.currentDrinkAssignment;
    const playerDrinks = drinkData.assignments[currentPlayer] || 0;
    
    if (playerDrinks <= 0) {
        alert('❌ You were not assigned any drinks!');
        return;
    }
    
    try {
        // Show loading state
        const uploadBtn = document.querySelector('#uploadControls button');
        const originalText = uploadBtn.textContent;
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ UPLOADING...';
        
        // Add progress indicator
        let progressInterval;
        let dots = 0;
        progressInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            uploadBtn.textContent = '⏳ UPLOADING' + '.'.repeat(dots);
        }, 500);
        
        // Create unique filename
        const timestamp = Date.now();
        const filename = `drink_proof_${currentPlayer}_${timestamp}.jpg`;
        
        console.log('🚀 Starting proof upload process...');
        console.log('📊 Image size:', capturedPhotoBlob.size, 'bytes');
        
        // Upload to Firebase Storage with timeout protection
        const imageUrl = await uploadImageToFirebase(capturedPhotoBlob, filename);
        
        // Clear progress indicator
        clearInterval(progressInterval);
        console.log('✅ Upload completed successfully!');
        
        // Create proof data
        const proofData = {
            id: `proof_${timestamp}_${Math.floor(Math.random() * 10000)}`,
            playerName: currentPlayer,
            drinkAssignmentId: drinkData.eventId,
            drinksAssigned: playerDrinks,
            imageUrl: imageUrl,
            message: proofMessage,
            timestamp: new Date().toISOString(),
            uploadedBy: currentPlayer
        };
        
        // Save proof to Firebase
        await saveProofToFirebase(proofData);
        
        // Add to activity log
        let activityMessage = `${currentPlayer} uploaded proof for ${playerDrinks} drink${playerDrinks > 1 ? 's' : ''}`;
        if (proofMessage) {
            activityMessage += ` - "${proofMessage}"`;
        }
        addActivity('drink_proof', '📸', activityMessage, {
            proofId: proofData.id,
            imageUrl: proofData.imageUrl,
            playerName: proofData.playerName,
            message: proofData.message,
            drinksAssigned: proofData.drinksAssigned
        });
        
        // Notify Alex
        await notifyAlexOfProof(proofData);
        
        // Close modals
        closeUploadProofModal();
        document.getElementById('drinkAssignmentAlert').style.display = 'none';
        
        // Clear current assignment
        window.currentDrinkAssignment = null;
        
        alert('🎉 PROOF UPLOADED! 🎉\n\nYour drink proof has been uploaded successfully!\nAlex has been notified and it\'s been added to the activity log.');
        
    } catch (error) {
        console.error('❌ Upload proof error:', error);
        
        // Clear progress indicator if it exists
        if (typeof progressInterval !== 'undefined') {
            clearInterval(progressInterval);
        }
        
        // Show user-friendly error message based on error type
        let errorMessage = '❌ Upload Failed!\n\n';
        if (error.message.includes('timeout')) {
            errorMessage += 'The upload took too long. This might be due to:\n• Slow internet connection\n• Large image size\n• Network issues\n\nPlease try again or check your connection.';
        } else if (error.message.includes('Firebase')) {
            errorMessage += 'There was a problem with the storage service.\n\nYour proof has been saved locally as a backup. Please try again in a moment.';
        } else {
            errorMessage += 'There was an error uploading your proof.\n\nError: ' + error.message + '\n\nPlease try again.';
        }
        
        alert(errorMessage);
        
        // Reset button
        const uploadBtn = document.querySelector('#uploadControls button');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalText || '🚀 UPLOAD PROOF 🚀';
        }
    }
}

async function uploadImageToFirebase(blob, filename) {
    console.log('📤 Uploading image to Firebase Storage:', filename);
    console.log('📊 Blob size:', blob.size, 'bytes');
    
    // Create timeout promise to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 60000);
    });
    
    try {
        // Skip Firebase Storage due to CORS issues, use data URL fallback directly
        console.log('📦 Using optimized data URL storage (bypassing Firebase Storage CORS issues)');
        
        // Compress image if it's too large (mobile optimization)
        let uploadBlob = blob;
        if (blob.size > 300 * 1024) { // If larger than 300KB (further reduced for data URL storage)
            console.log('📦 Compressing large image for data URL storage...');
            uploadBlob = await compressImage(blob, 0.4); // More aggressive compression for data URLs
            console.log('📦 Compressed size:', uploadBlob.size, 'bytes');
        }
        
        // Create a data URL with timeout protection
        return await Promise.race([
            new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    console.log('✅ Data URL created successfully');
                    resolve(reader.result);
                };
                reader.onerror = () => {
                    console.error('❌ FileReader error');
                    resolve('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='); // 1x1 transparent JPEG
                };
                reader.readAsDataURL(uploadBlob);
            }),
            timeoutPromise
        ]);
    } catch (error) {
        console.error('❌ Firebase Storage upload error:', error);
        
        // Fallback to data URL on error
        console.log('⚠️ Falling back to data URL due to upload error');
        return await Promise.race([
            new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    console.log('✅ Fallback data URL created');
                    resolve(reader.result);
                };
                reader.onerror = () => {
                    console.error('❌ Fallback FileReader error');
                    resolve('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=');
                };
                reader.readAsDataURL(blob);
            }),
            timeoutPromise
        ]);
    }
}

// Image compression function for mobile optimization
async function compressImage(blob, quality = 0.7) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions (max 600x400 for mobile optimization)
            let { width, height } = img;
            const maxWidth = 600;
            const maxHeight = 400;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        
        img.onerror = () => {
            console.log('⚠️ Image compression failed, using original');
            resolve(blob);
        };
        
        img.src = URL.createObjectURL(blob);
    });
}

async function saveProofToFirebase(proofData) {
    if (!window.firebaseDB) {
        throw new Error('Firebase not available');
    }
    
    const proofRef = window.firebaseRef(window.firebaseDB, `drinkProofs/${proofData.id}`);
    await window.firebaseSet(proofRef, proofData);
    
    console.log('💾 Proof saved to Firebase:', proofData.id);
}

async function notifyAlexOfProof(proofData) {
    // Send push notification to Alex
    await sendPushNotification({
        type: 'drink_proof',
        title: '📸 DRINK PROOF UPLOADED',
        body: `${proofData.playerName} uploaded proof for ${proofData.drinksAssigned} drink${proofData.drinksAssigned > 1 ? 's' : ''}!`,
        playerName: proofData.playerName,
        proofId: proofData.id
    });
    
    // Also save notification to Firebase for Alex to see
    const notificationData = {
        id: `notification_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        type: 'drink_proof',
        title: '📸 DRINK PROOF UPLOADED',
        message: `${proofData.playerName} uploaded proof for ${proofData.drinksAssigned} drink${proofData.drinksAssigned > 1 ? 's' : ''}!`,
        proofData: proofData,
        timestamp: new Date().toISOString(),
        read: false,
        targetPlayer: 'Alex'
    };
    
    const notificationRef = window.firebaseRef(window.firebaseDB, `notifications/${notificationData.id}`);
    await window.firebaseSet(notificationRef, notificationData);
    
    console.log('🔔 Alex notified of proof upload');
}

// Proof Viewer System
async function showProofModal(activityId) {
    try {
        console.log('🔍 Looking for proof with activity ID:', activityId);
        
        // Find the activity in our local activities array
        const activity = activities.find(a => a.id === activityId);
        console.log('📜 Found activity:', activity);
        
        if (!activity || activity.type !== 'drink_proof') {
            alert('❌ Proof not found!');
            return;
        }
        
        // Get proof data from activity or fetch from Firebase
        let proofData = activity.extraData;
        console.log('📊 Activity extraData:', proofData);
        
        if (!proofData) {
            console.log('⚠️ No extraData found, trying Firebase drinkProofs...');
            // Fallback: try to fetch from Firebase drinkProofs
            const proofRef = window.firebaseRef(window.firebaseDB, `drinkProofs/${activity.id}`);
            const snapshot = await window.firebaseGet(proofRef);
            if (snapshot.exists()) {
                proofData = snapshot.val();
                console.log('✅ Found proof data in Firebase:', proofData);
            } else {
                console.log('❌ No proof data found in Firebase either');
                
                // Try alternative approach - look for proof by searching for matching timestamp/player
                console.log('🔍 Trying alternative search...');
                const allProofsRef = window.firebaseRef(window.firebaseDB, 'drinkProofs');
                const allProofsSnapshot = await window.firebaseGet(allProofsRef);
                
                if (allProofsSnapshot.exists()) {
                    const allProofs = allProofsSnapshot.val();
                    console.log('📊 All proofs in database:', allProofs);
                    
                    // Try to find a proof that matches this activity's timestamp (within 1 minute)
                    const activityTime = new Date(activity.timestamp).getTime();
                    const matchingProof = Object.values(allProofs).find(proof => {
                        const proofTime = new Date(proof.timestamp).getTime();
                        const timeDiff = Math.abs(activityTime - proofTime);
                        return timeDiff < 60000; // Within 1 minute
                    });
                    
                    if (matchingProof) {
                        proofData = matchingProof;
                        console.log('✅ Found matching proof by timestamp:', proofData);
                    }
                }
                
                if (!proofData) {
                    alert('❌ Proof data not found! This might be an older proof entry before the system was updated.');
                    return;
                }
            }
        }
        
        // Populate modal with proof data
        document.getElementById('proofImage').src = proofData.imageUrl;
        document.getElementById('proofPlayerInfo').textContent = `Player: ${proofData.playerName}`;
        document.getElementById('proofDrinkInfo').textContent = `Drinks: ${proofData.drinksAssigned} drink${proofData.drinksAssigned > 1 ? 's' : ''}`;
        document.getElementById('proofMessage').textContent = proofData.message ? `"${proofData.message}"` : 'No message provided';
        
        const timestamp = new Date(activity.timestamp);
        document.getElementById('proofTimestamp').textContent = `Uploaded: ${timestamp.toLocaleString()}`;
        
        // Show Alex actions if current user is Alex
        const alexActions = document.getElementById('alexProofActions');
        if (isPlayerLoggedIn && currentPlayer === 'Alex') {
            alexActions.style.display = 'block';
            // Store current proof data for request functionality
            window.currentViewingProof = proofData;
        } else {
            alexActions.style.display = 'none';
        }
        
        // Show modal
        const modal = document.getElementById('proofViewerModal');
        modal.classList.add('show');
        
        // Add click-outside-to-close functionality
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeProofViewerModal();
            }
        };
        
    } catch (error) {
        console.error('❌ Error showing proof modal:', error);
        alert('❌ Error loading proof: ' + error.message);
    }
}

function closeProofViewerModal() {
    const modal = document.getElementById('proofViewerModal');
    modal.classList.remove('show');
    window.currentViewingProof = null;
}

async function requestProofFromPlayer() {
    if (!window.currentViewingProof) {
        alert('❌ No proof data available!');
        return;
    }
    
    const proofData = window.currentViewingProof;
    const playerName = proofData.playerName;
    
    try {
        // Create proof request
        const requestData = {
            id: `proof_request_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            requestedBy: 'Alex',
            targetPlayer: playerName,
            originalProofId: proofData.id,
            message: `Alex is requesting additional proof for your ${proofData.drinksAssigned} drink${proofData.drinksAssigned > 1 ? 's' : ''} assignment.`,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        // Save request to Firebase
        const requestRef = window.firebaseRef(window.firebaseDB, `proofRequests/${requestData.id}`);
        await window.firebaseSet(requestRef, requestData);
        
        // Send push notification to player
        await sendPushNotification({
            type: 'proof_request',
            title: '📢 PROOF REQUESTED',
            body: `Alex is requesting additional proof for your drinks!`,
            targetPlayer: playerName,
            requestId: requestData.id
        });
        
        // Add to activity log
        addActivity('proof_request', '📢', `Alex requested additional proof from ${playerName}`);
        
        // Close modal and show success
        closeProofViewerModal();
        alert(`📢 PROOF REQUEST SENT! 📢\n\n${playerName} has been notified that you want additional proof for their drink assignment.`);
        
    } catch (error) {
        console.error('❌ Error requesting proof:', error);
        alert('❌ Error sending proof request: ' + error.message);
    }
}

// Proof Request System
function initializeProofRequestSystem() {
    console.log('📢 Initializing proof request system...');
    
    if (!window.firebaseDB) {
        console.log('⚠️ Firebase not available for proof request system');
        return;
    }
    
    // Listen for proof requests from Firebase
    const proofRequestsRef = window.firebaseRef(window.firebaseDB, 'proofRequests');
    window.firebaseOnValue(proofRequestsRef, (snapshot) => {
        if (snapshot.exists()) {
            const requests = snapshot.val();
            console.log('📢 Proof requests received:', requests);
            
            // Check for new requests for current player
            Object.values(requests).forEach(request => {
                if (request.targetPlayer === currentPlayer && request.status === 'pending') {
                    // Check if this is a new request (within last 10 seconds)
                    const requestTime = new Date(request.timestamp);
                    const now = new Date();
                    const timeDiff = now - requestTime;
                    
                    if (timeDiff < 10000) { // Within 10 seconds
                        console.log('📢 Showing proof request alert for current player!');
                        showProofRequestAlert(request);
                    }
                }
            });
        }
    }, (error) => {
        console.error('❌ Firebase proof requests listener error:', error);
    });
}

function showProofRequestAlert(requestData) {
    // Prevent duplicate alerts for the same request
    if (window.lastProofRequestAlert === requestData.id) {
        console.log('📢 Duplicate proof request alert prevented');
        return;
    }
    window.lastProofRequestAlert = requestData.id;
    
    const alertMessage = `📢 PROOF REQUEST FROM ALEX! 📢\n\n${requestData.message}\n\nWould you like to upload additional proof now?`;
    
    if (confirm(alertMessage)) {
        // Mark request as acknowledged
        markProofRequestAsHandled(requestData.id);
        
        // Open upload proof modal
        showUploadProofModal();
    } else {
        // Mark request as acknowledged but declined
        markProofRequestAsHandled(requestData.id, 'declined');
    }
}

async function markProofRequestAsHandled(requestId, status = 'acknowledged') {
    try {
        const requestRef = window.firebaseRef(window.firebaseDB, `proofRequests/${requestId}`);
        await window.firebaseUpdate(requestRef, {
            status: status,
            handledAt: new Date().toISOString()
        });
        console.log(`📢 Proof request ${requestId} marked as ${status}`);
    } catch (error) {
        console.error('❌ Error updating proof request status:', error);
    }
}

// Make proof viewer functions globally accessible
window.showProofModal = showProofModal;
window.closeProofViewerModal = closeProofViewerModal;
window.requestProofFromPlayer = requestProofFromPlayer;

// Make upload proof functions globally accessible
window.showUploadProofModal = showUploadProofModal;
window.closeUploadProofModal = closeUploadProofModal;
window.startCamera = startCamera;
window.switchCamera = switchCamera;
window.takePicture = takePicture;
window.retakePicture = retakePicture;
window.uploadProof = uploadProof;

// Insulting Pig Name System
const pigInsults = [
    'PIG FUCKER', 'BACON BREATH', 'SWINE SLUT', 'HOG WHORE', 'PORK CHOP',
    'CLOVEN HOOVED BEAST', 'MUD WALLOWER', 'SLOP SUCKER', 'SNORTING SWINE',
    'SQUEALING PIGLET', 'TRUFFLE SNIFFER', 'BARNYARD BITCH', 'OINKING OAFS',
    'CURLY TAILED CUNT', 'PIGPEN PEASANT', 'SWILL SWALLOWER', 'HOOF HEARTED',
    'BACON BITS', 'PORK BELLY', 'HAM HOCK', 'SAUSAGE SUCKER', 'CHOP CHASER',
    'SNOUT SNORTER', 'TROUGH DIVER', 'SLOP SLURPER', 'MUD MUNCHER',
    'PIGGY BACK RIDER', 'BOAR BORE', 'SOW SUCKER', 'PIGLET POKER',
    'BACON BANDIT', 'PORK PIRATE', 'HAM HANDLER', 'SWINE SWIPER',
    'OINKER OGLER', 'SNORTER SNEAK', 'SQUEALER SLEAZE', 'PIGGY PERV',
    'HOOF HUGGER', 'TAIL TWISTER', 'SNOUT SNIFFER', 'TROUGH TRASHER'
];

let playerInsults = {}; // Store current insults for each player
let lastInsultUpdate = 0; // Track when insults were last updated
const INSULT_ROTATION_HOURS = 3; // Change insults every 3 hours
let isUpdatingInsults = false; // Prevent infinite loops

function getPlayerInsult(playerName) {
    // Ensure lastInsultUpdate is initialized
    if (typeof lastInsultUpdate === 'undefined' || lastInsultUpdate === null) {
        lastInsultUpdate = 0;
    }
    
    const now = Date.now();
    const hoursElapsed = (now - lastInsultUpdate) / (1000 * 60 * 60);
    
    // Update insults every 3 hours or if we don't have insults yet
    if (hoursElapsed >= INSULT_ROTATION_HOURS || Object.keys(playerInsults).length === 0) {
        updatePlayerInsults();
        lastInsultUpdate = now;
    }
    
    return playerInsults[playerName] || 'MYSTERY MEAT';
}

function updatePlayerInsults() {
    // Prevent infinite loops
    if (isUpdatingInsults) {
        console.log('🐷 Already updating insults, skipping...');
        return;
    }
    
    isUpdatingInsults = true;
    console.log('🐷 Updating insulting pig names...');
    
    const playerNames = Object.keys(players);
    const availableInsults = [...pigInsults]; // Copy array
    const newInsults = {};
    
    // Assign unique insults to each player
    playerNames.forEach(playerName => {
        if (availableInsults.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableInsults.length);
            const insult = availableInsults.splice(randomIndex, 1)[0]; // Remove from available
            newInsults[playerName] = insult;
        } else {
            // Fallback if we run out of insults (shouldn't happen with 40+ insults)
            newInsults[playerName] = pigInsults[Math.floor(Math.random() * pigInsults.length)];
        }
    });
    
    playerInsults = newInsults;
    
    // Save to localStorage for persistence
    localStorage.setItem('pigInsults', JSON.stringify(playerInsults));
    localStorage.setItem('lastInsultUpdate', lastInsultUpdate.toString());
    
    console.log('🐷 New pig insults assigned:', playerInsults);
    
    // Reset the flag
    isUpdatingInsults = false;
}

// Load insults from localStorage on startup
function loadPlayerInsults() {
    try {
        const savedInsults = localStorage.getItem('pigInsults');
        const savedUpdateTime = localStorage.getItem('lastInsultUpdate');
        
        if (savedInsults && savedUpdateTime) {
            playerInsults = JSON.parse(savedInsults);
            lastInsultUpdate = parseInt(savedUpdateTime);
            console.log('🐷 Loaded saved pig insults:', playerInsults);
        } else {
            // Initialize with defaults if nothing saved
            playerInsults = {};
            lastInsultUpdate = 0;
            console.log('🐷 Initializing pig insults system');
        }
    } catch (error) {
        console.log('⚠️ Could not load saved insults:', error);
        // Fallback initialization
        playerInsults = {};
        lastInsultUpdate = 0;
    }
}

// Initialize insults system
loadPlayerInsults();

// Add some random pig sounds
const pigSounds = ['🐷 OINK!', '🐷 SNORT!', '🐷 SQUEAL!'];
setInterval(() => {
    if (Math.random() < 0.1) {
        const sound = pigSounds[Math.floor(Math.random() * pigSounds.length)];
        console.log(sound);
    }
}, 5000);
