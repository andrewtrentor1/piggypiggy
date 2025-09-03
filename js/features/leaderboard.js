// MBE Pig Points - Leaderboard System

function updateLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    const leaderboardList = document.getElementById('leaderboardList');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    console.log('🏆 updateLeaderboard called, players:', players);
    console.log('🏆 leaderboard element:', leaderboard);
    
    // Safety check - if leaderboard element doesn't exist, we're not on the main page
    if (!leaderboard || !leaderboardList) {
        console.log('🏆 No leaderboard elements found - not on main page');
        return;
    }
    
    // Safety check - if players object is empty, keep loading indicator visible
    if (!players || Object.keys(players).length === 0) {
        console.log('🏆 Players data not ready yet, keeping loading indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        leaderboardList.style.display = 'none';
        return;
    }
    
    // Hide loading indicator and show leaderboard list
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    leaderboardList.style.display = 'block';
    
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
    
    leaderboardList.innerHTML = '';
    
    // Add regular players first
    sortedPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        li.className = 'player';
        
        // Only show pig styling if there's actually a lowest score (not a tie)
        if (!allSamePoints && player[1].points === minPoints) {
            li.classList.add('pig');
        }
        
        // Add leader styling if there's actually a highest score (not a tie)
        if (!allSamePoints && player[1].points === maxPoints) {
            li.classList.add('leader');
        }
        
        const playerInsult = getPlayerInsult(player[0]);
        const powerUps = player[1].powerUps;
        const totalPowerUps = powerUps.mulligans + powerUps.reverseMulligans + powerUps.giveDrinks;
        
        li.innerHTML = `
            <div class="player-name">
                ${!allSamePoints && player[1].points === maxPoints ? '<span class="crown">👑</span>' : ''}
                ${!allSamePoints && player[1].points === minPoints ? '<span>🐷 THE PIG 🐷</span>' : ''}
                <span>${player[0]}</span>
                <span class="poop-bag" onclick="showPowerUpModal('${player[0]}')" title="View ${player[0]}'s Power-Ups (${totalPowerUps} total)" style="cursor: pointer; font-size: 1em;">🎒</span>
                <span class="pig-insult">${playerInsult}</span>
            </div>
            <div class="points">
                ${player[1].points} 🐷
                ${isBookkeeperLoggedIn ? `<button class="edit-score-btn" onclick="openScoreEditModal('${player[0]}', ${player[1].points})" title="Edit ${player[0]}'s score">✏️</button>` : ''}
            </div>
        `;
        
        leaderboardList.appendChild(li);
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
        
        leaderboardList.appendChild(li);
    }
    
    console.log('🏆 Leaderboard updated successfully');
}

// Manual refresh function for debugging
function refreshLeaderboard() {
    console.log('🏆 Manual leaderboard refresh requested');
    console.log('🏆 Current players:', players);
    updateLeaderboard();
}

// Make functions available globally
window.updateLeaderboard = updateLeaderboard;
window.refreshLeaderboard = refreshLeaderboard;
