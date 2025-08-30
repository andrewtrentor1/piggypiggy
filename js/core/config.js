// MBE Pig Points - Configuration and Global Variables

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

// Global state variables
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
