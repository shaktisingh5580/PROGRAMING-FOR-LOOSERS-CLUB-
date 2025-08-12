// Shared authentication utilities
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"

const firebaseConfig = {
  apiKey: "AIzaSyCCc1y2kNbSftG45mB3gkbUCGs4gfjts-E",
  authDomain: "realtimepfl.firebaseapp.com",
  databaseURL: "https://realtimepfl-default-rtdb.firebaseio.com",
  projectId: "realtimepfl",
  storageBucket: "realtimepfl.firebasestorage.app",
  messagingSenderId: "984202175754",
  appId: "1:984202175754:web:a0d689738832cc48b686f3",
  measurementId: "G-4W311B25HV",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// Auth state management
let currentUser = null
let currentProfile = null

// Check if user has completed profile
async function checkProfileCompletion(user) {
  if (!user) return false
  try {
    const profileDoc = await getDoc(doc(db, "profiles", user.uid))
    return profileDoc.exists() && profileDoc.data().name
  } catch (error) {
    console.error("Error checking profile:", error)
    return false
  }
}

// Get user profile
async function getUserProfile(uid) {
  if (!uid) return null
  try {
    const profileDoc = await getDoc(doc(db, "profiles", uid))
    return profileDoc.exists() ? { id: profileDoc.id, ...profileDoc.data() } : null
  } catch (error) {
    console.error("Error getting profile:", error)
    return null
  }
}

// Redirect to login with current page as redirect
function redirectToLogin() {
  const currentPage = window.location.pathname.split("/").pop() || "chat.html"
  window.location.href = `login.html?redirect=${currentPage}`
}

// Initialize auth state listener
function initAuth(callbacks = {}) {
  return onAuthStateChanged(auth, async (user) => {
    currentUser = user

    if (user) {
      // Check if profile is complete
      const hasProfile = await checkProfileCompletion(user)
      currentProfile = await getUserProfile(user.uid)

      // If no profile and not on profile page, redirect to profile completion
      if (!hasProfile && !window.location.pathname.includes("profile.html")) {
        window.location.href = "profile.html"
        return
      }

      if (callbacks.onSignedIn) {
        callbacks.onSignedIn(user, currentProfile)
      }
    } else {
      currentProfile = null
      if (callbacks.onSignedOut) {
        callbacks.onSignedOut()
      }
    }

    if (callbacks.onAuthStateChanged) {
      callbacks.onAuthStateChanged(user, currentProfile)
    }
  })
}

// Sign out function
async function signOutUser() {
  try {
    await signOut(auth)
    window.location.href = "login.html"
  } catch (error) {
    console.error("Error signing out:", error)
  }
}

// Require authentication (redirect if not signed in)
function requireAuth() {
  if (!currentUser) {
    redirectToLogin()
    return false
  }
  return true
}

// Export for use in other files
export {
  auth,
  db,
  currentUser,
  currentProfile,
  initAuth,
  signOutUser,
  redirectToLogin,
  requireAuth,
  getUserProfile,
  checkProfileCompletion,
}
