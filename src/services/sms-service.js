const { db } = require("../config/firebase-admin")
const twilio = require("twilio")

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

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

// Send SMS with OTP
const sendSMS = async (userId, phoneNumber) => {
  try {
    // Generate OTP
    const otp = generateOTP()

    // Store OTP in Firestore
    await storeOTP(userId, "phone", otp)

    // Send SMS via Twilio
    const message = await twilioClient.messages.create({
      body: `Your MUSALYTICS verification code is: ${otp}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    })

    console.log("SMS sent with SID:", message.sid)

    return { success: true }
  } catch (error) {
    console.error("Error sending SMS:", error)
    throw error
  }
}

module.exports = {
  generateOTP,
  sendSMS,
}

