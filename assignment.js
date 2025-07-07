// assignment.js - FULLY CORRECTED VERSION WITH MANUAL SUBSCRIBE BUTTON

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc as getFirestoreDoc, updateDoc, increment, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// --- DOM Elements ---
const assignmentsGridEl = document.getElementById('assignmentsGrid');
const showUploadFormBtnEl = document.getElementById('showUploadFormBtn');
const uploadModalEl = document.getElementById('uploadModal');
const closeUploadModalBtnEl = document.getElementById('closeUploadModalBtn');
const uploadAssignmentFormEl = document.getElementById('uploadAssignmentForm');
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
const notificationSettingsBtnEl = document.getElementById('notificationSettingsBtn');
const notificationSettingsModalEl = document.getElementById('notificationSettingsModal');
const closeNotificationSettingsModalBtnEl = document.getElementById('closeNotificationSettingsModalBtn');
const notificationSettingsFormEl = document.getElementById('notificationSettingsForm');
const semesterNotificationCheckboxesEl = document.getElementById('semesterNotificationCheckboxes');

// --- ADD THE NEW BUTTON TO THE LIST ---
const subscribeBtnEl = document.getElementById('subscribeBtn');

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

// --- NEW "BRAIN" FUNCTION FOR NOTIFICATION UI ---
async function updateSubscriptionUi() {
    const isSubscribed = await OneSignal.isPushNotificationsEnabled();
    const permission = await OneSignal.getNotificationPermission();
    const isBlocked = permission === 'denied';
    const user = auth.currentUser;

    // By default, hide both buttons
    subscribeBtnEl.classList.add('hidden');
    notificationSettingsBtnEl.classList.add('hidden');

    if (user && !isBlocked) {
        // If the user is logged in and hasn't blocked notifications...
        if (isSubscribed) {
            // ...and they ARE subscribed, show the "Settings" bell icon.
            notificationSettingsBtnEl.classList.remove('hidden');
        } else {
            // ...and they are NOT subscribed, show the big "Subscribe" button.
            subscribeBtnEl.classList.remove('hidden');
        }
    }
}

// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        assignmentUserEmailEl.textContent = user.email;
        assignmentLoginBtnEl.classList.add('hidden');
        assignmentLogoutBtnEl.classList.remove('hidden');
        showUploadFormBtnEl.classList.remove('hidden');
        OneSignal.push(() => OneSignal.setExternalUserId(user.uid));
        if (assignmentAuthModalEl.classList.contains('active')) {
            assignmentAuthModalEl.classList.remove('active');
            document.body.style.overflow = '';
        }
        updateSubscriptionUi(); // Update UI after login
    } else {
        assignmentUserEmailEl.textContent = 'Not logged in';
        assignmentLoginBtnEl.classList.remove('hidden');
        assignmentLogoutBtnEl.classList.add('hidden');
        showUploadFormBtnEl.classList.add('hidden');
        OneSignal.push(() => OneSignal.removeExternalUserId());
        updateSubscriptionUi(); // Update UI after logout
    }
    // Fetch assignments whether user is logged in or not
    if (allAssignments.length === 0) {
        fetchAssignments();
    } else {
        applyCurrentFilters();
    }
});

async function handleAssignmentAuthFormSubmit(e) {
    e.preventDefault();
    clearError(assignmentAuthErrorEl);
    const email = assignmentAuthFormEl.authEmail.value;
    const password = assignmentAuthFormEl.authPassword.value;
    assignmentAuthSubmitBtnEl.disabled = true;
    const originalSubmitText = assignmentAuthSubmitBtnEl.textContent;
    assignmentAuthSubmitBtnEl.textContent = currentAssignmentAuthMode === 'login' ? 'Logging in...' : 'Signing up...';
    try {
        if (currentAssignmentAuthMode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        showError(assignmentAuthErrorEl, error.message);
    } finally {
        assignmentAuthSubmitBtnEl.disabled = false;
        assignmentAuthSubmitBtnEl.textContent = originalSubmitText;
    }
}

function openAssignmentAuthModal(mode = 'login') {
    currentAssignmentAuthMode = mode;
    assignmentAuthFormEl.reset();
    clearError(assignmentAuthErrorEl);
    assignmentAuthTitleEl.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    assignmentAuthSubmitBtnEl.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    assignmentSwitchToSignupLinkEl.classList.toggle('hidden', mode === 'signup');
    assignmentSwitchToLoginLinkEl.classList.toggle('hidden', mode === 'login');
    assignmentAuthModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// --- NOTIFICATION SETTINGS LOGIC ---
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
        }
    } catch (error) {
        showError(notificationSettingsErrorEl, "Could not load settings.");
    }
}

async function saveNotificationSettings(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { showError(notificationSettingsErrorEl, "You must be logged in."); return; }
    const submitBtn = notificationSettingsFormEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    const selectedCheckboxes = notificationSettingsFormEl.querySelectorAll('input[name="notifySemesters"]:checked');
    let selectedSemesters = Array.from(selectedCheckboxes).map(cb => cb.value);
    if (selectedSemesters.includes("all")) selectedSemesters = ["all"];
    const allPossibleTags = ['semester_1', 'semester_2', 'semester_3', 'semester_4', 'semester_5', 'semester_6', 'semester_7', 'semester_8', 'semester_all'];
    const newTags = {};
    selectedSemesters.forEach(sem => { newTags[`semester_${sem}`] = 'true'; });
    OneSignal.push(() => {
        OneSignal.deleteTags(allPossibleTags).then(() => { OneSignal.sendTags(newTags); });
    });
    const prefData = {
        userId: user.uid,
        email: user.email,
        notifyForSemesters: selectedSemesters,
        lastUpdated: serverTimestamp()
    };
    const prefDocRef = doc(db, 'userNotificationPreferences', user.uid);
    try {
        await setDoc(prefDocRef, prefData, { merge: true });
        alert('Notification settings saved!');
        notificationSettingsModalEl.classList.remove('active');
        document.body.style.overflow = '';
    } catch (error) {
        showError(notificationSettingsErrorEl, `Save Error: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Settings';
    }
}

// --- ASSIGNMENT LOGIC ---
async function fetchAssignments() {
    assignmentsGridEl.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    try {
        const assignmentsQuery = query(collection(db, "assignments"), orderBy("uploadDate", "desc"));
        const snapshot = await getDocs(assignmentsQuery);
        allAssignments = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        populateAllFilters();
        await renderAssignments(allAssignments);
    } catch (error) {
        console.error("Error fetching assignments:", error);
        assignmentsGridEl.innerHTML = '<p class="no-assignments-message">Could not load assignments.</p>';
    }
}

async function renderAssignments(assignmentsToRender) {
    assignmentsGridEl.innerHTML = '';
    if (!assignmentsToRender || assignmentsToRender.length === 0) {
        assignmentsGridEl.innerHTML = '<p class="no-assignments-message">No assignments found.</p>';
        return;
    }
    const uploaderNamePromises = assignmentsToRender.map(assignment => fetchUploaderNameFromUsersCollection(assignment.uploaderId, assignment.uploaderEmail || 'Anonymous'));
    const uploaderNames = await Promise.all(uploaderNamePromises);
    assignmentsToRender.forEach((assignment, index) => {
        const card = document.createElement('div');
        card.classList.add('assignment-card');
        const uploadDate = assignment.uploadDate?.toDate ? assignment.uploadDate.toDate().toLocaleDateString() : 'N/A';
        const uploaderName = uploaderNames[index];
        const userHasVoted = auth.currentUser && Array.isArray(assignment.votedBy) && assignment.votedBy.includes(auth.currentUser.uid);
        card.innerHTML = `
            <div>
                <h3>${assignment.assignmentTitle || 'Untitled'}</h3>
                <p><strong>Uploader:</strong> <a href="#" class="uploader-name-link" data-uploader-id="${assignment.uploaderId}">${uploaderName}</a></p>
                <p><strong>Subject:</strong> ${assignment.subject || 'N/A'}</p>
                <p><strong>Semester:</strong> ${getOrdinalSuffix(assignment.semester)}</p>
                ${assignment.assignmentNumber ? `<p><strong>Assignment No.:</strong> ${assignment.assignmentNumber}</p>` : ''}
                <p><strong>Uploaded:</strong> ${uploadDate}</p>
                ${assignment.keywords?.length > 0 ? `<div class="keywords">${assignment.keywords.map(k => `<span>${k}</span>`).join('')}</div>` : ''}
            </div>
            <div class="card-footer">
                <a href="${assignment.driveLink || '#'}" target="_blank" rel="noopener noreferrer" class="btn view-button">View Assignment</a>
                <div class="vote-section" data-assignment-id="${assignment.id}">
                    <button class="vote-btn ${userHasVoted ? 'voted' : ''}" data-assignment-id="${assignment.id}" aria-label="Vote">▲</button>
                    <span class="vote-count">${assignment.votes || 0}</span>
                </div>
            </div>`;
        card.querySelector('.uploader-name-link')?.addEventListener('click', (e) => { e.preventDefault(); openUploaderProfileModal(assignment.uploaderId); });
        card.querySelector('.vote-btn')?.addEventListener('click', (event) => handleVote(assignment.id, event.currentTarget));
        assignmentsGridEl.appendChild(card);
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { showError(uploadFormErrorEl, "You must be logged in."); return; }
    const submitButton = uploadAssignmentFormEl.querySelector('button[type="submit"]');
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
    try {
        await addDoc(collection(db, "assignments"), newAssignmentForDb);
        uploadModalEl.classList.remove('active');
        document.body.style.overflow = '';
        alert('Assignment uploaded successfully!');
        const netlifyFunctionUrl = '/.netlify/functions/sendNotification';
        const mySecret = 'my-super-secret-pfl-key-12345'; // !!! REPLACE THIS
        fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignment: {
                    assignmentTitle: newAssignmentForDb.assignmentTitle,
                    subject: newAssignmentForDb.subject,
                    semester: newAssignmentForDb.semester
                },
                secret: mySecret
            })
        }).catch(err => console.error('Error triggering notification function:', err));
        fetchAssignments();
    } catch (error) {
        showError(uploadFormErrorEl, `Upload Error: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Upload Assignment';
    }
}

async function handleVote(assignmentId, voteButtonElement) {
    const user = auth.currentUser;
    if (!user) { openAssignmentAuthModal('login'); return; }
    const assignmentRef = doc(db, "assignments", assignmentId);
    voteButtonElement.disabled = true;
    try {
        const docSnap = await getFirestoreDoc(assignmentRef);
        if (!docSnap.exists()) return;
        const assignmentData = docSnap.data();
        const hasVoted = (assignmentData.votedBy || []).includes(user.uid);
        const updatePayload = hasVoted ? { votes: increment(-1), votedBy: arrayRemove(user.uid) } : { votes: increment(1), votedBy: arrayUnion(user.uid) };
        await updateDoc(assignmentRef, updatePayload);
        const voteCountSpan = voteButtonElement.parentElement.querySelector('.vote-count');
        const newVoteCount = (assignmentData.votes || 0) + (hasVoted ? -1 : 1);
        voteCountSpan.textContent = newVoteCount;
        voteButtonElement.classList.toggle('voted', !hasVoted);
    } catch (error) {
        console.error("Error during voting:", error);
    } finally {
        voteButtonElement.disabled = false;
    }
}

function populateAllFilters() {
    const semesters = [...new Set(allAssignments.map(a => a.semester).filter(Boolean))].sort((a,b)=>a-b);
    const subjects = [...new Set(allAssignments.map(a => a.subject).filter(Boolean))].sort();
    populateFilterDropdown(filterSemesterSelectEl, semesters, 'All Semesters');
    populateFilterDropdown(filterSubjectSelectEl, subjects, 'All Subjects');
}

function populateFilterDropdown(selectElement, items, defaultOptionText) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
    items.forEach(item => selectElement.add(new Option(item, item)));
    selectElement.value = currentValue;
}

function applyCurrentFilters() {
    if (!allAssignments) return;
    const searchTerm = searchTermInputEl.value.toLowerCase().trim();
    const selectedSemester = filterSemesterSelectEl.value;
    const selectedSubject = filterSubjectSelectEl.value;
    const assignmentNumFilter = filterAssignmentNumberInputEl.value.toLowerCase().trim();
    const sortByValue = sortBySelectEl.value;
    let filtered = allAssignments.filter(a =>
        (searchTerm ? [a.assignmentTitle, a.subject, ...(a.keywords || [])].join(' ').toLowerCase().includes(searchTerm) : true) &&
        (selectedSemester ? a.semester === selectedSemester : true) &&
        (selectedSubject ? a.subject === selectedSubject : true) &&
        (assignmentNumFilter ? String(a.assignmentNumber || '').toLowerCase().includes(assignmentNumFilter) : true)
    );
    filtered.sort((a, b) => {
        if (sortByValue === 'votes_desc') return (b.votes || 0) - (a.votes || 0);
        if (sortByValue === 'uploadDate_asc') return (a.uploadDate?.toMillis() || 0) - (b.uploadDate?.toMillis() || 0);
        return (b.uploadDate?.toMillis() || 0) - (a.uploadDate?.toMillis() || 0);
    });
    renderAssignments(filtered);
}

function resetAllFilters() {
    searchTermInputEl.value = '';
    filterSemesterSelectEl.value = '';
    filterSubjectSelectEl.value = '';
    filterAssignmentNumberInputEl.value = '';
    sortBySelectEl.value = 'uploadDate_desc';
    applyCurrentFilters();
}

function showUploadModal() {
    if (!auth.currentUser) { openAssignmentAuthModal('login'); return; }
    uploadAssignmentFormEl.reset();
    clearError(uploadFormErrorEl);
    uploadModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function fetchUploaderNameFromUsersCollection(uploaderId, fallbackName = 'Anonymous') {
    if (userNamesCache[uploaderId]) return userNamesCache[uploaderId];
    if (!uploaderId) return fallbackName;
    try {
        const userDocRef = doc(db, 'users', uploaderId);
        const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists()) {
            const displayName = docSnap.data().name || docSnap.data().email || fallbackName;
            userNamesCache[uploaderId] = displayName;
            return displayName;
        }
        return fallbackName;
    } catch {
        return fallbackName;
    }
}

async function openUploaderProfileModal(uploaderId) {
    if (!uploaderId) return;
    uploaderProfileModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('modalUploaderProfileName').textContent = 'Loading...';
    try {
        const userDocRef = doc(db, 'users', uploaderId);
        const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('modalUploaderProfileAvatar').textContent = data.name?.charAt(0).toUpperCase() || '?';
            document.getElementById('modalUploaderProfileName').textContent = data.name || 'N/A';
        }
    } catch (error) {
        document.getElementById('modalUploaderProfileName').textContent = 'Error loading profile.';
    }
}

// --- EVENT LISTENERS ---
assignmentLoginBtnEl.addEventListener('click', () => openAssignmentAuthModal('login'));
assignmentLogoutBtnEl.addEventListener('click', () => signOut(auth));
assignmentAuthFormEl.addEventListener('submit', handleAssignmentAuthFormSubmit);
assignmentSwitchToSignupLinkEl.addEventListener('click', (e) => { e.preventDefault(); openAssignmentAuthModal('signup'); });
assignmentSwitchToLoginLinkEl.addEventListener('click', (e) => { e.preventDefault(); openAssignmentAuthModal('login'); });
closeAssignmentAuthModalBtnEl.addEventListener('click', () => {
    assignmentAuthModalEl.classList.remove('active');
    document.body.style.overflow = '';
});

showUploadFormBtnEl.addEventListener('click', showUploadModal);
uploadAssignmentFormEl.addEventListener('submit', handleFormSubmit);
closeUploadModalBtnEl.addEventListener('click', () => {
    uploadModalEl.classList.remove('active');
    document.body.style.overflow = '';
});

applyFiltersBtnEl.addEventListener('click', applyCurrentFilters);
resetFiltersBtnEl.addEventListener('click', resetAllFilters);
sortBySelectEl.addEventListener('change', applyCurrentFilters);

notificationSettingsBtnEl.addEventListener('click', () => {
    if (!auth.currentUser) { openAssignmentAuthModal('login'); return; }
    loadNotificationSettings();
    notificationSettingsModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
});
closeNotificationSettingsModalBtnEl.addEventListener('click', () => {
    notificationSettingsModalEl.classList.remove('active');
    document.body.style.overflow = '';
});
notificationSettingsFormEl.addEventListener('submit', saveNotificationSettings);

subscribeBtnEl.addEventListener('click', () => {
    OneSignal.showSlidedownPrompt();
});

OneSignal.push(() => {
    OneSignal.on('subscriptionChange', () => {
        updateSubscriptionUi();
    });
});

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
    OneSignal.push(() => {
        updateSubscriptionUi();
    });
});