const axios = require("axios")
const { db } = require("../config/firebase-admin")

// Resend API configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_API_URL = "https://api.resend.com/emails"

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store OTP in Firestore with expiration
const storeOTP = async (userId, otpType, otp) => {
  try {
    // Set expiration time (10 minutes from now)
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    // Store OTP in Firestore
    await db
      .collection("otpCodes")
      .doc(userId)
      .set(
        {
          [otpType]: {
            code: otp,
            expiresAt: expiresAt,
            attempts: 0,
          },
          updatedAt: new Date(),
        },
        { merge: true },
      )

    return true
  } catch (error) {
    console.error("Error storing OTP:", error)
    throw error
  }
}

// Send verification email with OTP using Resend API
const sendVerificationEmail = async (userId, email, firstName) => {
  try {
    console.log(`Starting email verification process for user ${userId} (${email})`)
    
    // Check if Resend API key is configured
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set")
    }
    
    // Generate OTP
    const otp = generateOTP()
    console.log(`Generated OTP code for ${email}`)

    // Store OTP in Firestore
    await storeOTP(userId, "email", otp)
    console.log(`Stored OTP in Firestore for user ${userId}`)

    // Email content
    const emailData = {
      from: "MUSALYTICS <onboarding@resend.dev>",
      to: [email],
      subject: "Verify Your MUSALYTICS Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #10b981;">MUSALYTICS</h1>
            <p style="font-size: 18px; color: #333;">Account Verification</p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p>Hello ${firstName},</p>
            <p>Thank you for registering with MUSALYTICS. To verify your account, please use the following verification code:</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h2 style="margin: 0; letter-spacing: 5px; color: #333;">${otp}</h2>
            </div>
            
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
          
          <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 12px; color: #777; text-align: center;">
            <p>© ${new Date().getFullYear()} MUSALYTICS. All rights reserved.</p>
          </div>
        </div>
      `,
    }

    console.log(`Attempting to send email to ${email} using Resend API`)

    // Send email using Resend API
    const response = await axios.post(RESEND_API_URL, emailData, {
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    console.log(`✅ Email sent successfully to ${email}. Resend ID: ${response.data.id}`)

    return { success: true, messageId: response.data.id }
  } catch (error) {
    console.error("❌ Error sending verification email via Resend:", error)
    
    if (error.response) {
      console.error("Resend API Error Response:", error.response.data)
    }
    
    throw error
  }
}

// Verify OTP (same as before)
const verifyOTP = async (userId, otpType, code) => {
  try {
    // Get stored OTP
    const otpDoc = await db.collection("otpCodes").doc(userId).get()

    if (!otpDoc.exists) {
      return { verified: false, error: "No verification code found" }
    }

    const otpData = otpDoc.data()[otpType]

    if (!otpData) {
      return { verified: false, error: "No verification code found" }
    }

    // Check if OTP is expired
    const now = new Date()
    const expiresAt = otpData.expiresAt.toDate()

    if (now > expiresAt) {
      return { verified: false, error: "Verification code has expired" }
    }

    // Increment attempts
    await db
      .collection("otpCodes")
      .doc(userId)
      .update({
        [`${otpType}.attempts`]: otpData.attempts + 1,
      })

    // Check if too many attempts (max 5)
    if (otpData.attempts >= 5) {
      return { verified: false, error: "Too many attempts. Please request a new code" }
    }

    // Check if code matches
    if (otpData.code !== code) {
      return { verified: false, error: "Invalid verification code" }
    }

    // Mark user as verified in Firestore
    await db
      .collection("users")
      .doc(userId)
      .update({
        isVerified: true,
        [`${otpType}Verified`]: true,
        updatedAt: new Date(),
      })

    // Delete OTP document after successful verification
    await db.collection("otpCodes").doc(userId).delete()

    return { verified: true }
  } catch (error) {
    console.error("Error verifying OTP:", error)
    throw error
  }
}

module.exports = {
  generateOTP,
  sendVerificationEmail,
  verifyOTP,
}
