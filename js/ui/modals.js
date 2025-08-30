// MBE Pig Points - UI and Modal Management

// Common modal functions
function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

function closeShameModal() {
    document.getElementById('shameModal').style.display = 'none';
}

function closeGodModal() {
    document.getElementById('godModal').style.display = 'none';
}

function closePlayerLoginModal() {
    const modal = document.getElementById('playerLoginModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clear any input fields
        const phoneInput = document.getElementById('phoneNumber');
        const codeInput = document.getElementById('verificationCode');
        if (phoneInput) phoneInput.value = '';
        if (codeInput) codeInput.value = '';
        
        // Reset any error messages
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) errorDiv.textContent = '';
    }
}

function closePowerUpModal() {
    document.getElementById('powerUpModal').style.display = 'none';
}

function closeDrinkAssignmentModal() {
    document.getElementById('drinkAssignmentModal').style.display = 'none';
    
    // Reset all drink assignments
    const inputs = document.querySelectorAll('.drink-assignment-input');
    inputs.forEach(input => {
        input.value = 0;
    });
    
    // Update total display
    updateTotalDrinksToAssign();
}

// Player UI update function
function updatePlayerUI() {
    console.log('🎮 Updating player UI for:', currentPlayer);
    
    if (!isPlayerLoggedIn || !currentPlayer) {
        console.log('🎮 No player logged in, hiding player UI');
        return;
    }
    
    const playerData = players[currentPlayer];
    if (!playerData) {
        console.log('🎮 No player data found for:', currentPlayer);
        return;
    }
    
    // Update status bar
    updateStatusBar();
    
    // Update any player-specific UI elements
    const playerNameElements = document.querySelectorAll('.current-player-name');
    playerNameElements.forEach(element => {
        element.textContent = currentPlayer;
    });
    
    const playerPointsElements = document.querySelectorAll('.current-player-points');
    playerPointsElements.forEach(element => {
        element.textContent = playerData.points;
    });
    
    // Update power-ups display if it exists
    const powerUpsElement = document.getElementById('currentPlayerPowerUps');
    if (powerUpsElement && playerData.powerUps) {
        const powerUps = playerData.powerUps;
        const totalPowerUps = powerUps.mulligans + powerUps.reverseMulligans + powerUps.giveDrinks;
        powerUpsElement.textContent = `${totalPowerUps} power-ups`;
    }
    
    console.log('🎮 Player UI updated successfully');
}

// Status bar update function
function updateStatusBar() {
    const statusBar = document.getElementById('statusBar');
    const statusPlayerName = document.getElementById('statusPlayerName');
    const statusPlayerPoints = document.getElementById('statusPlayerPoints');
    
    if (!statusBar || !statusPlayerName || !statusPlayerPoints) {
        return; // Status bar elements don't exist on this page
    }
    
    if (isPlayerLoggedIn && currentPlayer) {
        const playerData = players[currentPlayer];
        if (playerData) {
            statusPlayerName.textContent = currentPlayer;
            // Handle both old (number) and new (object) data structures
            const points = typeof playerData === 'number' ? playerData : playerData.points;
            statusPlayerPoints.textContent = `${points} points`;
            statusBar.style.display = 'flex';
        }
    } else {
        statusBar.style.display = 'none';
    }
}

// Quick logout function
function quickLogout() {
    if (confirm('🐷 LOG OUT? 🐷\n\nAre you sure you want to log out?')) {
        // Sign out from Firebase Auth
        if (window.firebaseAuth) {
            window.firebaseAuth.signOut().then(() => {
                console.log('🔐 User signed out successfully');
            }).catch((error) => {
                console.error('❌ Sign out error:', error);
            });
        }
        
        // Clear local state
        isPlayerLoggedIn = false;
        currentPlayer = '';
        
        // Clear localStorage flags
        localStorage.removeItem('firebaseAuthLoggedIn');
        
        // Update UI
        updateStatusBar();
        updateLeaderboard();
        
        alert('👋 Logged out successfully!');
    }
}

// Make UI functions globally accessible
window.closeLoginModal = closeLoginModal;
window.closeShameModal = closeShameModal;
window.closeGodModal = closeGodModal;
window.closePlayerLoginModal = closePlayerLoginModal;
window.closePowerUpModal = closePowerUpModal;
window.closeDrinkAssignmentModal = closeDrinkAssignmentModal;
window.updatePlayerUI = updatePlayerUI;
window.updateStatusBar = updateStatusBar;
window.quickLogout = quickLogout;
