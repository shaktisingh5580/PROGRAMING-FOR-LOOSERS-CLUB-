// assignment.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc as getFirestoreDoc, updateDoc, increment, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// REMOVED: Firebase Messaging imports

// Your Firebase Configuration (remains the same)
const firebaseConfig = {
    apiKey: "AIzaSyCCc1y2kNbSftG45mB3gkbUCGs4gfjts-E",
    authDomain: "realtimepfl.firebaseapp.com",
    databaseURL: "https://realtimepfl-default-rtdb.firebaseio.com",
    projectId: "realtimepfl",
    storageBucket: "realtimepfl.firebasestorage.app",
    messagingSenderId: "984202175754",
    appId: "1:984202175754:web:a0d689738832cc48b686f3",
    measurementId: "G-4W311B25HV"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// REMOVED: messaging initialization

// --- DOM Elements (remains the same) ---
const assignmentsGridEl = document.getElementById('assignmentsGrid');
const showUploadFormBtnEl = document.getElementById('showUploadFormBtn');
const uploadModalEl = document.getElementById('uploadModal');
const closeUploadModalBtnEl = document.getElementById('closeUploadModalBtn');
const uploadAssignmentFormEl = document.getElementById('uploadAssignmentForm');
const getDriveLinkHelperBtnEl = document.getElementById('getDriveLinkHelperBtn');
const uploadFormErrorEl = document.getElementById('uploadFormError');
const searchTermInputEl = document.getElementById('searchTerm');
const filterSemesterSelectEl = document.getElementById('filterSemester');
const filterSubjectSelectEl = document.getElementById('filterSubject');
const filterAssignmentNumberInputEl = document.getElementById('filterAssignmentNumber');
const sortBySelectEl = document.getElementById('sortBy');
const applyFiltersBtnEl = document.getElementById('applyFiltersBtn');
const resetFiltersBtnEl = document.getElementById('resetFiltersBtn');
const assignmentUserEmailEl = document.getElementById('assignmentUserEmail');
const assignmentLogoutBtnEl = document.getElementById('assignmentLogoutBtn');
const assignmentLoginBtnEl = document.getElementById('assignmentLoginBtn');
const assignmentAuthModalEl = document.getElementById('assignmentAuthModal');
const assignmentAuthTitleEl = document.getElementById('assignmentAuthTitle');
const assignmentAuthFormEl = document.getElementById('assignmentAuthForm');
const assignmentAuthErrorEl = document.getElementById('assignmentAuthError');
const assignmentAuthSubmitBtnEl = document.getElementById('assignmentAuthSubmitBtn');
const closeAssignmentAuthModalBtnEl = document.getElementById('closeAssignmentAuthModalBtn');
const assignmentSwitchToSignupLinkEl = document.getElementById('assignmentSwitchToSignupLink');
const assignmentSwitchToLoginLinkEl = document.getElementById('assignmentSwitchToLoginLink');
const uploaderProfileModalEl = document.getElementById('uploaderProfileModal');
const closeUploaderProfileModalBtnEl = document.getElementById('closeUploaderProfileModalBtn');

// Notification Settings DOM Elements
const notificationSettingsBtnEl = document.getElementById('notificationSettingsBtn');
const notificationSettingsModalEl = document.getElementById('notificationSettingsModal');
const closeNotificationSettingsModalBtnEl = document.getElementById('closeNotificationSettingsModalBtn');
const notificationSettingsFormEl = document.getElementById('notificationSettingsForm');
const semesterNotificationCheckboxesEl = document.getElementById('semesterNotificationCheckboxes');
const enablePushNotificationsBtnEl = document.getElementById('enablePushNotificationsBtn');
const pushNotificationStatusEl = document.getElementById('pushNotificationStatus');
const notificationSettingsErrorEl = document.getElementById('notificationSettingsError');

// --- Global State ---
let allAssignments = [];
let userNamesCache = {};
let currentAssignmentAuthMode = 'login';

// --- UTILITY FUNCTIONS (remains the same) ---
function showError(element, message) { if (element) { element.textContent = message; element.classList.remove('hidden'); } }
function clearError(element) { if (element) { element.textContent = ''; element.classList.add('hidden'); } }
function getOrdinalSuffix(nStr) {
    const n = parseInt(nStr);
    if (isNaN(n)) return typeof nStr === 'string' ? nStr : '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- AUTHENTICATION (Modified for OneSignal) ---
onAuthStateChanged(auth, user => {
    if (user) {
        assignmentUserEmailEl.textContent = user.email;
        assignmentLoginBtnEl.classList.add('hidden');
        assignmentLogoutBtnEl.classList.remove('hidden');
        showUploadFormBtnEl.classList.remove('hidden');
        notificationSettingsBtnEl.classList.remove('hidden');
        
        // OneSignal: Associate the logged-in user with their OneSignal Player ID
        OneSignal.push(function() {
            OneSignal.setExternalUserId(user.uid);
        });

        if (assignmentAuthModalEl.classList.contains('active')) {
            assignmentAuthModalEl.classList.remove('active');
            document.body.style.overflow = '';
        }
        updatePushNotificationStatus(); // Update status text
    } else {
        assignmentUserEmailEl.textContent = 'Not logged in';
        assignmentLoginBtnEl.classList.remove('hidden');
        assignmentLogoutBtnEl.classList.add('hidden');
        showUploadFormBtnEl.classList.add('hidden');
        notificationSettingsBtnEl.classList.add('hidden');
        pushNotificationStatusEl.textContent = 'Status: Login to manage';

        // OneSignal: Disassociate user on logout
        OneSignal.push(function() {
            OneSignal.removeExternalUserId();
        });
    }
    if (allAssignments.length > 0) {
        applyCurrentFilters();
    }
});

// Logout: The OneSignal part is now handled in onAuthStateChanged
assignmentLogoutBtnEl.addEventListener('click', () => signOut(auth));

// --- NOTIFICATION SYSTEM (Re-written for OneSignal) ---

// This function updates the status text based on OneSignal's state.
async function updatePushNotificationStatus() {
    const permission = await OneSignal.getNotificationPermission();
    const isPushEnabled = await OneSignal.isPushNotificationsEnabled();

    if (isPushEnabled) {
        pushNotificationStatusEl.textContent = 'Status: Enabled';
        enablePushNotificationsBtnEl.disabled = true;
    } else if (permission === 'denied') {
        pushNotificationStatusEl.textContent = 'Status: Blocked in browser settings';
        enablePushNotificationsBtnEl.disabled = true;
    } else {
        pushNotificationStatusEl.textContent = 'Status: Click to enable';
        enablePushNotificationsBtnEl.disabled = false;
    }
}

// Manually trigger the OneSignal prompt.
enablePushNotificationsBtnEl.addEventListener('click', async () => {
    OneSignal.push(function() {
        OneSignal.showSlidedownPrompt();
    });
});

// OneSignal automatically shows the prompt, but we listen for changes to update the UI.
OneSignal.push(function() {
    OneSignal.on('subscriptionChange', function(isSubscribed) {
        console.log("The user's subscription state is now:", isSubscribed);
        updatePushNotificationStatus();
    });
});

// Populate the semester checkboxes in the modal (same as before)
function populateSemesterCheckboxes() {
    semesterNotificationCheckboxesEl.innerHTML = '';
    const allLabel = document.createElement('label');
    allLabel.innerHTML = `<input type="checkbox" name="notifySemesters" value="all"> All Semesters`;
    semesterNotificationCheckboxesEl.appendChild(allLabel);
    semesterNotificationCheckboxesEl.appendChild(document.createElement('br'));

    for (let i = 1; i <= 8; i++) {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" name="notifySemesters" value="${i}"> ${getOrdinalSuffix(i)} Semester`;
        semesterNotificationCheckboxesEl.appendChild(label);
        if (i % 2 === 0 && i < 8) semesterNotificationCheckboxesEl.appendChild(document.createElement('br'));
    }
}

// Load user's saved notification preferences from Firestore to check the right boxes.
async function loadNotificationSettings() {
    const user = auth.currentUser;
    if (!user) return;

    populateSemesterCheckboxes();
    updatePushNotificationStatus();

    const prefDocRef = doc(db, 'userNotificationPreferences', user.uid);
    try {
        const docSnap = await getFirestoreDoc(prefDocRef);
        if (docSnap.exists()) {
            const prefs = docSnap.data();
            const selectedSemesters = prefs.notifyForSemesters || [];
            notificationSettingsFormEl.querySelectorAll('input[name="notifySemesters"]').forEach(cb => {
                cb.checked = selectedSemesters.includes(cb.value);
            });
        }
    } catch (error) {
        console.error("Error loading notification settings:", error);
        showError(notificationSettingsErrorEl, "Could not load settings.");
    }
}

// Save notification settings to Firestore AND set tags on OneSignal.
async function saveNotificationSettings(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { showError(notificationSettingsErrorEl, "You must be logged in."); return; }
    
    clearError(notificationSettingsErrorEl);
    const submitBtn = notificationSettingsFormEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const selectedCheckboxes = notificationSettingsFormEl.querySelectorAll('input[name="notifySemesters"]:checked');
    let selectedSemesters = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (selectedSemesters.includes("all")) {
        selectedSemesters = ["all"];
    }

    // --- OneSignal Tagging Logic ---
    // 1. Define all possible tags to clear them first.
    const allPossibleTags = ['semester_1', 'semester_2', 'semester_3', 'semester_4', 'semester_5', 'semester_6', 'semester_7', 'semester_8', 'semester_all'];
    
    // 2. Create the new tags object.
    const newTags = {};
    selectedSemesters.forEach(sem => {
        newTags[`semester_${sem}`] = 'true';
    });

    console.log('Deleting old tags:', allPossibleTags);
    console.log('Setting new tags:', newTags);

    // 3. Delete old tags and send new ones.
    OneSignal.push(function() {
        OneSignal.deleteTags(allPossibleTags).then(() => {
            OneSignal.sendTags(newTags);
        });
    });
    // --- End OneSignal Logic ---

    // Save preferences to Firestore so we can load them back into the UI next time.
    const prefData = {
        userId: user.uid,
        email: user.email,
        notifyForSemesters: selectedSemesters,
        lastUpdated: serverTimestamp()
        // We no longer save the fcmToken here.
    };

    const prefDocRef = doc(db, 'userNotificationPreferences', user.uid);
    try {
        await setDoc(prefDocRef, prefData, { merge: true });
        alert('Notification settings saved!');
        notificationSettingsModalEl.classList.remove('active');
        document.body.style.overflow = '';
    } catch (error) {
        console.error("Error saving notification settings:", error);
        showError(notificationSettingsErrorEl, `Save Error: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Settings';
    }
}

// Event Listeners for Notification Modal
notificationSettingsBtnEl.addEventListener('click', () => {
    if(!auth.currentUser) { openAssignmentAuthModal('login'); return; }
    loadNotificationSettings();
    notificationSettingsModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
});
closeNotificationSettingsModalBtnEl.addEventListener('click', () => {
    notificationSettingsModalEl.classList.remove('active');
    document.body.style.overflow = '';
});
notificationSettingsFormEl.addEventListener('submit', saveNotificationSettings);


// --- ASSIGNMENT UPLOAD (Modified to call our Netlify function) ---

async function handleFormSubmit(event) {
    event.preventDefault();
    clearError(uploadFormErrorEl);
    const user = auth.currentUser;
    if (!user) {
        showError(uploadFormErrorEl, "You must be logged in to upload.");
        return;
    }
    const submitButton = uploadAssignmentFormEl.querySelector('button[type="submit"]');
    if (!submitButton) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const newAssignmentForDb = {
        uploaderId: user.uid,
        uploaderEmail: user.email,
        assignmentTitle: uploadAssignmentFormEl.assignmentTitle.value.trim(),
        subject: uploadAssignmentFormEl.subject.value.trim(),
        semester: uploadAssignmentFormEl.semester.value,
        assignmentNumber: uploadAssignmentFormEl.assignmentNumber.value.trim(),
        keywords: uploadAssignmentFormEl.keywords.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        driveLink: uploadAssignmentFormEl.driveLink.value.trim(),
        uploadDate: serverTimestamp(),
        votes: 0,
        votedBy: []
    };

    const newAssignmentForFunction = {
        assignmentTitle: newAssignmentForDb.assignmentTitle,
        subject: newAssignmentForDb.subject,
        semester: newAssignmentForDb.semester
    };

    try {
        await addDoc(collection(db, "assignments"), newAssignmentForDb);

        uploadModalEl.classList.remove('active');
        document.body.style.overflow = '';
        alert('Assignment uploaded successfully! Notifications will be sent shortly.');

        // Trigger the Netlify notification function.
        const netlifyFunctionUrl = '/.netlify/functions/sendNotification';
        
        // This secret MUST match the FUNCTION_SECRET_KEY in your Netlify environment variables.
        const mySecret = 'my-super-secret-pfl-key-12345'; // <-- !!! REPLACE THIS with the one you set on Netlify !!!

        fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignment: newAssignmentForFunction,
                secret: mySecret
            })
        })
        .then(response => response.json())
        .then(data => console.log('Notification function response:', data))
        .catch(err => console.error('Error triggering notification function:', err));

        fetchAssignments();

    } catch (error) {
        console.error("Error adding assignment: ", error);
        showError(uploadFormErrorEl, `Upload Error: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Upload Assignment';
    }
}


// --- All other functions remain the same ---
// (fetchAssignments, renderAssignments, showUploadModal, handleVote, openUploaderProfileModal, etc.)
// ...[paste the rest of your original, unmodified functions here]...
// Example:
async function fetchAssignments() { /* ... no changes ... */ }
async function renderAssignments(assignmentsToRender) { /* ... no changes ... */ }
function showUploadModal() { /* ... no changes ... */ }
async function fetchUploaderNameFromUsersCollection(uploaderId, fallbackName = 'Anonymous') { /* ... no changes ... */ }
async function handleVote(assignmentId, voteButtonElement) { /* ... no changes ... */ }
async function openUploaderProfileModal(uploaderId) { /* ... no changes ... */ }
function populateAllFilters() { /* ... no changes ... */ }
async function applyCurrentFilters() { /* ... no changes ... */ }
function resetAllFilters() { /* ... no changes ... */ }
// etc...

// --- EVENT LISTENERS (No changes needed, but remove the service worker registration) ---
showUploadFormBtnEl.addEventListener('click', showUploadModal);
uploadAssignmentFormEl.addEventListener('submit', handleFormSubmit);
applyFiltersBtnEl.addEventListener('click', applyCurrentFilters);
resetFiltersBtnEl.addEventListener('click', resetAllFilters);
sortBySelectEl.addEventListener('change', applyCurrentFilters);
// ... [other event listeners for modals, etc.]

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAssignments();
    // REMOVED: The old service worker registration.
    // OneSignal handles its own service worker via the script in the HTML.
});

// --- Auth form functions (no changes) ---
async function handleAssignmentAuthFormSubmit(e) { /* ... no changes ... */ }
function openAssignmentAuthModal(mode = 'login') { /* ... no changes ... */ }
assignmentAuthFormEl.addEventListener('submit', handleAssignmentAuthFormSubmit);
// ... [rest of auth event listeners]
