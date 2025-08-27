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
    
    if (isPlayerLoggedIn && currentPlayer) {
        // User is logged in - auto-select them and make it non-editable
        playerSelect.value = currentPlayer;
        playerSelect.disabled = true;
        playerLabel.textContent = `${currentPlayer} is gambling!`;
        modalDescription.textContent = `You're logged in as ${currentPlayer}. Ready to risk it with the pig gods?`;
        
        // Add visual indication that it's auto-selected
        playerSelect.style.backgroundColor = '#f0f8ff';
        playerSelect.style.color = '#2c5282';
        playerSelect.style.fontWeight = 'bold';
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
            action: () => `${playerName} is in the DANGER ZONE! 💀`,
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

    // Random outcome
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
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
