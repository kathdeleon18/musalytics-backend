const express = require("express");
const router = express.Router();
const { verifyIdToken } = require("../config/firebase-admin");
const { sendVerificationEmail, verifyOTP } = require("../services/email-service");
const { sendSMS } = require("../services/sms-service");
const nodemailer = require('nodemailer');

// Create a transporter using SMTP with improved debugging
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  debug: true,
  logger: true
});

// Verify SMTP connection configuration
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
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

// Middleware to verify Firebase ID token
const authenticateUser = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split("Bearer ")[1];

    if (!idToken) {
      return res.status(401).json({ error: "No authentication token provided" });
    }

    try {
      const decodedToken = await verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(401).json({ error: "Invalid authentication token" });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

// Send email verification OTP (with authentication)
router.post("/send-email-otp", authenticateUser, async (req, res) => {
  try {
    const { userId, email, firstName, authUid } = req.body;

    if (!userId || !email || !firstName) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: userId, email, or firstName" 
      });
    }

    // Verify that the authenticated user matches the requested userId
    if (req.user.uid !== authUid) {
      return res.status(403).json({ 
        success: false,
        error: "Unauthorized access" 
      });
    }

    console.log(`Sending email verification to ${email} for user ${userId}`);
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with timestamp
    otpStore.set(email, {
      userId: userId,
      code: otp,
      expiresAt: Date.now() + 600000 // 10 minutes
    });

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
    };
    
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${email}. Message ID: ${info.messageId}`);
      
      return res.status(200).json({ success: true });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to send verification email. Please check your email configuration." 
      });
    }
  } catch (error) {
    console.error("Error in send-email-otp route:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to send verification email" 
    });
  }
});

// Send SMS verification OTP (with authentication)
router.post("/send-sms-otp", authenticateUser, async (req, res) => {
  try {
    const { userId, phoneNumber, authUid } = req.body;

    if (!userId || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: userId or phoneNumber" 
      });
    }

    // Verify that the authenticated user matches the requested userId
    if (req.user.uid !== authUid) {
      return res.status(403).json({ 
        success: false,
        error: "Unauthorized access" 
      });
    }

    console.log(`Sending SMS verification to ${phoneNumber} for user ${userId}`);
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with timestamp
    otpStore.set(phoneNumber, {
      userId: userId,
      code: otp,
      expiresAt: Date.now() + 600000 // 10 minutes
    });

    // Try to use the SMS service if available
    try {
      if (typeof sendSMS === 'function') {
        const result = await sendSMS(userId, phoneNumber, otp);
        return res.status(200).json({ success: true });
      } else {
        // Fallback if sendSMS is not available
        console.log(`SMS service not available. Would send code ${otp} to ${phoneNumber}`);
        return res.status(200).json({ 
          success: true, 
          message: "SMS service not configured, but OTP was generated" 
        });
      }
    } catch (smsError) {
      console.error("Error sending SMS:", smsError);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to send verification SMS" 
      });
    }
  } catch (error) {
    console.error("Error in send-sms-otp route:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to send verification SMS" 
    });
  }
});

// Verify OTP (both email and SMS) (with authentication)
router.post("/verify-otp", authenticateUser, async (req, res) => {
  try {
    const { userId, otpType, code, authUid } = req.body;

    if (!userId || !otpType || !code) {
      return res.status(400).json({ 
        verified: false, 
        error: "Missing required fields: userId, otpType, or code" 
      });
    }

    // Verify that the authenticated user matches the requested userId
    if (req.user.uid !== authUid) {
      return res.status(403).json({ 
        verified: false,
        error: "Unauthorized access" 
      });
    }

    console.log(`Verifying ${otpType} OTP for user ${userId}`);
    
    // Determine which identifier to use based on otpType
    const identifier = otpType === 'email' ? req.body.email : req.body.phoneNumber;
    
    // Check if we have the OTP stored
    const storedOTP = otpStore.get(identifier);
    
    if (!storedOTP) {
      return res.status(400).json({ 
        verified: false, 
        error: "No verification code found" 
      });
    }
    
    // Check if OTP is expired
    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(identifier);
      return res.status(400).json({ 
        verified: false, 
        error: "Verification code has expired" 
      });
    }
    
    // Check if code matches
    if (storedOTP.code !== code) {
      return res.status(400).json({ 
        verified: false, 
        error: "Invalid verification code" 
      });
    }
    
    // Clear OTP after successful verification
    otpStore.delete(identifier);
    
    // Try to use the verifyOTP function if available
    try {
      if (typeof verifyOTP === 'function') {
        const result = await verifyOTP(userId, otpType, code);
        return res.status(200).json(result);
      } else {
        // Fallback if verifyOTP is not available
        console.log(`OTP verification successful for user ${userId}`);
        return res.status(200).json({ verified: true });
      }
    } catch (verifyError) {
      console.error("Error during OTP verification:", verifyError);
      return res.status(500).json({ 
        verified: false, 
        error: "Failed to verify code" 
      });
    }
  } catch (error) {
    console.error("Error in verify-otp route:", error);
    res.status(500).json({ 
      verified: false, 
      error: error.message || "Failed to verify code" 
    });
  }
});

// Simple route for testing without authentication
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    console.log(`Sending OTP to ${email}`);
    const otp = generateOTP();
    
    // Store OTP with timestamp
    otpStore.set(email, {
      code: otp,
      expiresAt: Date.now() + 600000 // 10 minutes
    });
    
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
            <p>Hello there,</p>
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
    };
    
    try {
      await transporter.sendMail(mailOptions);
      res.json({ message: 'OTP sent successfully' });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Debug route to check if auth routes are working
router.get("/status", (req, res) => {
  res.status(200).json({ 
    status: "Auth routes are working",
    routes: [
      "/api/auth/send-email-otp",
      "/api/auth/send-sms-otp",
      "/api/auth/verify-otp",
      "/api/auth/send-otp"
    ]
  });
});

// Log that routes are registered
console.log("Auth routes registered:", 
  ["/send-email-otp", "/send-sms-otp", "/verify-otp", "/send-otp", "/status"]
    .map(route => `/api/auth${route}`)
);

module.exports = router;