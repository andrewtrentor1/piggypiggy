// MBE Pig Points - HOGWASH System

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

function resetHogwashCooldowns() {
    if (confirm('🚫 RESET ALL HOGWASH COOLDOWNS? 🚫\n\nThis will allow all players to HOGWASH immediately.\n\nAre you sure?')) {
        hogwashCooldowns = {};
        saveHogwashCooldowns();
        alert('✅ All HOGWASH cooldowns have been reset!');
        console.log('🕐 All HOGWASH cooldowns reset by bookkeeper');
    }
}

// Make HOGWASH cooldown functions globally accessible
window.loadHogwashCooldowns = loadHogwashCooldowns;
window.saveHogwashCooldowns = saveHogwashCooldowns;
window.isPlayerOnHogwashCooldown = isPlayerOnHogwashCooldown;
window.getHogwashCooldownRemaining = getHogwashCooldownRemaining;
window.formatCooldownTime = formatCooldownTime;
window.setPlayerHogwashCooldown = setPlayerHogwashCooldown;
window.validateHogwashAttempt = validateHogwashAttempt;
window.resetHogwashCooldowns = resetHogwashCooldowns;
