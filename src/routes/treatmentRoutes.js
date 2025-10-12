// backend/src/routes/treatmentRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Mock treatments database (replace with actual database in production)
const treatmentsDb = {
    "Black Sigatoka": {
        treatments: [
            "Apply fungicide treatments with products containing chlorothalonil, mancozeb, or propiconazole.",
            "Remove and destroy infected leaves to reduce the spread of spores.",
            "Improve drainage in the plantation to reduce humidity and leaf wetness.",
            "Maintain proper spacing between plants to improve air circulation."
        ],
        preventionTips: [
            "Implement a regular fungicide spray program during rainy seasons.",
            "Use disease-resistant banana varieties when available.",
            "Ensure proper nutrition with balanced fertilization.",
            "Monitor plants regularly for early signs of infection."
        ]
    },
    "Yellow Sigatoka": {
        treatments: [
            "Apply fungicides containing mancozeb or propiconazole.",
            "Remove infected leaves and destroy them.",
            "Ensure good drainage in the plantation.",
            "Maintain adequate spacing between plants."
        ],
        preventionTips: [
            "Use resistant varieties when available.",
            "Implement proper sanitation practices.",
            "Apply preventive fungicide sprays during wet seasons.",
            "Ensure balanced nutrition for plants."
        ]
    },
    "Panama Disease": {
        treatments: [
            "There is no effective chemical treatment for Panama disease.",
            "Remove and destroy infected plants, including roots.",
            "Quarantine affected areas to prevent spread.",
            "Disinfect tools and equipment used in affected areas."
        ],
        preventionTips: [
            "Use resistant varieties like Cavendish for Fusarium Race 1.",
            "Implement strict biosecurity measures.",
            "Avoid planting in previously infected soil.",
            "Use disease-free planting material."
        ]
    },
    "Banana Bunchy Top Virus": {
        treatments: [
            "There is no cure for infected plants. Remove and destroy infected plants immediately.",
            "Control aphid vectors with appropriate insecticides.",
            "Create barriers between infected and healthy plants.",
            "Use virus-free planting material."
        ],
        preventionTips: [
            "Use certified disease-free planting material.",
            "Regularly monitor for aphids and early symptoms.",
            "Maintain field hygiene and quarantine measures.",
            "Implement aphid control strategies."
        ]
    }
};

// Get treatments for a disease
router.get('/treatments/:diseaseName', (req, res) => {
    const diseaseName = req.params.diseaseName;
    
    if (treatmentsDb[diseaseName]) {
        res.status(200).json(treatmentsDb[diseaseName]);
    } else {
        res.status(404).json({
            treatments: [],
            preventionTips: [],
            message: "No treatments available yet. We will notify you when a professional adds treatment information."
        });
    }
});

// Add a new treatment (for professionals)
router.post('/treatments', (req, res) => {
    try {
        const { diseaseName, treatments, preventionTips } = req.body;
        
        if (!diseaseName || !treatments || !preventionTips) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Add or update treatment in database
        treatmentsDb[diseaseName] = {
            treatments: treatments,
            preventionTips: preventionTips
        };
        
        res.status(200).json({
            success: true,
            message: `Treatment for ${diseaseName} added successfully`
        });
    } catch (err) {
        console.error('Error adding treatment:', err);
        res.status(500).json({ error: 'Failed to add treatment', details: err.message });
    }
});

module.exports = router;