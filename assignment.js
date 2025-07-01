// assignment.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc as getFirestoreDoc, updateDoc, increment, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging.js";

// Your Firebase Configuration
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
const messaging = getMessaging(app);

// --- DOM Elements ---
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

// --- UTILITY FUNCTIONS ---
function showError(element, message) { if (element) { element.textContent = message; element.classList.remove('hidden'); } }
function clearError(element) { if (element) { element.textContent = ''; element.classList.add('hidden'); } }
function getOrdinalSuffix(nStr) {
    const n = parseInt(nStr);
    if (isNaN(n)) return typeof nStr === 'string' ? nStr : '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        assignmentUserEmailEl.textContent = user.email;
        assignmentLoginBtnEl.classList.add('hidden');
        assignmentLogoutBtnEl.classList.remove('hidden');
        showUploadFormBtnEl.classList.remove('hidden');
        notificationSettingsBtnEl.classList.remove('hidden');

        if (assignmentAuthModalEl.classList.contains('active')) {
            assignmentAuthModalEl.classList.remove('active');
            document.body.style.overflow = '';
        }
        if (Notification.permission === "granted") {
            pushNotificationStatusEl.textContent = 'Status: Enabled (browser permission granted)';
        } else if (Notification.permission === "denied") {
            pushNotificationStatusEl.textContent = 'Status: Denied by browser';
            enablePushNotificationsBtnEl.disabled = true;
        } else {
            pushNotificationStatusEl.textContent = 'Status: Click to enable';
        }

    } else {
        assignmentUserEmailEl.textContent = 'Not logged in';
        assignmentLoginBtnEl.classList.remove('hidden');
        assignmentLogoutBtnEl.classList.add('hidden');
        showUploadFormBtnEl.classList.add('hidden');
        notificationSettingsBtnEl.classList.add('hidden');
        pushNotificationStatusEl.textContent = 'Status: Login to manage';
    }
    if (allAssignments.length > 0) {
        applyCurrentFilters();
    }
});

async function handleAssignmentAuthFormSubmit(e) {
    e.preventDefault(); clearError(assignmentAuthErrorEl);
    const email = assignmentAuthFormEl.authEmail.value; const password = assignmentAuthFormEl.authPassword.value;
    assignmentAuthSubmitBtnEl.disabled = true;
    const originalSubmitText = assignmentAuthSubmitBtnEl.textContent;
    assignmentAuthSubmitBtnEl.textContent = currentAssignmentAuthMode === 'login' ? 'Logging in...' : 'Signing up...';
    const authAction = currentAssignmentAuthMode === 'login' ? signInWithEmailAndPassword(auth, email, password) : createUserWithEmailAndPassword(auth, email, password);
    try { await authAction; } catch (error) { showError(assignmentAuthErrorEl, error.message);
    } finally { assignmentAuthSubmitBtnEl.disabled = false; assignmentAuthSubmitBtnEl.textContent = originalSubmitText; }
}

function openAssignmentAuthModal(mode = 'login') {
    currentAssignmentAuthMode = mode; assignmentAuthFormEl.reset(); clearError(assignmentAuthErrorEl);
    assignmentAuthTitleEl.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    assignmentAuthSubmitBtnEl.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    assignmentSwitchToSignupLinkEl.classList.toggle('hidden', mode === 'signup');
    assignmentSwitchToLoginLinkEl.classList.toggle('hidden', mode === 'login');
    assignmentAuthModalEl.classList.add('active'); document.body.style.overflow = 'hidden';
    if (assignmentAuthFormEl.authEmail) assignmentAuthFormEl.authEmail.focus();
}

assignmentLogoutBtnEl.addEventListener('click', () => signOut(auth));
assignmentLoginBtnEl.addEventListener('click', () => openAssignmentAuthModal('login'));
closeAssignmentAuthModalBtnEl.addEventListener('click', () => {
    assignmentAuthModalEl.classList.remove('active'); document.body.style.overflow = '';
});
assignmentAuthFormEl.addEventListener('submit', handleAssignmentAuthFormSubmit);
assignmentSwitchToSignupLinkEl.addEventListener('click', (e) => { e.preventDefault(); openAssignmentAuthModal('signup'); });
assignmentSwitchToLoginLinkEl.addEventListener('click', (e) => { e.preventDefault(); openAssignmentAuthModal('login'); });


// --- NOTIFICATION SYSTEM (CLIENT-SIDE) ---

// 1. FOREGROUND MESSAGES: Handle notifications when the user has the website open.
onMessage(messaging, (payload) => {
    console.log('Message received in foreground.', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/PROGRAMING-FOR-LOOSERS-CLUB-/HummingBird (1).png' // Make sure this path is correct
    };
    new Notification(notificationTitle, notificationOptions);
});

// 2. PERMISSION & TOKEN MANAGEMENT
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    pushNotificationStatusEl.textContent = 'Status: Requesting...';
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            pushNotificationStatusEl.textContent = 'Status: Granted. Fetching token...';
            // VAPID key is a public key for browser push services, it's safe to have in client-side code.
            const currentToken = await getToken(messaging, { vapidKey: 'BCZbrYYJ_xUYnUyq0fRtJx-VWmtMDUirXrrzqnX-nRvcDnIFlYkCEcvElKFP2_PkZAmO6j5ExR8KRJZu6Aj7X_s' });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                pushNotificationStatusEl.textContent = 'Status: Enabled (Token obtained)';
                return currentToken;
            } else {
                console.log('No registration token available. Request permission to generate one.');
                pushNotificationStatusEl.textContent = 'Status: Granted, but no token. Try again.';
            }
        } else {
            console.log('Unable to get permission to notify.');
            pushNotificationStatusEl.textContent = 'Status: Denied';
            enablePushNotificationsBtnEl.disabled = true;
        }
    } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
        pushNotificationStatusEl.textContent = `Status: Error (${err.message.substring(0, 50)}...)`;
    }
    return null;
}

// 3. NOTIFICATION SETTINGS UI & LOGIC
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

async function loadNotificationSettings() {
    const user = auth.currentUser;
    if (!user) return;

    populateSemesterCheckboxes();

    const prefDocRef = doc(db, 'userNotificationPreferences', user.uid);
    try {
        const docSnap = await getFirestoreDoc(prefDocRef);
        if (docSnap.exists()) {
            const prefs = docSnap.data();
            const selectedSemesters = prefs.notifyForSemesters || [];
            notificationSettingsFormEl.querySelectorAll('input[name="notifySemesters"]').forEach(cb => {
                cb.checked = selectedSemesters.includes(cb.value);
            });
            if (prefs.fcmToken && Notification.permission === "granted") {
                pushNotificationStatusEl.textContent = 'Status: Enabled (Token stored)';
            } else if (Notification.permission === "denied") {
                 pushNotificationStatusEl.textContent = 'Status: Denied by browser';
                 enablePushNotificationsBtnEl.disabled = true;
            } else if (prefs.fcmToken) {
                 pushNotificationStatusEl.textContent = 'Status: Token stored, but browser permission needed. Click to re-enable.';
            } else {
                 pushNotificationStatusEl.textContent = Notification.permission === "default" ? 'Status: Click to enable' : `Status: ${Notification.permission}`;
            }
        } else {
            pushNotificationStatusEl.textContent = Notification.permission === "default" ? 'Status: Click to enable' : `Status: ${Notification.permission}`;
            if(Notification.permission === "denied") enablePushNotificationsBtnEl.disabled = true;
        }
    } catch (error) {
        console.error("Error loading notification settings:", error);
        showError(notificationSettingsErrorEl, "Could not load settings.");
    }
}

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
        selectedSemesters = ["all"]; // If "all" is checked, just store that.
    }

    const prefData = {
        userId: user.uid,
        email: user.email,
        notifyForSemesters: selectedSemesters,
        lastUpdated: serverTimestamp()
    };

    // If permission is already granted, ensure we have the latest token
    if (Notification.permission === 'granted') {
        try {
            const currentToken = await getToken(messaging, { vapidKey: 'BCZbrYYJ_xUYnUyq0fRtJx-VWmtMDUirXrrzqnX-nRvcDnIFlYkCEcvElKFP2_PkZAmO6j5ExR8KRJZu6Aj7X_s' });
            if (currentToken) {
                prefData.fcmToken = currentToken;
                pushNotificationStatusEl.textContent = 'Status: Enabled (Token updated/verified)';
            } else {
                 pushNotificationStatusEl.textContent = 'Status: Granted, but failed to get token. Try again.';
            }
        } catch (err) {
            console.error('Error getting token during save: ', err);
            pushNotificationStatusEl.textContent = `Status: Error getting token (${err.message.substring(0,30)}...)`;
        }
    }

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
notificationSettingsModalEl.addEventListener('click', (event) => {
    if (event.target === notificationSettingsModalEl) {
        notificationSettingsModalEl.classList.remove('active');
        document.body.style.overflow = '';
    }
});
enablePushNotificationsBtnEl.addEventListener('click', async () => {
    const token = await requestNotificationPermission();
    if (token) {
        console.log("Token obtained. User should click 'Save Settings' to store it.");
    }
});
notificationSettingsFormEl.addEventListener('submit', saveNotificationSettings);


// --- ASSIGNMENTS (Fetch, Render, Filter)---
async function fetchAssignments() {
    assignmentsGridEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    try {
        const assignmentsQuery = query(collection(db, "assignments"), orderBy("uploadDate", "desc"));
        const snapshot = await getDocs(assignmentsQuery);
        allAssignments = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        await applyCurrentFilters();
        populateAllFilters();
    } catch (error) {
        console.error("Error fetching assignments: ", error);
        assignmentsGridEl.innerHTML = '<p class="no-assignments-message">Could not load assignments. Please try again later.</p>';
    }
}

async function renderAssignments(assignmentsToRender) {
    assignmentsGridEl.innerHTML = '';
    if (!assignmentsToRender || assignmentsToRender.length === 0) {
        assignmentsGridEl.innerHTML = '<p class="no-assignments-message">No assignments match your criteria.</p>'; return;
    }
    const uploaderNamePromises = assignmentsToRender.map(assignment => fetchUploaderNameFromUsersCollection(assignment.uploaderId, assignment.uploaderEmail || 'Anonymous'));
    const uploaderNames = await Promise.all(uploaderNamePromises);

    assignmentsToRender.forEach((assignment, index) => {
        const card = document.createElement('div');
        card.classList.add('assignment-card');
        const uploadDate = assignment.uploadDate && assignment.uploadDate.toDate ? assignment.uploadDate.toDate().toLocaleDateString() : 'N/A';
        const uploaderName = uploaderNames[index];
        const userHasVoted = auth.currentUser && assignment.votedBy && Array.isArray(assignment.votedBy) && assignment.votedBy.includes(auth.currentUser.uid);

        card.innerHTML = `
            <div>
                <h3>${assignment.assignmentTitle || 'Untitled'}</h3>
                <p><strong>Uploader:</strong> <a href="#" class="uploader-name-link" data-uploader-id="${assignment.uploaderId}">${uploaderName}</a></p>
                <p><strong>Subject:</strong> ${assignment.subject || 'N/A'}</p>
                <p><strong>Semester:</strong> ${getOrdinalSuffix(assignment.semester)}</p>
                ${assignment.assignmentNumber ? `<p><strong>Assignment No.:</strong> ${assignment.assignmentNumber}</p>` : ''}
                <p><strong>Uploaded:</strong> ${uploadDate}</p>
                ${assignment.keywords && assignment.keywords.length > 0 ? `<div class="keywords">${assignment.keywords.map(k => `<span>${k}</span>`).join('')}</div>` : ''}
            </div>
            <div class="card-footer">
                <a href="${assignment.driveLink || '#'}" target="_blank" rel="noopener noreferrer" class="btn view-button">View Assignment</a>
                <div class="vote-section" data-assignment-id="${assignment.id}">
                    <button class="vote-btn ${userHasVoted ? 'voted' : ''}" data-assignment-id="${assignment.id}" aria-label="${userHasVoted ? 'Remove vote' : 'Upvote this assignment'}">▲</button>
                    <span class="vote-count">${assignment.votes || 0}</span>
                </div>
            </div>
        `;
        const uploaderLinkEl = card.querySelector('.uploader-name-link');
        if (uploaderLinkEl && assignment.uploaderId) {
            uploaderLinkEl.addEventListener('click', (e) => { e.preventDefault(); openUploaderProfileModal(assignment.uploaderId); });
        } else if (uploaderLinkEl) {
            uploaderLinkEl.style.pointerEvents = 'none'; uploaderLinkEl.style.textDecoration = 'none'; uploaderLinkEl.style.color = '#ccc';
        }
        const voteBtn = card.querySelector('.vote-btn');
        if (voteBtn && assignment.id) {
            voteBtn.addEventListener('click', (event) => handleVote(assignment.id, event.currentTarget));
        }
        assignmentsGridEl.appendChild(card);
    });
}

// --- UPLOAD MODAL & FORM SUBMISSION ---
function showUploadModal() {
    const user = auth.currentUser;
    if (!user) { openAssignmentAuthModal('login'); return; }
    uploadAssignmentFormEl.reset(); clearError(uploadFormErrorEl);
    uploadModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (uploadAssignmentFormEl.assignmentTitle) uploadAssignmentFormEl.assignmentTitle.focus();
}

closeUploadModalBtnEl.addEventListener('click', () => {
    uploadModalEl.classList.remove('active'); document.body.style.overflow = '';
});
uploadModalEl.addEventListener('click', (event) => {
    if (event.target === uploadModalEl) {
        uploadModalEl.classList.remove('active'); document.body.style.overflow = '';
    }
});

/**
 * Handles the assignment upload form submission.
 * This function performs three key actions:
 * 1. Saves the new assignment data to the Firestore database.
 * 2. Triggers a secure, backend Netlify Function to send push notifications.
 * 3. Refreshes the assignment list on the page.
 */
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

    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    // Object for saving to Firestore, includes server-generated timestamp
    const newAssignmentForDb = {
        uploaderId: user.uid,
        uploaderEmail: user.email,
        assignmentTitle: uploadAssignmentFormEl.assignmentTitle.value.trim(),
        subject: uploadAssignmentFormEl.subject.value.trim(),
        semester: uploadAssignmentFormEl.semester.value,
        assignmentNumber: uploadAssignmentFormEl.assignmentNumber.value.trim(),
        keywords: uploadAssignmentFormEl.keywords.value ? uploadAssignmentFormEl.keywords.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [],
        driveLink: uploadAssignmentFormEl.driveLink.value.trim(),
        uploadDate: serverTimestamp(), // Firebase server generates the date
        votes: 0,
        votedBy: []
    };

    // Plain object with minimal data to send to our backend function
    const newAssignmentForFunction = {
        assignmentTitle: newAssignmentForDb.assignmentTitle,
        subject: newAssignmentForDb.subject,
        semester: newAssignmentForDb.semester
    };

    try {
        // Step 1: Save the assignment to the database
        await addDoc(collection(db, "assignments"), newAssignmentForDb);

        // Step 2: Close modal and give user feedback
        uploadModalEl.classList.remove('active');
        document.body.style.overflow = '';
        alert('Assignment uploaded successfully!');

        // Step 3: Trigger the Netlify notification function. This runs in the background.
        const netlifyFunctionUrl = 'https://programmingforlosers.netlify.app/.netlify/functions/sendNotification';
        
        // ======================== IMPORTANT SECURITY NOTE ========================
        // This 'secret' MUST match the FUNCTION_SECRET_KEY you set in your
        // Netlify environment variables. Do NOT expose this key publicly.
        // It's recommended to store this in a config file that is NOT checked
        // into version control (e.g., using a .env file with a build tool),
        // but for this example, we place it here.
        // =======================================================================
        const mySecret = 'replace-this-with-your-own-strong-secret-key'; // <-- !!! REPLACE THIS !!!

        // We call the function but don't wait for it to finish ('fire and forget')
        fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignment: newAssignmentForFunction,
                secret: mySecret // The secret authenticates this request
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Notification function responded with an error.', response.status, response.statusText);
            } else {
                console.log('Notification function triggered successfully.');
            }
        })
        .catch(err => console.error('Error triggering notification function:', err));

        // Step 4: Refresh the assignments list on the page for the uploader
        fetchAssignments();

    } catch (error) {
        console.error("Error adding assignment: ", error);
        showError(uploadFormErrorEl, `Upload Error: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

getDriveLinkHelperBtnEl.addEventListener('click', () => {
    alert("How to get a Google Drive Shareable Link (View Access):\n\n1. Go to your Google Drive.\n2. Right-click on the file and select 'Share' or 'Get link'.\n3. Under 'General access', change it to 'Anyone with the link' (Role: Viewer).\n4. Click 'Copy link' and paste it here.");
    window.open('https://drive.google.com', '_blank');
});


// --- PROFILE MODAL & Other UI components that don't need changes ---

async function fetchUploaderNameFromUsersCollection(uploaderId, fallbackName = 'Anonymous') {
    if (userNamesCache[uploaderId]) return userNamesCache[uploaderId];
    if (!uploaderId) return fallbackName;
    try {
        const userDocRef = doc(db, 'users', uploaderId);
        const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const displayName = userData.name || userData.email || fallbackName;
            userNamesCache[uploaderId] = displayName; return displayName;
        } else { userNamesCache[uploaderId] = fallbackName; return fallbackName; }
    } catch (error) { console.error(`Error fetching name for uploaderId ${uploaderId}:`, error); return fallbackName; }
}

async function handleVote(assignmentId, voteButtonElement) {
    const user = auth.currentUser;
    if (!user) { openAssignmentAuthModal('login'); return; }
    if (!assignmentId) { alert("Error: Missing assignment ID."); return; }

    const assignmentRef = doc(db, "assignments", assignmentId);
    const voteCountSpan = voteButtonElement.closest('.vote-section').querySelector('.vote-count');
    voteButtonElement.disabled = true;

    try {
        const assignmentDocSnap = await getFirestoreDoc(assignmentRef);
        if (!assignmentDocSnap.exists()) { alert("Error: Assignment not found."); return; }
        
        const assignmentData = assignmentDocSnap.data();
        const hasVoted = (assignmentData.votedBy || []).includes(user.uid);
        
        const updatePayload = hasVoted ? 
            { votes: increment(-1), votedBy: arrayRemove(user.uid) } : 
            { votes: increment(1), votedBy: arrayUnion(user.uid) };
        
        await updateDoc(assignmentRef, updatePayload);

        const newVoteCount = (assignmentData.votes || 0) + (hasVoted ? -1 : 1);
        voteCountSpan.textContent = Math.max(0, newVoteCount);
        voteButtonElement.classList.toggle('voted', !hasVoted);

        // Update local cache to reflect vote without a full refetch
        const localAssignment = allAssignments.find(a => a.id === assignmentId);
        if (localAssignment) {
            localAssignment.votes = newVoteCount;
            localAssignment.votedBy = localAssignment.votedBy || [];
            if (hasVoted) {
                localAssignment.votedBy = localAssignment.votedBy.filter(uid => uid !== user.uid);
            } else {
                localAssignment.votedBy.push(user.uid);
            }
        }
    } catch (error) {
        console.error("Error during voting:", error);
        alert("Failed to record vote.");
    } finally {
        voteButtonElement.disabled = false;
    }
}

async function openUploaderProfileModal(uploaderId) {
    if (!uploaderId) return;
    uploaderProfileModalEl.classList.add('active'); document.body.style.overflow = 'hidden';
    // Reset modal state
    document.getElementById('modalUploaderProfileName').textContent = 'Loading...';
    document.getElementById('modalUploaderProfileBio').textContent = 'Loading bio...';
    // ... reset other fields
    try {
        const userDocRef = doc(db, 'users', uploaderId); const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists()) {
            const profileData = docSnap.data();
            document.getElementById('modalUploaderProfileAvatar').textContent = (profileData.name?.charAt(0).toUpperCase() || profileData.email?.charAt(0).toUpperCase()) || '?';
            document.getElementById('modalUploaderProfileName').textContent = profileData.name || 'N/A';
            document.getElementById('modalUploaderProfileCollege').textContent = `College: ${profileData.college || 'N/A'}`;
            document.getElementById('modalUploaderProfileSemester').textContent = `Semester: ${getOrdinalSuffix(profileData.semester) || 'N/A'}`;
            document.getElementById('modalUploaderProfileBio').textContent = profileData.bio || 'No bio provided.';
            document.getElementById('modalUploaderProfileEmail').textContent = profileData.email || 'N/A';
            // ... (rest of profile population logic)
        } else {
            document.getElementById('modalUploaderProfileName').textContent = 'Profile data not found.';
        }
    } catch (error) {
        console.error("Error fetching uploader profile:", error);
        document.getElementById('modalUploaderProfileName').textContent = 'Error loading profile.';
    }
}
closeUploaderProfileModalBtnEl.addEventListener('click', () => {
    uploaderProfileModalEl.classList.remove('active'); document.body.style.overflow = '';
});
uploaderProfileModalEl.addEventListener('click', (event) => {
    if (event.target === uploaderProfileModalEl) {
        uploaderProfileModalEl.classList.remove('active'); document.body.style.overflow = '';
    }
});

// --- FILTERS LOGIC ---
function getUniqueValues(key) {
    const unique = new Set(allAssignments.map(a => a[key]).filter(Boolean));
    return Array.from(unique).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}
function populateFilterDropdown(selectElement, items, defaultOptionText) {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
    items.forEach(item => {
        selectElement.add(new Option(item, item));
    });
    selectElement.value = currentValue;
}
function populateAllFilters() {
    populateFilterDropdown(filterSemesterSelectEl, getUniqueValues('semester'), 'All Semesters');
    populateFilterDropdown(filterSubjectSelectEl, getUniqueValues('subject'), 'All Subjects');
}

async function applyCurrentFilters() {
    assignmentsGridEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow loader to render

    const searchTerm = searchTermInputEl.value.toLowerCase().trim();
    const selectedSemester = filterSemesterSelectEl.value;
    const selectedSubject = filterSubjectSelectEl.value;
    const assignmentNumFilter = filterAssignmentNumberInputEl.value.toLowerCase().trim();
    const sortByValue = sortBySelectEl.value;

    let filtered = allAssignments.filter(a => {
        const searchCorpus = [a.assignmentTitle, a.subject, a.assignmentNumber, ...(a.keywords || [])].join(' ').toLowerCase();
        return (searchTerm ? searchCorpus.includes(searchTerm) : true) &&
               (selectedSemester ? a.semester === selectedSemester : true) &&
               (selectedSubject ? a.subject === selectedSubject : true) &&
               (assignmentNumFilter ? String(a.assignmentNumber || '').toLowerCase().includes(assignmentNumFilter) : true);
    });

    filtered.sort((a, b) => {
        if (sortByValue === 'votes_desc') return (b.votes || 0) - (a.votes || 0);
        if (sortByValue === 'uploadDate_asc') return (a.uploadDate?.toMillis() || 0) - (b.uploadDate?.toMillis() || 0);
        return (b.uploadDate?.toMillis() || 0) - (a.uploadDate?.toMillis() || 0); // Default newest
    });

    await renderAssignments(filtered);
}

function resetAllFilters() {
    uploadAssignmentFormEl.reset(); // Also resets filter form fields inside if part of the same form, otherwise:
    searchTermInputEl.value = '';
    filterSemesterSelectEl.value = '';
    filterSubjectSelectEl.value = '';
    filterAssignmentNumberInputEl.value = '';
    sortBySelectEl.value = 'uploadDate_desc';
    applyCurrentFilters(); // Re-run with default filters
}

// --- EVENT LISTENERS ---
showUploadFormBtnEl.addEventListener('click', showUploadModal);
uploadAssignmentFormEl.addEventListener('submit', handleFormSubmit);
applyFiltersBtnEl.addEventListener('click', applyCurrentFilters);
resetFiltersBtnEl.addEventListener('click', resetAllFilters);
sortBySelectEl.addEventListener('change', applyCurrentFilters);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAssignments();
    // Register the service worker for background notifications
    if ('serviceWorker' in navigator) {
        // Use the correct path for your GitHub Pages repository structure
        navigator.serviceWorker.register('/PROGRAMING-FOR-LOOSERS-CLUB-/firebase-messaging-sw.js', { scope: '/PROGRAMING-FOR-LOOSERS-CLUB-/' })
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            }).catch((err) => {
                console.log('Service Worker registration failed:', err);
            });
    }
});
