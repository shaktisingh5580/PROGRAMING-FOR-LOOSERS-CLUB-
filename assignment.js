// assignment.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc as getFirestoreDoc, updateDoc, increment, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging.js";

// Your Firebase Configuration (already provided by you)
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app); // Initialize Messaging

// DOM Elements
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

let allAssignments = [];
let userNamesCache = {};
let currentAssignmentAuthMode = 'login';

// --- UTILITY FUNCTIONS ---
function showError(element, message) { if(element) { element.textContent = message; element.classList.remove('hidden');}}
function clearError(element) { if(element) {element.textContent = ''; element.classList.add('hidden');}}
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

// --- NOTIFICATION SETTINGS ---
async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    pushNotificationStatusEl.textContent = 'Status: Requesting...';
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            pushNotificationStatusEl.textContent = 'Status: Granted. Fetching token...';
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
        pushNotificationStatusEl.textContent = `Status: Error (${err.message.substring(0,50)}...)`;
    }
    return null;
}

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
    if (!user) {
        showError(notificationSettingsErrorEl, "You must be logged in.");
        return;
    }
    clearError(notificationSettingsErrorEl);
    const submitBtn = notificationSettingsFormEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const selectedCheckboxes = notificationSettingsFormEl.querySelectorAll('input[name="notifySemesters"]:checked');
    let selectedSemesters = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (selectedSemesters.includes("all")) {
        selectedSemesters = ["all"];
    }

    const prefData = {
        userId: user.uid,
        email: user.email,
        notifyForSemesters: selectedSemesters,
        lastUpdated: serverTimestamp()
    };

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
    if(!auth.currentUser) {
        openAssignmentAuthModal('login');
        return;
    }
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
        console.log("Token obtained. User should click 'Save Settings' to store it if not already done.");
    }
});

notificationSettingsFormEl.addEventListener('submit', saveNotificationSettings);

onMessage(messaging, (payload) => {
    console.log('Message received in foreground. ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/PROGRAMING-FOR-LOOSERS-CLUB-/HummingBird (1).png'
    };
    new Notification(notificationTitle, notificationOptions);
});


// --- ASSIGNMENTS ---
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

function getUniqueValues(key) {
    const unique = new Set();
    allAssignments.forEach(a => {
        if (a[key] && typeof a[key] === 'string') unique.add(a[key]);
        else if (Array.isArray(a[key])) a[key].forEach(item => unique.add(item));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function populateFilterDropdown(selectElement, items, defaultOptionText) {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
    items.forEach(item => {
        const option = document.createElement('option'); option.value = item; option.textContent = item;
        selectElement.appendChild(option);
    });
    if (items.includes(currentValue)) selectElement.value = currentValue;
}

function populateAllFilters() {
    populateFilterDropdown(filterSemesterSelectEl, getUniqueValues('semester'), 'All Semesters');
    populateFilterDropdown(filterSubjectSelectEl, getUniqueValues('subject'), 'All Subjects');
}

async function fetchUploaderNameFromUsersCollection(uploaderId, fallbackName = 'Anonymous') {
    if (userNamesCache[uploaderId]) return userNamesCache[uploaderId];
    if (!uploaderId) return fallbackName;
    try {
        const userDocRef = doc(db, 'users', uploaderId);
        const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const displayName = userData.name || (userData.links && userData.links.name) || userData.email || fallbackName;
            userNamesCache[uploaderId] = displayName; return displayName;
        } else { userNamesCache[uploaderId] = fallbackName; return fallbackName; }
    } catch (error) { console.error(`Error fetching name for uploaderId ${uploaderId}:`, error); return fallbackName; }
}

async function renderAssignments(assignmentsToRender) {
    assignmentsGridEl.innerHTML = '';
    if (!assignmentsToRender || assignmentsToRender.length === 0) {
        assignmentsGridEl.innerHTML = '<p class="no-assignments-message">No assignments match your criteria.</p>'; return;
    }
    const uploaderNamePromises = assignmentsToRender.map(assignment =>
        fetchUploaderNameFromUsersCollection(assignment.uploaderId, assignment.uploaderEmail || 'Anonymous')
    );
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
            voteBtn.addEventListener('click', (event) => {
                const clickedButton = event.currentTarget;
                handleVote(assignment.id, clickedButton);
            });
        }
        assignmentsGridEl.appendChild(card);
    });
}

async function handleVote(assignmentId, voteButtonElement) {
    const user = auth.currentUser;
    if (!user) {
        openAssignmentAuthModal('login');
        return;
    }
    if (!assignmentId) {
        alert("Error: Missing assignment ID for voting.");
        return;
    }

    const assignmentRef = doc(db, "assignments", assignmentId);
    const voteSection = voteButtonElement.closest('.vote-section');
    if (!voteSection) { alert("UI Error: Could not process vote."); return; }
    const voteCountSpan = voteSection.querySelector('.vote-count');
    if (!voteCountSpan) { alert("UI Error: Could not update vote count display."); return; }

    voteButtonElement.disabled = true;
    try {
        const assignmentDocSnap = await getFirestoreDoc(assignmentRef);
        if (!assignmentDocSnap.exists()) {
            alert("Error: Assignment data not found.");
            voteButtonElement.disabled = false; return;
        }
        const assignmentData = assignmentDocSnap.data();
        const currentVotes = assignmentData.votes || 0;
        const votedByArray = Array.isArray(assignmentData.votedBy) ? assignmentData.votedBy : [];
        const hasVoted = votedByArray.includes(user.uid);
        let newVoteCount; let updatePayload = {};
        if (hasVoted) {
            updatePayload = { votes: increment(-1), votedBy: arrayRemove(user.uid) };
            newVoteCount = currentVotes - 1;
        } else {
            updatePayload = { votes: increment(1), votedBy: arrayUnion(user.uid) };
            newVoteCount = currentVotes + 1;
        }
        await updateDoc(assignmentRef, updatePayload);
        voteCountSpan.textContent = Math.max(0, newVoteCount);
        voteButtonElement.classList.toggle('voted', !hasVoted);
        voteButtonElement.setAttribute('aria-label', !hasVoted ? 'Remove vote' : 'Upvote this assignment');

        const localAssignmentIndex = allAssignments.findIndex(a => a.id === assignmentId);
        if (localAssignmentIndex > -1) {
            allAssignments[localAssignmentIndex].votes = Math.max(0, newVoteCount);
            if (hasVoted) {
                allAssignments[localAssignmentIndex].votedBy = (allAssignments[localAssignmentIndex].votedBy || []).filter(uid => uid !== user.uid);
            } else {
                if (!allAssignments[localAssignmentIndex].votedBy) allAssignments[localAssignmentIndex].votedBy = [];
                if (!allAssignments[localAssignmentIndex].votedBy.includes(user.uid)) allAssignments[localAssignmentIndex].votedBy.push(user.uid);
            }
        }
    } catch (error) {
        console.error("Error during voting process:", error);
        alert("Failed to record vote.");
    } finally {
        voteButtonElement.disabled = false;
    }
}


// --- UPLOAD MODAL & FORM ---
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

// --- UPDATED FUNCTION to trigger Netlify ---
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

    // This object has the serverTimestamp for saving to Firestore
    const newAssignmentForDb = {
        uploaderId: user.uid,
        uploaderEmail: user.email,
        assignmentTitle: uploadAssignmentFormEl.assignmentTitle.value.trim(),
        subject: uploadAssignmentFormEl.subject.value.trim(),
        semester: uploadAssignmentFormEl.semester.value,
        assignmentNumber: uploadAssignmentFormEl.assignmentNumber.value.trim(),
        keywords: uploadAssignmentFormEl.keywords.value ? uploadAssignmentFormEl.keywords.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : [],
        driveLink: uploadAssignmentFormEl.driveLink.value.trim(),
        uploadDate: serverTimestamp(), // For Firestore
        votes: 0,
        votedBy: []
    };

    // This is a plain version of the object to send to our function
    const newAssignmentForFunction = {
        assignmentTitle: newAssignmentForDb.assignmentTitle,
        subject: newAssignmentForDb.subject,
        semester: newAssignmentForDb.semester
    };

    try {
        // 1. Save the assignment to the database
        await addDoc(collection(db, "assignments"), newAssignmentForDb);

        // 2. Close the modal and give user feedback
        uploadModalEl.classList.remove('active');
        document.body.style.overflow = '';
        alert('Assignment uploaded successfully!');

        // 3. Trigger the Netlify notification function in the background
        const netlifyFunctionUrl = 'https://programmingforlosers.netlify.app/.netlify/functions/sendNotification';
        
        // IMPORTANT: Replace this with your own strong, random secret key.
        // It must be the SAME key you set in the Netlify dashboard.
        const mySecret = 'replace-this-with-your-own-strong-secret-key'; 

        // We don't need to wait for this to finish (no 'await')
        fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignment: newAssignmentForFunction,
                secret: mySecret
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Notification function responded with an error.', response.status);
            } else {
                console.log('Notification function triggered successfully.');
            }
        })
        .catch(err => console.error('Error triggering notification function:', err));

        // 4. Refresh the assignments list on the page
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
    alert("How to get a Google Drive Shareable Link (View Access):\n\n1. Go to your Google Drive (drive.google.com).\n2. Find your assignment file.\n3. Right-click on the file and select 'Share' or 'Get link'.\n4. Under 'General access', change permission to 'Anyone with the link' (Role: Viewer).\n5. Click 'Copy link'.\n6. Paste the copied link into the 'Google Drive Link' field.\n\nA new tab will open to Google Drive for your convenience.");
    window.open('https://drive.google.com', '_blank');
});

// --- PROFILE MODAL ---
async function openUploaderProfileModal(uploaderId) {
    if (!uploaderId) { return; }
    document.getElementById('modalUploaderProfileAvatar').textContent = '?';
    document.getElementById('modalUploaderProfileName').textContent = 'Loading...';
    document.getElementById('modalUploaderProfileCollege').textContent = 'College: Loading...';
    document.getElementById('modalUploaderProfileSemester').textContent = 'Semester: Loading...';
    document.getElementById('modalUploaderProfileBio').textContent = 'Loading bio...';
    document.getElementById('modalUploaderProfileEmail').textContent = 'Loading...';
    document.getElementById('modalUploaderProfileInstagram').textContent = 'Loading...';
    document.getElementById('modalUploaderProfileLinksList').innerHTML = '<p style="opacity:0.7;">Loading links...</p>';
    uploaderProfileModalEl.classList.add('active'); document.body.style.overflow = 'hidden';
    try {
        const userDocRef = doc(db, 'users', uploaderId); const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists()) {
            const profileData = docSnap.data();
            document.getElementById('modalUploaderProfileAvatar').textContent = (profileData.name && profileData.name.charAt(0).toUpperCase()) || (profileData.email && profileData.email.charAt(0).toUpperCase()) || '?';
            document.getElementById('modalUploaderProfileName').textContent = profileData.name || 'N/A';
            document.getElementById('modalUploaderProfileCollege').textContent = profileData.college ? `College: ${profileData.college}` : 'College: N/A';
            document.getElementById('modalUploaderProfileSemester').textContent = profileData.semester ? `Semester: ${getOrdinalSuffix(profileData.semester)}` : 'Semester: N/A';
            document.getElementById('modalUploaderProfileBio').textContent = profileData.bio || 'No bio provided.';
            document.getElementById('modalUploaderProfileEmail').textContent = profileData.email || 'N/A';
            const instagramEl = document.getElementById('modalUploaderProfileInstagram');
            if (profileData.instagram) {
                const igLink = profileData.instagram.startsWith('http') ? profileData.instagram : `https://instagram.com/${profileData.instagram.replace('@', '')}`;
                instagramEl.innerHTML = `<a href="${igLink}" target="_blank" rel="noopener noreferrer">${profileData.instagram}</a>`;
            } else { instagramEl.textContent = 'N/A'; }
            const linksListEl = document.getElementById('modalUploaderProfileLinksList'); linksListEl.innerHTML = '';
            if (profileData.links && Array.isArray(profileData.links) && profileData.links.length > 0) {
                profileData.links.forEach(link => {
                    if (link.title && link.url) {
                        const linkItem = document.createElement('a');
                        linkItem.href = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                        linkItem.target = '_blank'; linkItem.rel = 'noopener noreferrer';
                        linkItem.className = 'profile-link-item'; linkItem.textContent = link.title;
                        linksListEl.appendChild(linkItem);
                    }
                });
                if (linksListEl.childElementCount === 0) { linksListEl.innerHTML = '<p style="opacity:0.7;">No valid custom links provided.</p>'; }
            } else { linksListEl.innerHTML = '<p style="opacity:0.7;">No custom links provided.</p>'; }
        } else {
            document.getElementById('modalUploaderProfileName').textContent = 'Profile data not found.';
            ['modalUploaderProfileCollege', 'modalUploaderProfileSemester', 'modalUploaderProfileBio', 'modalUploaderProfileEmail', 'modalUploaderProfileInstagram'].forEach(id => {
                const el = document.getElementById(id); if (el) el.textContent = 'N/A';
            });
            const linksList = document.getElementById('modalUploaderProfileLinksList'); if (linksList) linksList.innerHTML = '<p style="opacity:0.7;">No profile data.</p>';
        }
    } catch (error) {
        console.error("Error fetching uploader profile data:", error);
        const nameEl = document.getElementById('modalUploaderProfileName'); if (nameEl) nameEl.textContent = 'Error loading profile.';
        const linksList = document.getElementById('modalUploaderProfileLinksList'); if (linksList) linksList.innerHTML = '<p style="opacity:0.7;">Error loading links.</p>';
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


// --- FILTERS ---
async function applyCurrentFilters() {
    if (allAssignments.length === 0 && !assignmentsGridEl.querySelector('.loader-container')) {
        if (!assignmentsGridEl.querySelector('.no-assignments-message')) {
            assignmentsGridEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
        }
    } else if (allAssignments.length > 0 && !assignmentsGridEl.querySelector('.loader-container')) {
         assignmentsGridEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    }
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow loader to render

    const searchTerm = searchTermInputEl.value.toLowerCase().trim();
    const selectedSemester = filterSemesterSelectEl.value;
    const selectedSubject = filterSubjectSelectEl.value;
    const assignmentNumFilter = filterAssignmentNumberInputEl.value.toLowerCase().trim();
    const sortByValue = sortBySelectEl.value;

    const namePromises = allAssignments.map(a => fetchUploaderNameFromUsersCollection(a.uploaderId, a.uploaderEmail || ''));
    const resolvedNames = await Promise.all(namePromises);

    let filtered = allAssignments.filter((a, index) => {
        const uploaderNameOrEmail = resolvedNames[index].toLowerCase();
        const keywordsString = (a.keywords || []).join(' ').toLowerCase();
        const title = (a.assignmentTitle || "").toLowerCase();
        const subject = (a.subject || "").toLowerCase();
        const number = (a.assignmentNumber || "").toLowerCase();

        const matchesSearchTerm = searchTerm ?
            (title.includes(searchTerm) ||
                uploaderNameOrEmail.includes(searchTerm) ||
                subject.includes(searchTerm) ||
                keywordsString.includes(searchTerm) ||
                (number && number.includes(searchTerm))
            ) : true;
        const matchesSemester = selectedSemester ? a.semester === selectedSemester : true;
        const matchesSubject = selectedSubject ? subject === selectedSubject.toLowerCase() : true;
        const matchesAssignmentNumDirect = assignmentNumFilter && number ? number.includes(assignmentNumFilter) : true;
        return matchesSearchTerm && matchesSemester && matchesSubject && (assignmentNumFilter ? matchesAssignmentNumDirect : true);
    });

    if (sortByValue === 'votes_desc') {
        filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else if (sortByValue === 'uploadDate_asc') {
        filtered.sort((a, b) => (a.uploadDate && a.uploadDate.toMillis ? a.uploadDate.toMillis() : 0) - (b.uploadDate && b.uploadDate.toMillis ? b.uploadDate.toMillis() : 0));
    } else { // Default to newest first
        filtered.sort((a, b) => (b.uploadDate && b.uploadDate.toMillis ? b.uploadDate.toMillis() : 0) - (a.uploadDate && a.uploadDate.toMillis ? a.uploadDate.toMillis() : 0));
    }
    await renderAssignments(filtered);
}

function resetAllFilters() {
    searchTermInputEl.value = '';
    filterSemesterSelectEl.value = ''; filterSubjectSelectEl.value = '';
    filterAssignmentNumberInputEl.value = ''; sortBySelectEl.value = 'uploadDate_desc';
    if (!assignmentsGridEl.querySelector('.loader-container')) {
        assignmentsGridEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    }
    const defaultSortedAssignments = [...allAssignments].sort((a, b) =>
        (b.uploadDate && b.uploadDate.toMillis ? b.uploadDate.toMillis() : 0) - (a.uploadDate && a.uploadDate.toMillis ? a.uploadDate.toMillis() : 0)
    );
    renderAssignments(defaultSortedAssignments);
}

showUploadFormBtnEl.addEventListener('click', showUploadModal);
uploadAssignmentFormEl.addEventListener('submit', handleFormSubmit);
applyFiltersBtnEl.addEventListener('click', applyCurrentFilters);
resetFiltersBtnEl.addEventListener('click', resetAllFilters);
sortBySelectEl.addEventListener('change', applyCurrentFilters);

// Global event listener for Escape key to close modals
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (uploadModalEl.classList.contains('active')) {
            uploadModalEl.classList.remove('active'); document.body.style.overflow = '';
        }
        if (assignmentAuthModalEl.classList.contains('active')) {
            assignmentAuthModalEl.classList.remove('active'); document.body.style.overflow = '';
        }
        if (uploaderProfileModalEl.classList.contains('active')) {
            uploaderProfileModalEl.classList.remove('active'); document.body.style.overflow = '';
        }
        if (notificationSettingsModalEl.classList.contains('active')) {
            notificationSettingsModalEl.classList.remove('active'); document.body.style.overflow = '';
        }
    }
});

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchAssignments();
    if ('serviceWorker' in navigator) {
        // Updated path for your specific GitHub Pages repository
        navigator.serviceWorker.register('/PROGRAMING-FOR-LOOSERS-CLUB-/firebase-messaging-sw.js', { scope: '/PROGRAMING-FOR-LOOSERS-CLUB-/' })
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            }).catch((err) => {
                console.log('Service Worker registration failed for PROGRAMING-FOR-LOOSERS-CLUB-:', err);
            });
    }
});