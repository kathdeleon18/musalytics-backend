const nodemailer = require("nodemailer")
const { db } = require("../config/firebase-admin")

// Create a transporter using SMTP with improved debugging
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // ADDED: Enable debugging to see detailed connection logs
  debug: true,
  logger: true
});

// IMPROVED: Better error logging for SMTP verification
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection error details:', error);
    console.error('Check your EMAIL_USER and EMAIL_PASSWORD environment variables');
  } else {
    console.log('SMTP server is ready to take our messages');
  }
});

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

// Send verification email with OTP - IMPROVED with better logging
const sendVerificationEmail = async (userId, email, firstName) => {
  try {
    // ADDED: Better logging
    console.log(`Starting email verification process for user ${userId} (${email})`);
    
    // Generate OTP
    const otp = generateOTP()
    console.log(`Generated OTP code for ${email}`);

    // Store OTP in Firestore
    await storeOTP(userId, "email", otp)
    console.log(`Stored OTP in Firestore for user ${userId}`);

    // Email content
    const mailOptions = {
      from: `"MUSALYTICS" <${process.env.EMAIL_USER}>`,
      to: email,
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

    // ADDED: Log email sending attempt
    console.log(`Attempting to send email to ${email} with subject "${mailOptions.subject}"`);

    // Send email
    const info = await transporter.sendMail(mailOptions)
    console.log(`✅ Email sent successfully to ${email}. Message ID: ${info.messageId}`);

    return { success: true }
  } catch (error) {
    // IMPROVED: Better error logging
    console.error("❌ Error sending verification email:", error);
    console.error("Email configuration:", {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE,
      user: process.env.EMAIL_USER ? "Set" : "Not set",
      pass: process.env.EMAIL_PASSWORD ? "Set" : "Not set"
    });
    throw error
  }
}

// Verify OTP
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