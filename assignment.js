import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc as getFirestoreDoc, updateDoc, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

// --- AUTHENTICATION & UI ---
onAuthStateChanged(auth, user => {
    if (user) {
        assignmentUserEmailEl.textContent = user.email;
        assignmentLoginBtnEl.classList.add('hidden');
        assignmentLogoutBtnEl.classList.remove('hidden');
        showUploadFormBtnEl.classList.remove('hidden');
        if (assignmentAuthModalEl.classList.contains('active')) {
            assignmentAuthModalEl.classList.remove('active');
            document.body.style.overflow = '';
        }
    } else {
        assignmentUserEmailEl.textContent = 'Not logged in';
        assignmentLoginBtnEl.classList.remove('hidden');
        assignmentLogoutBtnEl.classList.add('hidden');
        showUploadFormBtnEl.classList.add('hidden');
    }
    applyCurrentFilters();
});


// --- AUTH & MODAL FUNCTIONS ---
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

// --- ASSIGNMENT FUNCTIONS ---
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

    const uploaderNamePromises = assignmentsToRender.map(assignment =>
        fetchUploaderName(assignment.uploaderId, assignment.uploaderEmail || 'Anonymous')
    );
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

        card.querySelector('.uploader-name-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            openUploaderProfileModal(assignment.uploaderId);
        });
        card.querySelector('.vote-btn')?.addEventListener('click', (event) => handleVote(assignment.id, event.currentTarget));
        assignmentsGridEl.appendChild(card);
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
        showError(uploadFormErrorEl, "You must be logged in.");
        return;
    }
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
    if (!user) {
        openAssignmentAuthModal('login');
        return;
    }
    const assignmentRef = doc(db, "assignments", assignmentId);
    voteButtonElement.disabled = true;
    try {
        const docSnap = await getFirestoreDoc(assignmentRef);
        if (!docSnap.exists()) return;
        const assignmentData = docSnap.data();
        const hasVoted = (assignmentData.votedBy || []).includes(user.uid);
        const updatePayload = hasVoted
            ? { votes: increment(-1), votedBy: arrayRemove(user.uid) }
            : { votes: increment(1), votedBy: arrayUnion(user.uid) };
        await updateDoc(assignmentRef, updatePayload);
        const voteCountSpan = voteButtonElement.parentElement.querySelector('.vote-count');
        const newVoteCount = (assignmentData.votes || 0) + (hasVoted ? -1 : 1);
        voteCountSpan.textContent = newVoteCount;
        voteButtonElement.classList.toggle('voted', !hasVoted);
    } catch (error) {
        console.error("Vote error:", error);
    } finally {
        voteButtonElement.disabled = false;
    }
}

// --- FILTERING AND SORTING ---
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
    if (!auth.currentUser) {
        openAssignmentAuthModal('login');
        return;
    }
    uploadAssignmentFormEl.reset();
    clearError(uploadFormErrorEl);
    uploadModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// --- PROFILE MODAL FUNCTIONS ---
async function fetchUploaderName(uploaderId, fallbackName = 'Anonymous') {
    if (userNamesCache[uploaderId]) return userNamesCache[uploaderId];
    if (!uploaderId) return fallbackName;
    try {
        const userDocRef = doc(db, 'profiles', uploaderId);
        const docSnap = await getFirestoreDoc(userDocRef);
        if (docSnap.exists() && docSnap.data().name) {
            const displayName = docSnap.data().name;
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
    const modalContent = uploaderProfileModalEl.querySelector('.modal-content');
    modalContent.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
    uploaderProfileModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const userDocRef = doc(db, 'profiles', uploaderId);
        const docSnap = await getFirestoreDoc(userDocRef);

        let profileHtml;

        if (docSnap.exists()) {
            const p = docSnap.data();
            const name = p.name || 'Unnamed';
            const sub = [p.college, p.semester ? `Sem ${p.semester}` : ''].filter(Boolean).join(' · ');
            const links = [
                { name: 'Instagram', href: p.instagram },
                { name: 'GitHub', href: p.github },
                { name: 'LinkedIn', href: p.linkedin }
            ].filter(l => l.href);

            profileHtml = `
                <button class="close-profile-popup">&times;</button>
                <div class="profile-card">
                    <div class="name">${name}</div>
                    <div class="sub">${sub || 'No details provided.'}</div>
                    ${links.length > 0 ? `
                        <div class="links">
                            ${links.map(l => `<a href="${l.href}" class="link" target="_blank" rel="noopener noreferrer">${l.name}</a>`).join('')}
                        </div>
                    ` : ''}
                </div>`;
        } else {
            profileHtml = `
                <button class="close-profile-popup">&times;</button>
                <div class="profile-card">
                    <div class="name">Profile Not Found</div>
                    <div class="sub">This user hasn't completed their profile yet.</div>
                </div>`;
        }
        modalContent.innerHTML = profileHtml;
    } catch (error) {
        console.error("Error loading profile:", error);
        modalContent.innerHTML = `
            <button class="close-profile-popup">&times;</button>
            <div class="profile-card">
                <div class="name">Error</div>
                <div class="sub">Could not load the user profile.</div>
            </div>`;
    }
    modalContent.querySelector('.close-profile-popup')?.addEventListener('click', () => {
        uploaderProfileModalEl.classList.remove('active');
        document.body.style.overflow = '';
    });
}

// --- EVENT LISTENERS ---
assignmentLoginBtnEl.addEventListener('click', () => openAssignmentAuthModal('login'));
assignmentLogoutBtnEl.addEventListener('click', () => signOut(auth));
assignmentAuthFormEl.addEventListener('submit', handleAssignmentAuthFormSubmit);
assignmentSwitchToSignupLinkEl.addEventListener('click', (e) => { e.preventDefault(); openAssignmentAuthModal('signup'); });
assignmentSwitchToLoginLinkEl.addEventListener('click', (e) => { e.preventDefault(); openAssignmentAuthModal('login'); });
closeAssignmentAuthModalBtnEl.addEventListener('click', () => { assignmentAuthModalEl.classList.remove('active'); document.body.style.overflow = ''; });
showUploadFormBtnEl.addEventListener('click', showUploadModal);
uploadAssignmentFormEl.addEventListener('submit', handleFormSubmit);
closeUploadModalBtnEl.addEventListener('click', () => { uploadModalEl.classList.remove('active'); document.body.style.overflow = ''; });
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

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchAssignments();
});
