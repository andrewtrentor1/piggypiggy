// MBE Pig Points - Activity Feed System

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
    console.log('📝 addActivity called with:', { type, emoji, message, extraData });
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

// Make activity functions globally accessible
window.loadActivityFeed = loadActivityFeed;
window.addActivity = addActivity;
window.saveActivity = saveActivity;
