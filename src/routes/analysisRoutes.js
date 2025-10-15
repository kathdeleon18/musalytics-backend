// backend/src/routes/analysisRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Mock analyses database (replace with actual database in production)
const analysesDb = [];

// Save analysis results
router.post('/analyses', (req, res) => {
    try {
        const { analysisId, imageId, userId, detection, timestamp } = req.body;
        
        if (!analysisId || !imageId || !detection) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Create analysis record
        const analysis = {
            analysisId,
            imageId,
            userId,
            detection,
            timestamp: timestamp || new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        // Save to database
        analysesDb.push(analysis);
        
        res.status(200).json({
            success: true,
            analysisId,
            message: 'Analysis saved successfully'
        });
    } catch (err) {
        console.error('Error saving analysis:', err);
        res.status(500).json({ error: 'Failed to save analysis', details: err.message });
    }
});

// Get recent analyses for a user - IMPORTANT: This route needs to be /scans/recent to match the frontend
router.get('/scans/recent', (req, res) => {
    try {
        const userId = req.query.userId;
        const limit = parseInt(req.query.limit) || 10;
        
        // For demo purposes, return mock data if no analyses exist
        if (analysesDb.length === 0) {
            return res.status(200).json([
                {
                    id: 'mock-1',
                    imageUrl: '/placeholder.svg?height=200&width=200',
                    disease: 'Black Sigatoka',
                    location: 'Farm A',
                    date: new Date().toLocaleDateString(),
                    confidence: 95,
                    severity: 'High'
                },
                {
                    id: 'mock-2',
                    imageUrl: '/placeholder.svg?height=200&width=200',
                    disease: 'Yellow Sigatoka',
                    location: 'Farm B',
                    date: new Date(Date.now() - 86400000).toLocaleDateString(), // Yesterday
                    confidence: 87,
                    severity: 'Medium'
                }
            ]);
        }
        
        // Get analyses for user (if userId is provided)
        const userAnalyses = analysesDb
            .filter(analysis => !userId || analysis.userId === userId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
        
        // Format for frontend
        const recentScans = userAnalyses.map(analysis => ({
            id: analysis.analysisId,
            imageUrl: `/api/images/file/${analysis.imageId}`,
            disease: analysis.detection.name,
            location: 'Unknown', // This would come from metadata in a real app
            date: new Date(analysis.timestamp).toLocaleDateString(),
            confidence: analysis.detection.confidence,
            severity: analysis.detection.severity
        }));
        
        res.status(200).json(recentScans);
    } catch (err) {
        console.error('Error fetching recent analyses:', err);
        res.status(500).json({ error: 'Failed to fetch recent analyses', details: err.message });
    }
});

// Keep the original route for backward compatibility
router.get('/analyses/recent', (req, res) => {
    return res.redirect(307, `/api/scans/recent?${new URLSearchParams(req.query).toString()}`);
});

// New HTTP-based analysis endpoint
router.post('/analyze', async (req, res) => {
    try {
        const { imageUrl, userId } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }
        
        console.log('Starting HTTP-based analysis for image:', imageUrl);
        
        // Import the analysis function from server.js
        const { findSimilarDiseasesInDatabase } = require('../../server');
        
        // Perform analysis
        const analysisResult = await findSimilarDiseasesInDatabase(imageUrl);
        
        // Generate analysis ID
        const analysisId = uuidv4();
        
        // Save analysis to database
        const analysis = {
            analysisId,
            imageId: imageUrl.split('/').pop() || 'unknown',
            userId: userId || null,
            detection: analysisResult.detections[0],
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        analysesDb.push(analysis);
        
        // Return results
        res.status(200).json({
            success: true,
            analysisId,
            results: {
                detections: analysisResult.detections,
                processingTime: analysisResult.processingTime,
                timestamp: analysis.timestamp
            }
        });
        
    } catch (error) {
        console.error('Error in HTTP analysis:', error);
        res.status(500).json({ 
            error: 'Analysis failed', 
            details: error.message 
        });
    }
});

module.exports = router;