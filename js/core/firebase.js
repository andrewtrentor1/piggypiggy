// MBE Pig Points - Firebase Integration

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
    
    // Initialize HOGWASH cooldowns now that Firebase is ready
    if (typeof loadHogwashCooldowns === 'function') {
        loadHogwashCooldowns();
        console.log('🕐 HOGWASH cooldowns initialized after Firebase ready');
    }
    
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
            
            // A password-only Ham Handler session does not require Firebase
            // player authentication. Preserve it while the launch gate's
            // maintenance tunnel is active; normal logout still removes the
            // bookkeeper flag and immediately reseals the pre-launch app.
            if (isBookkeeperLoggedIn && localStorage.getItem('bookkeeperLoggedIn') === 'true') {
                if (localStorage.getItem('mbeLaunchHandler') === 'true') {
                    isBookkeeperLoggedIn = true;
                    isPlayerLoggedIn = true;
                    currentPlayer = 'Evan';
                } else {
                    isBookkeeperLoggedIn = false;
                    localStorage.removeItem('bookkeeperLoggedIn');
                }
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

// Test Firebase connection (silent by default, pass showAlert=true for alerts)
function testFirebaseConnection(showAlert = false) {
    console.log('🔥 Testing Firebase connection...');
    
    if (!window.firebaseDB) {
        console.error('❌ Firebase database not available!');
        if (showAlert) alert('❌ Firebase not initialized! Check firebase-config.js');
        return;
    }
    
    const testRef = window.firebaseRef(window.firebaseDB, 'test');
    const testData = {
        message: 'Hello Firebase!',
        timestamp: new Date().toISOString(),
        random: Math.random()
    };
    
    window.firebaseSet(testRef, testData)
        .then(() => {
            console.log('✅ Firebase write test successful!');
            
            // Now test reading
            window.firebaseGet(testRef)
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        console.log('✅ Firebase read test successful!', snapshot.val());
                                    console.log('✅ Firebase connection working perfectly!');
            if (showAlert) alert('✅ Firebase connection working perfectly!');
                    } else {
                        console.error('❌ Firebase read test failed - no data');
                        if (showAlert) alert('❌ Firebase read test failed');
                    }
                })
                .catch((error) => {
                    console.error('❌ Firebase read test error:', error);
                    if (showAlert) alert('❌ Firebase read test failed: ' + error.message);
                });
        })
        .catch((error) => {
            console.error('❌ Firebase write test error:', error);
            if (showAlert) alert('❌ Firebase write test failed: ' + error.message);
        });
}

// Make functions available globally
window.initializeFirebase = initializeFirebase;
window.savePlayers = savePlayers;
window.testFirebaseConnection = testFirebaseConnection;
