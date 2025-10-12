// Backend Firebase Admin Configuration
const admin = require("firebase-admin")
const fs = require("fs")
const path = require("path")

// Service account credentials
let serviceAccount

// Try to load from environment variable first
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch (error) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT environment variable:", error)
    process.exit(1)
  }
} else {
  // If not in environment, look for service account file
  const serviceAccountPath = path.join(__dirname, "../../service-account.json")

  try {
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath)
    } else {
      // No fallback credentials for production security
      console.error("ERROR: No Firebase service account credentials found!")
      console.error("Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide service-account.json file")
      process.exit(1)
    }
  } catch (error) {
    console.error("Error loading service account file:", error)
    process.exit(1)
  }
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    })

    console.log("Firebase Admin SDK initialized successfully")
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error)
    process.exit(1)
  }
}

// Export admin instance and commonly used services
const auth = admin.auth()
const db = admin.firestore()
const storage = admin.storage()

// Helper functions for backend
const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error)
    throw error
  }
}

const getUserById = async (uid) => {
  try {
    const userRecord = await auth.getUser(uid)
    return userRecord
  } catch (error) {
    console.error("Error fetching user data:", error)
    throw error
  }
}

const createCustomToken = async (uid, claims = {}) => {
  try {
    const customToken = await auth.createCustomToken(uid, claims)
    return customToken
  } catch (error) {
    console.error("Error creating custom token:", error)
    throw error
  }
}

// Export all services and helpers
module.exports = {
  admin,
  auth,
  db,
  storage,
  verifyIdToken,
  getUserById,
  createCustomToken,
}

