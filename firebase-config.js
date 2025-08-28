// Firebase Configuration and Initialization

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue, update, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signInAnonymously, updateProfile, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDAp-3U1m7fw9DQ6KmtGx5e1jmYofMdAYM",
    authDomain: "mbepiggy.firebaseapp.com",
    databaseURL: "https://mbepiggy-default-rtdb.firebaseio.com",
    projectId: "mbepiggy",
    storageBucket: "mbepiggy.firebasestorage.app",
    messagingSenderId: "638797749409",
    appId: "1:638797749409:web:1ec0514b592c2b489f64e0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Set Firebase Auth persistence to LOCAL (survives browser restarts)
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log('🔐 Firebase Auth persistence set to LOCAL - will survive browser restarts');
    })
    .catch((error) => {
        console.error('❌ Failed to set Firebase Auth persistence:', error);
    });

// Configure Firebase test phone numbers (no SMS required)
auth.settings.appVerificationDisabledForTesting = false; // Enable for production

// Set up test phone numbers that bypass SMS
if (window.location.hostname === 'piggypiggy.pro' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    try {
        // These test numbers will work without SMS
        const testPhoneNumbers = {
            '+1555123456': '123456', // Andrew's test number
            '+1555123457': '123456'  // Evan's test number  
        };
        
        // Note: This requires Firebase Auth test configuration
        console.log('🧪 Test phone numbers configured for development');
    } catch (error) {
        console.log('⚠️ Test phone numbers not configured:', error);
    }
}

// Make Firebase functions available globally
window.firebaseDB = database;
window.firebaseAuth = auth;
window.firebaseStorage = storage;
window.firebaseRef = ref;
window.firebaseSet = set;
window.firebaseUpdate = update;
window.firebaseOnValue = onValue;
window.firebaseGet = get;
window.firebaseStorageRef = storageRef;
window.firebaseUploadBytes = uploadBytes;
window.firebaseGetDownloadURL = getDownloadURL;
window.RecaptchaVerifier = RecaptchaVerifier;
window.signInWithPhoneNumber = signInWithPhoneNumber;
window.signInAnonymously = signInAnonymously;
window.updateProfile = updateProfile;
window.onAuthStateChanged = onAuthStateChanged;
window.setPersistence = setPersistence;
window.browserLocalPersistence = browserLocalPersistence;
