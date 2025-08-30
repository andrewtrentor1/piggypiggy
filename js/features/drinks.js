// MBE Pig Points - Drink Assignment System

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
        
        const assignedBy = drinkData.assignedBy || 'Someone';
            
        alertContent = `
            <div style="font-size: 2rem; margin-bottom: 20px;">👀</div>
            <div style="font-weight: bold; margin-bottom: 15px; font-size: 1.3em;">HOLD THE HOG ACCOUNTABLE</div>
            <div style="margin: 15px 0; padding: 15px; background: rgba(255,152,0,0.2); border-radius: 8px; border: 2px solid #FF9800;">
                <div style="font-size: 1.1em; font-weight: bold; color: #E65100; margin-bottom: 10px;">
                    ${assignedBy} assigned drinks to:
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
    
    // Add sender's message if provided
    if (drinkData.message && drinkData.message.trim()) {
        const assignedBy = drinkData.assignedBy || 'Someone';
        alertContent += `
            <div style="margin: 20px 0; padding: 15px; background: linear-gradient(45deg, #E3F2FD, #BBDEFB); border-radius: 8px; border-left: 4px solid #2196F3;">
                <div style="font-weight: bold; color: #1976D2; margin-bottom: 8px; display: flex; align-items: center;">
                    📝 Message from ${assignedBy}:
                </div>
                <div style="font-style: italic; color: #424242; font-size: 1.1em; line-height: 1.4;">
                    "${drinkData.message}"
                </div>
            </div>
        `;
    }
    
    // Create and show the modal
    const modal = document.createElement('div');
    modal.id = 'drinkAssignmentAlert';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: center;">
            <div id="drinkAlertTitle" style="font-size: 1.5em; font-weight: bold; margin-bottom: 20px; color: #333;">
                🍺 DRINK ASSIGNMENT ALERT 🍺
            </div>
            <div id="drinkAlertContent">
                ${alertContent}
            </div>
            <div style="margin-top: 20px;">
                <button class="transfer-btn" onclick="acknowledgeDrinks()" style="background: ${buttonColor}; color: white; font-weight: bold; padding: 12px 24px; border-radius: 5px; border: none; cursor: pointer; font-size: 1.1em;">
                    ${buttonText}
                </button>
                ${isAssignedDrinks ? `<button id="uploadProofBtn" onclick="showUploadProofModal()" style="background: linear-gradient(45deg, #FF9800, #F57C00); color: white; border: none; padding: 12px 24px; border-radius: 5px; font-weight: bold; font-size: 1.1em; cursor: pointer; margin-top: 15px; margin-left: 10px; display: none;">📸 UPLOAD PROOF</button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Store current assignment for proof upload
    window.currentDrinkAssignment = drinkData;
}

function acknowledgeDrinks() {
    document.getElementById('drinkAssignmentAlert').style.display = 'none';
    
    // Log acknowledgment in activity feed
    if (window.currentDrinkAssignment) {
        const drinkData = window.currentDrinkAssignment;
        const playerDrinks = drinkData.assignments[currentPlayer] || 0;
        
        if (playerDrinks > 0) {
            addActivity('drink_acknowledgment', '🍺', `${currentPlayer} acknowledged ${playerDrinks} drink${playerDrinks > 1 ? 's' : ''} assignment`);
            
            // Send acknowledgment to Firebase
            sendDrinkAcknowledgment(drinkData);
            
            // Show upload proof button
            const uploadProofBtn = document.getElementById('uploadProofBtn');
            if (uploadProofBtn) {
                uploadProofBtn.style.display = 'inline-block';
            }
        } else {
            addActivity('drink_accountability', '👀', `${currentPlayer} is holding others accountable for their drinks`);
        }
    }
    
    // Remove the modal after a short delay
    setTimeout(() => {
        const modal = document.getElementById('drinkAssignmentAlert');
        if (modal) {
            modal.remove();
        }
    }, 100);
}

function sendDrinkAcknowledgment(drinkData) {
    if (!window.firebaseDB) return;
    
    const acknowledgmentData = {
        playerName: currentPlayer,
        assignmentId: drinkData.eventId,
        timestamp: new Date().toISOString(),
        acknowledged: true
    };
    
    const ackRef = window.firebaseRef(window.firebaseDB, `drinkAcknowledgments/${drinkData.eventId}_${currentPlayer}`);
    window.firebaseSet(ackRef, acknowledgmentData)
        .then(() => {
            console.log('🍺 Drink acknowledgment sent to Firebase');
        })
        .catch((error) => {
            console.error('❌ Failed to send drink acknowledgment:', error);
        });
}

// Make drink functions globally accessible
window.initializeAlexDrinkSystem = initializeAlexDrinkSystem;
window.loadAlexDrinkCredits = loadAlexDrinkCredits;
window.saveAlexDrinkCredits = saveAlexDrinkCredits;
window.refillAlexDrinks = refillAlexDrinks;
window.showDrinkAssignmentAlert = showDrinkAssignmentAlert;
window.acknowledgeDrinks = acknowledgeDrinks;
window.sendDrinkAcknowledgment = sendDrinkAcknowledgment;
