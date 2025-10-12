const express = require("express")
const cors = require("cors")
const nodemailer = require("nodemailer")
const WebSocket = require("ws")
const path = require("path")
const fs = require("fs")
const http = require("http")
const { v4: uuidv4 } = require("uuid")

// Load environment variables
require("dotenv").config()

// Initialize Express app
const app = express()

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Middleware
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5000", "http://localhost:3000"];

app.use(
  cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use("/uploads", express.static(uploadsDir))

// Create HTTP server
const server = http.createServer(app)

// Initialize WebSocket server
const wss = new WebSocket.Server({ server })

// Store WebSocket server globally for access from routes
global.wss = wss

/**
 * Find similar diseases in the database based on image features or metadata
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<Object>} - Analysis results
 */
async function findSimilarDiseasesInDatabase(imageUrl) {
  try {
    console.log("Searching for similar diseases in database")

    // Since we don't have Firebase, we'll use the fallback
    return generateFallbackResult()
  } catch (error) {
    console.error("Error finding similar diseases:", error)
    return generateFallbackResult()
  }
}

/**
 * Generate a fallback result when no diseases are found
 * @returns {Object} - Fallback analysis result
 */
function generateFallbackResult() {
  console.log("Generating fallback result")

  // Common banana diseases
  const commonDiseases = [
    {
      name: "Sigatoka Leaf Spot",
      scientificName: "Mycosphaerella musicola",
      severity: "Medium",
      description:
        "Yellow Sigatoka is a leaf spot disease of banana plants caused by the ascomycete fungus Mycosphaerella musicola.",
      treatments: ["Remove infected leaves", "Apply fungicide", "Improve drainage"],
    },
    {
      name: "Black Sigatoka",
      scientificName: "Mycosphaerella fijiensis",
      severity: "High",
      description:
        "Black Sigatoka is a leaf-spot disease of banana plants caused by the ascomycete fungus Mycosphaerella fijiensis.",
      treatments: ["Remove infected leaves", "Apply fungicide", "Improve air circulation"],
    },
    {
      name: "Panama Disease",
      scientificName: "Fusarium oxysporum f.sp. cubense",
      severity: "High",
      description:
        "Panama disease is a plant disease that affects bananas and is caused by the fungus Fusarium oxysporum f. sp. cubense.",
      treatments: ["Use resistant varieties", "Quarantine infected areas", "Improve soil health"],
    },
    {
      name: "Banana Bunchy Top",
      scientificName: "Banana bunchy top virus (BBTV)",
      severity: "High",
      description:
        "Banana bunchy top is a viral disease that affects banana plants, causing stunted growth and reduced fruit production.",
      treatments: ["Remove infected plants", "Control aphid vectors", "Use virus-free planting material"],
    },
  ]

  // Select a random disease
  const selectedDisease = commonDiseases[Math.floor(Math.random() * commonDiseases.length)]

  return {
    detections: [
      {
        label: selectedDisease.name,
        scientificName: selectedDisease.scientificName,
        confidence: 0.7 + Math.random() * 0.2, // Random confidence between 0.7 and 0.9
        severity: selectedDisease.severity,
        boundingBox: {
          x: 10,
          y: 15,
          width: 80,
          height: 70,
        },
        description: selectedDisease.description,
        treatments: selectedDisease.treatments,
        source: "fallback",
      },
    ],
    processingTime: 0.3 + Math.random() * 0.5,
  }
}

// WebSocket connection handling
wss.on("connection", (ws, req) => {
  console.log("WebSocket client connected")

  // Set initial user ID to null
  ws.userId = null

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message)
      console.log("WebSocket message received:", data)

      // Handle authentication message
      if (data.type === "authenticate") {
        ws.userId = data.data.userId
        console.log(`WebSocket client authenticated as user: ${ws.userId}`)

        // Send acknowledgment
        ws.send(
          JSON.stringify({
            type: "authentication_response",
            data: { success: true, userId: ws.userId },
          }),
        )
      }

      // Handle analysis request
      if (data.type === "analyze_image" && data.data.imageId) {
        // Extract user ID from the WebSocket connection or the message
        const userId = ws.userId || data.data.userId

        if (!userId) {
          ws.send(
            JSON.stringify({
              type: "error",
              data: { message: "Not authenticated" },
            }),
          )
          return
        }

        // Log the analysis request
        console.log(`WebSocket analysis request received for image: ${data.data.imageId} from user: ${userId}`)

        // Process the analysis request asynchronously
        ;(async () => {
          try {
            // Create an analysis ID
            const analysisId = uuidv4()

            // Send immediate acknowledgment
            ws.send(
              JSON.stringify({
                type: "analysis_request_received",
                data: {
                  success: true,
                  analysisId: analysisId,
                  imageId: data.data.imageId,
                  status: "pending",
                },
              }),
            )
            console.log(`Analysis request acknowledgment sent for analysis: ${analysisId}`)

            // Simulate analysis progress
            let progress = 0
            const progressInterval = setInterval(() => {
              progress += 10
              if (progress <= 90) {
                // Send progress update
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: "analysis_progress",
                      data: {
                        analysisId,
                        imageId: data.data.imageId,
                        progress,
                      },
                    }),
                  )
                }
              } else {
                clearInterval(progressInterval)
              }
            }, 1000)

            // Simulate processing time (3-5 seconds)
            const processingTime = 3000 + Math.random() * 2000
            await new Promise((resolve) => setTimeout(resolve, processingTime))

            // Generate analysis result
            const result = await findSimilarDiseasesInDatabase("dummy-url")

            // Send the result back to the client
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "analysis_results",
                  data: {
                    analysisId,
                    imageId: data.data.imageId,
                    status: "completed",
                    detection: {
                      name: result.detections[0].label,
                      scientificName: result.detections[0].scientificName,
                      confidence: Math.round(result.detections[0].confidence * 100),
                      severity: result.detections[0].severity,
                      description: result.detections[0].description,
                    },
                    treatments: result.detections[0].treatments,
                    preventionTips: [
                      "Implement a regular fungicide spray program during rainy seasons.",
                      "Use disease-resistant banana varieties when available.",
                      "Ensure proper nutrition with balanced fertilization.",
                      "Monitor plants regularly for early signs of infection.",
                    ],
                  },
                }),
              )
              console.log(`Analysis response sent via WebSocket for analysis: ${analysisId}`)
            }
          } catch (error) {
            console.error("Error processing WebSocket analysis request:", error)
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  data: { message: error.message },
                }),
              )
            }
          }
        })()
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error)
    }
  })

  ws.on("close", () => {
    console.log("WebSocket client disconnected")
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
  })

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "welcome",
      data: { message: "Connected to MUSALYTICS WebSocket server" },
    }),
  )
})

// Import routes that actually exist
const imageRoutes = require("./src/routes/imageRoutes")
const analysisRoutes = require("./src/routes/analysisRoutes")
const treatmentRoutes = require("./src/routes/treatmentRoutes")

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Email config error:", error.message)
  } else {
    console.log("Email server ready")
  }
})

// Store OTPs (in-memory)
const otpStore = new Map()

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Root route
app.get("/", (req, res) => {
  res.send("Backend API is running")
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    websocket: wss.clients.size > 0 ? "connected clients: " + wss.clients.size : "no clients",
  })
})

// Email OTP endpoint
app.post("/api/auth/send-email-otp", async (req, res) => {
  try {
    const { userId, email, firstName } = req.body

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId or email",
      })
    }

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = Date.now() + 600000 // 10 minutes

    // Store OTP
    otpStore.set(email, {
      userId,
      code: otp,
      expiresAt: expiresAt,
    })

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
            <p>Hello ${firstName || "there"},</p>
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

    // Send email
    const info = await transporter.sendMail(mailOptions)
    console.log(`Email sent to ${email}`)

    // Notify through WebSocket if connected
    const clients = Array.from(wss.clients).filter((client) => client.readyState === WebSocket.OPEN)
    if (clients.length > 0) {
      const message = JSON.stringify({
        type: "EMAIL_OTP_SENT",
        data: { userId, email },
      })
      clients.forEach((client) => client.send(message))
    }

    return res.status(200).json({
      success: true,
      expiresAt: expiresAt,
    })
  } catch (error) {
    console.error("Error sending email:", error.message)
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to send verification email",
    })
  }
})

// Verify OTP endpoint
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { userId, otpType, code } = req.body
    const identifier = req.body.email || req.body.phoneNumber

    if (!userId || !otpType || !code || !identifier) {
      return res.status(400).json({
        verified: false,
        error: "Missing required fields",
      })
    }

    // Check if OTP exists
    const storedOTP = otpStore.get(identifier)

    if (!storedOTP) {
      return res.status(400).json({
        verified: false,
        error: "No verification code found. Please request a new code.",
        errorType: "not_found",
      })
    }

    // Check if OTP is expired
    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(identifier)
      return res.status(400).json({
        verified: false,
        error: "Verification code has expired. Please request a new code.",
        errorType: "expired",
      })
    }

    // Check if code matches
    if (storedOTP.code !== code) {
      return res.status(400).json({
        verified: false,
        error: "Invalid verification code. Please try again.",
        errorType: "invalid",
      })
    }

    // Clear OTP after successful verification
    otpStore.delete(identifier)
    console.log(`OTP verified for user ${userId}`)

    // Notify through WebSocket if connected
    const clients = Array.from(wss.clients).filter((client) => client.readyState === WebSocket.OPEN)
    if (clients.length > 0) {
      const message = JSON.stringify({
        type: "OTP_VERIFIED",
        data: { userId, otpType },
      })
      clients.forEach((client) => client.send(message))
    }

    return res.status(200).json({ verified: true })
  } catch (error) {
    console.error("Error verifying OTP:", error.message)
    return res.status(500).json({
      verified: false,
      error: error.message || "Failed to verify code",
    })
  }
})

// Register routes
app.use("/api", imageRoutes)
app.use("/api", analysisRoutes)
app.use("/api", treatmentRoutes)

// WebSocket status endpoint
app.get("/websocket/status", (req, res) => {
  res.json({
    connected: wss.clients.size > 0,
    clientCount: wss.clients.size,
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`)
  console.error(err.stack)
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  })
})

// Start server
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`)
  console.log(`WebSocket server running on ws://localhost:${PORT}`)
})

module.exports = { app, wss }
