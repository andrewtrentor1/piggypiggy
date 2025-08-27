// MBE Pig Points - Main JavaScript

// Player data with Firebase persistence
let players = {
    'Evan': 100,
    'Ian': 100,
    'Andrew': 100,
    'Zack': 100,
    'Brian': 100,
    'Alex': 100,
    'GOD': 1000
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
let audioUnlocked = false;
let preloadedAudio = null;
let audioPlayingSuccessfully = false; // Flag to prevent multiple simultaneous playback

// Alex's drink assignment system
let alexDrinkCredits = 0; // Current available drinks for Alex to assign
const ALEX_DRINKS_PER_HOUR = 10; // Drinks Alex gets per hour
const ALEX_MAX_DRINKS = 20; // Maximum drinks Alex can accumulate
let alexLastDrinkRefill = Date.now(); // Last time drinks were refilled

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
    '+12184283839': 'Brian',
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
            // Merge Firebase data with default structure to ensure GOD exists
            players = {
                'Evan': data.Evan || 100,
                'Ian': data.Ian || 100,
                'Andrew': data.Andrew || 100,
                'Zack': data.Zack || 100,
                'Brian': data.Brian || 100,
                'Alex': data.Alex || 100,
                'GOD': data.GOD || 1000
            };
            
            // If GOD wasn't in the Firebase data, save the updated structure
            if (!data.GOD) {
                console.log('🙏 Adding GOD to Firebase data');
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
            // User is signed in with phone number
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
    // reCAPTCHA will be initialized only when needed for SMS sending
}, 1000);

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
    
    // Hide loading indicator and show leaderboard
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    leaderboard.style.display = 'block';
    
    // Separate GOD from regular players
    const regularPlayers = Object.entries(players).filter(player => player[0] !== 'GOD');
    const godPlayer = Object.entries(players).find(player => player[0] === 'GOD');
    
    // Sort regular players by points (highest first)
    const sortedPlayers = regularPlayers.sort((a, b) => b[1] - a[1]);
    
    // Calculate max/min for regular players only (exclude GOD from pig/crown logic)
    const regularPoints = regularPlayers.map(p => p[1]);
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
        if (!allSamePoints && player[1] === minPoints) {
            li.classList.add('pig');
        }
        
        li.innerHTML = `
            <div class="player-name">
                ${!allSamePoints && player[1] === maxPoints ? '<span class="crown">👑</span>' : ''}
                ${!allSamePoints && player[1] === minPoints ? '<span>🐷 THE PIG 🐷</span>' : ''}
                <span>${player[0]}</span>
            </div>
            <div class="points">
                ${player[1]} 🐷
                ${isBookkeeperLoggedIn ? `<button class="edit-score-btn" onclick="openScoreEditModal('${player[0]}', ${player[1]})" title="Edit ${player[0]}'s score">✏️</button>` : ''}
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
                ${godPlayer[1]} 🙏
                ${isBookkeeperLoggedIn ? `<button class="edit-score-btn" onclick="openScoreEditModal('GOD', ${godPlayer[1]})" title="Edit GOD's score">✏️</button>` : ''}
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
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (username === 'PIG' && password === 'PIG') {
        // Successful login
        isBookkeeperLoggedIn = true;
        localStorage.setItem('bookkeeperLoggedIn', 'true');
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('bookkeeperCard').style.display = 'block';
        document.getElementById('loginSection').style.display = 'none';
        
        // Clear the form
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        
        alert('🐷 BOOKKEEPER ACTIVATED! 🐷\nYou now have the power to control all pig points!');
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
    
    if (players[fromPlayer] < points) {
        alert('🚫 Not enough pig points to transfer!');
        return;
    }
    
    players[fromPlayer] -= points;
    players[toPlayer] += points;
    
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
    
    players[randomPlayer] += randomPoints;
    
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

// Check for bypass login state from localStorage
function checkBypassLoginState() {
    const bypassLoggedIn = localStorage.getItem('bypassPlayerLoggedIn') === 'true';
    const bypassPlayer = localStorage.getItem('bypassCurrentPlayer');
    
    if (bypassLoggedIn && bypassPlayer) {
        console.log(`🚀 Restoring bypass login state: ${bypassPlayer}`);
        isPlayerLoggedIn = true;
        currentPlayer = bypassPlayer;
        
        // Check if this player is also the Ham Handler (Evan)
        if (bypassPlayer === 'Evan') {
            isBookkeeperLoggedIn = true;
            localStorage.setItem('bookkeeperLoggedIn', 'true');
        }
        
        console.log(`🔐 Bypass login restored: ${bypassPlayer}`);
        
        // Update UI to reflect login state
        updateLeaderboard();
    }
}

// Initialize login state
checkBypassLoginState();
checkLoginState();

// Initialize HOGWASH cooldowns
loadHogwashCooldowns();

// Initialize audio system for autoplay bypass
initializeAudioSystem();

// Initialize Alex's drink system
initializeAlexDrinkSystem();

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
        
        activityItem.innerHTML = `
            <div class="activity-time">${timeString}</div>
            <div class="activity-text">
                <span class="activity-emoji">${activity.emoji}</span>
                ${activity.message}
            </div>
        `;
        
        activityFeed.appendChild(activityItem);
    });
}

function addActivity(type, emoji, message) {
    const activity = {
        id: Date.now() + '_' + Math.floor(Math.random() * 10000), // Firebase-safe unique ID
        type: type,
        emoji: emoji,
        message: message,
        timestamp: new Date().toISOString()
    };
    
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
            
            // Create new reCAPTCHA verifier
            recaptchaVerifier = new window.RecaptchaVerifier(window.firebaseAuth, 'send-code-button', {
                'size': 'invisible',
                'callback': (response) => {
                    console.log('✅ reCAPTCHA solved successfully');
                },
                'expired-callback': () => {
                    console.warn('⚠️ reCAPTCHA expired');
                    isRecaptchaReady = false;
                },
                'error-callback': (error) => {
                    console.error('❌ reCAPTCHA error during use:', error);
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
            alert('🚫 reCAPTCHA initialization failed. Please use BYPASS button or refresh the page.');
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

    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
        console.error('⏰ SMS sending timeout - operation took too long');
        sendButton.disabled = false;
        sendButton.textContent = originalText;
        alert('🚫 SMS sending timed out. This is likely due to domain authorization issues.\n\nPlease use the BYPASS button for now.');
    }, 15000); // 15 second timeout

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
            
            let errorMessage = `🚫 SMS Error: ${error.message}\n\n`;
            
            if (error.code === 'auth/unauthorized-domain') {
                errorMessage += `DOMAIN NOT AUTHORIZED!\n\nThe domain needs to be added to Firebase Console.\n\nFIX:\n1. Go to Firebase Console\n2. Authentication → Settings\n3. Authorized domains → Add your domain\n\nFor now, use BYPASS button.`;
            } else if (error.code === 'auth/internal-error') {
                errorMessage += `Internal Firebase error. Possible causes:\n• Domain authorization issue\n• reCAPTCHA configuration\n• Firebase service problems\n\nTry BYPASS button.`;
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage += `Rate limit exceeded. Wait a few minutes or use BYPASS button.`;
            } else if (error.code === 'auth/captcha-check-failed') {
                errorMessage += `reCAPTCHA verification failed. Try refreshing the page or use BYPASS button.`;
            } else if (error.code === 'auth/invalid-phone-number') {
                errorMessage += `Invalid phone number format.\nContact admin to verify phone number.`;
            } else {
                errorMessage += `Error Code: ${error.code}\n\nMost likely a domain authorization issue.\nUse BYPASS button for now.`;
            }
            
            alert(errorMessage);
            
            // Reset reCAPTCHA for next attempt
            isRecaptchaReady = false;
            setTimeout(() => {
                initializeRecaptcha();
            }, 1000);
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

// Temporary bypass for SMS rate limiting during testing
function bypassSMSForTesting() {
    const selectedPlayer = document.getElementById('playerSelect').value;
    
    if (!selectedPlayer) {
        alert('🚫 Please select your name first!');
        return;
    }

    if (confirm(`🚀 TESTING BYPASS\n\nThis will log you in as ${selectedPlayer} without SMS verification.\n\n⚠️ This is for development/testing only!\n\nContinue?`)) {
        console.log(`🚀 Bypass login for ${selectedPlayer}`);
        
        // Store login state in localStorage for cross-page persistence
        localStorage.setItem('bypassPlayerLoggedIn', 'true');
        localStorage.setItem('bypassCurrentPlayer', selectedPlayer);
        
        // Simulate successful login without triggering Firebase Auth
        isPlayerLoggedIn = true;
        currentPlayer = selectedPlayer;
        
        // Check if this player is also the Ham Handler (Evan)
        if (selectedPlayer === 'Evan') {
            isBookkeeperLoggedIn = true;
            localStorage.setItem('bookkeeperLoggedIn', 'true');
        }
        
        closePlayerLoginModal();
        checkLoginState();
        
        // Show success message
        if (selectedPlayer === 'Evan') {
            alert(`🐷 Welcome Ham Handler ${selectedPlayer}! 🐷\n[TESTING MODE - No SMS]\nYou now have FULL admin access AND player controls!`);
            addActivity('admin', '🔐', `${selectedPlayer} logged in as Ham Handler (TESTING)`);
        } else {
            alert(`🐷 Welcome ${selectedPlayer}! 🐷\n[TESTING MODE - No SMS]\nYou are now logged in!`);
            addActivity('admin', '🔐', `${selectedPlayer} logged in (TESTING)`);
        }
    }
}

function updatePlayerUI() {
    if (!currentPlayer) return;
    
    document.getElementById('playerWelcome').textContent = `Welcome, ${currentPlayer}!`;
    document.getElementById('playerPoints').textContent = `Your Points: ${players[currentPlayer] || 0} 🐷`;
    
    // Remove current player from transfer dropdown
    const transferSelect = document.getElementById('playerTransferTo');
    Array.from(transferSelect.options).forEach(option => {
        if (option.value === currentPlayer) {
            option.style.display = 'none';
        } else {
            option.style.display = 'block';
        }
    });
    
    // Update Alex's drink section if he's logged in
    if (currentPlayer === 'Alex') {
        updateAlexDrinkUI();
    } else {
        // Clear Alex's drink section for other players
        const alexDrinkSection = document.getElementById('alexDrinkSection');
        if (alexDrinkSection) {
            alexDrinkSection.innerHTML = '';
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
            statusPlayerName.textContent = `🐷 ${currentPlayer}`;
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
    alertModal.style.zIndex = '10000'; // Ensure it's on top
    
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
    
    // Auto-close after 10 seconds if user doesn't click
    setTimeout(() => {
        closeDangerZoneAlert();
    }, 10000);
    
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
    preloadedAudio.preload = 'auto';
    preloadedAudio.volume = 0.8;
    preloadedAudio.src = 'danger-zone.mp3';
    
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
        
        // Try to play and immediately pause a silent audio
        if (preloadedAudio) {
            const originalVolume = preloadedAudio.volume;
            preloadedAudio.volume = 0; // Silent
            
            preloadedAudio.play().then(() => {
                preloadedAudio.pause();
                preloadedAudio.currentTime = 0;
                preloadedAudio.volume = originalVolume;
                audioUnlocked = true;
                console.log('✅ Audio unlocked successfully!');
                
                // Remove listeners once unlocked
                unlockEvents.forEach(event => {
                    document.removeEventListener(event, unlockAudio, true);
                });
            }).catch(e => {
                console.log('🔓 Audio unlock attempt failed:', e);
            });
        }
        
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
    
    // Set up drink refill timer (every hour)
    setInterval(refillAlexDrinks, 60 * 60 * 1000); // Every hour
    
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
                    console.log('🍺 Showing drink assignment alert for all users!');
                    showDrinkAssignmentAlert(drinkData);
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
                console.log(`🍺 Alex drink credits loaded: ${alexDrinkCredits}`);
                
                // Update UI if Alex is logged in
                if (isPlayerLoggedIn && currentPlayer === 'Alex') {
                    updateAlexDrinkUI();
                }
            } else {
                // Initialize with starting credits
                alexDrinkCredits = ALEX_DRINKS_PER_HOUR;
                alexLastDrinkRefill = Date.now();
                saveAlexDrinkCredits();
            }
        });
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
                alert(`🍺 DRINK REFILL! 🍺\n\nYou received ${addedCredits} new drink credits!\nTotal available: ${alexDrinkCredits}`);
            }
        }
    }
}

function showAlexDrinkButton() {
    // Only show for Alex when he's logged in
    if (isPlayerLoggedIn && currentPlayer === 'Alex') {
        return `
            <div style="text-align: center; margin: 20px 0; padding: 15px; background: linear-gradient(45deg, #4CAF50, #45a049); border-radius: 10px;">
                <h4 style="color: white; margin: 0 0 10px 0;">🍺 ALEX'S DRINK ASSIGNMENT 🍺</h4>
                <p style="color: white; margin: 5px 0;">Available Drinks: <strong>${alexDrinkCredits}</strong></p>
                <button class="transfer-btn" onclick="showDrinkAssignmentModal()" style="background: linear-gradient(45deg, #FF9800, #F57C00); color: white; font-weight: bold;">
                    🍻 ASSIGN DRINKS 🍻
                </button>
                <p style="font-size: 0.8em; color: #E8F5E8; margin: 5px 0 0 0;">
                    You get 10 drinks per hour (max 20). Keep the boys accountable! 🍺
                </p>
            </div>
        `;
    }
    return '';
}

function updateAlexDrinkUI() {
    // Update the drink button if it exists
    const alexDrinkSection = document.getElementById('alexDrinkSection');
    if (alexDrinkSection) {
        alexDrinkSection.innerHTML = showAlexDrinkButton();
    }
}

// Drink Assignment Modal Functions
function showDrinkAssignmentModal() {
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

function assignDrinks() {
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
        
        // Broadcast drink assignment with message
        broadcastDrinkAssignment(assignments, totalDrinks, alexMessage);
        
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

function showDrinkAssignmentAlert(drinkData) {
    // Prevent duplicate alerts for the same event
    if (window.lastDrinkAssignmentAlert === drinkData.timestamp) {
        console.log('🍺 Duplicate drink assignment alert prevented');
        return;
    }
    window.lastDrinkAssignmentAlert = drinkData.timestamp;
    
    // Play drink assignment audio if available (you can add this later)
    // playDrinkAssignmentAudio();
    
    // Create drink assignment alert content
    let alertContent = `
        <div style="font-size: 2rem; margin-bottom: 20px;">🍻</div>
        <div style="font-weight: bold; margin-bottom: 15px;">Alex assigned drinks to:</div>
    `;
    
    Object.entries(drinkData.assignments).forEach(([player, drinks]) => {
        alertContent += `
            <div style="margin: 10px 0; padding: 10px; background: rgba(76,175,80,0.1); border-radius: 5px;">
                <strong>${player}</strong>: ${drinks} drink${drinks > 1 ? 's' : ''}
            </div>
        `;
    });
    
    alertContent += `
        <div style="margin-top: 20px; font-size: 1.1em; color: #4CAF50; font-weight: bold;">
            Total: ${drinkData.totalDrinks} drink${drinkData.totalDrinks > 1 ? 's' : ''} assigned!
        </div>
    `;
    
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
    
    alertContent += `
        <div style="margin-top: 15px; font-size: 0.9em; color: #666;">
            Keep each other accountable! 🍺
        </div>
    `;
    
    document.getElementById('drinkAlertContent').innerHTML = alertContent;
    document.getElementById('drinkAssignmentAlert').style.display = 'flex';
    
    // Store assignment data for acknowledgment
    window.currentDrinkAssignment = drinkData;
    
    console.log('🍺 Drink assignment alert displayed for all users!');
}

function acknowledgeDrinks() {
    document.getElementById('drinkAssignmentAlert').style.display = 'none';
    
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
    
    if (players[currentPlayer] < amount) {
        alert(`🚫 You only have ${players[currentPlayer]} points! You cannot send ${amount} points.`);
        return;
    }
    
    // Transfer points
    players[currentPlayer] -= amount;
    players[toPlayer] += amount;
    
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

function rollHogwash() {
    const playerName = document.getElementById('hogwashPlayer').value;
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

    // Close the selection modal
    closeHogwashModal();

    // Define possible outcomes
    const outcomes = [
        {
            type: 'drink',
            title: '🍺 TAKE A DRINK YOU PIG! 🍺',
            action: () => {
                const drinks = Math.floor(Math.random() * 9) + 1; // 1-9
                const drinkType = drinks === 9 ? 'FULL DRINK' : `${drinks} DRINK${drinks > 1 ? 'S' : ''}`;
                return `${playerName} must take ${drinkType}!`;
            },
            color: '#ff6b6b'
        },
        {
            type: 'danger',
            title: '⚠️ DANGER ZONE ⚠️',
            action: () => {
                // Broadcast DANGER ZONE to all connected devices
                broadcastDangerZone(playerName);
                return `${playerName} triggered the DANGER ZONE! 💀 ALL PLAYERS BEWARE!`;
            },
            color: '#ff4757'
        },
        {
            type: 'win',
            title: '🎉 WIN POINTS FROM GOD! 🎉',
            action: () => {
                const points = Math.floor(Math.random() * 10) + 1; // 1-10
                players[playerName] += points;
                players['GOD'] -= points;
                savePlayers();
                return `${playerName} wins ${points} points from GOD! 🙏`;
            },
            color: '#2ed573'
        },
        {
            type: 'lose',
            title: '😈 LOSE POINTS TO GOD! 😈',
            action: () => {
                const points = Math.floor(Math.random() * 10) + 1; // 1-10
                players[playerName] -= points;
                players['GOD'] += points;
                savePlayers();
                return `${playerName} loses ${points} points to GOD! 💸`;
            },
            color: '#ff3838'
        }
    ];

    // Check if DANGER ZONE test mode is active
    let outcome;
    if (forceDangerZoneNext) {
        // Force DANGER ZONE for testing
        outcome = outcomes.find(o => o.type === 'danger');
        forceDangerZoneNext = false; // Reset flag after use
        
        // Reset test button appearance
        const testButton = document.querySelector('button[onclick="testDangerZoneAlert()"]');
        if (testButton) {
            testButton.textContent = '💀 TEST DANGER ZONE ALERT 💀';
            testButton.style.animation = '';
        }
        
        console.log('🚨 DANGER ZONE forced for testing!');
    } else {
        // Normal random outcome
        outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    }
    
    const resultText = outcome.action();

    // Show result modal
    document.getElementById('hogwashResultTitle').textContent = outcome.title;
    document.getElementById('hogwashResultContent').innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 20px;">🎲</div>
        <div style="color: ${outcome.color}; font-weight: bold;">${resultText}</div>
    `;
    document.querySelector('.hogwash-result').style.background = `linear-gradient(135deg, ${outcome.color}, #764ba2)`;
    
    document.getElementById('hogwashResultModal').style.display = 'flex';

    // Update leaderboard if points changed
    if (outcome.type === 'win' || outcome.type === 'lose') {
        updateLeaderboard();
        if (isPlayerLoggedIn) {
            updatePlayerUI();
        }
    }

    // Log activity
    addActivity('hogwash', '🎲', resultText);
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
    players[currentEditPlayer] = newScore;
    
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

// Add some random pig sounds
const pigSounds = ['🐷 OINK!', '🐷 SNORT!', '🐷 SQUEAL!'];
setInterval(() => {
    if (Math.random() < 0.1) {
        const sound = pigSounds[Math.floor(Math.random() * pigSounds.length)];
        console.log(sound);
    }
}, 5000);
