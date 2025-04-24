require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure ELEVENLABS_API_KEY is set
const API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_5d377dbe2e70849fb975f769109318b284cf1c9a3bcbc16e';

// Log environment variables (without sensitive data)
console.log('Environment loaded:', {
  port: PORT,
  apiKeyPresent: !!API_KEY,
  apiKeyLength: API_KEY ? API_KEY.length : 0
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Test route
app.get('/test', (req, res) => {
    res.send('Server is running!');
});

// Voice IDs for ElevenLabs
const VOICE_IDS = {
    'rachel': 'XB0fDUnXU5powFXDhCwa',  // Charlotte
    'mike': 'iP95p4xoKVk53GoZ742B',    // Chris
    'sarah': 'EXAVITQu4vr4xnSDxMaL',   // Sarah
    'david': 'onwK4e9ZLuTAKqWW03F9'    // Daniel
};

// API endpoint for generating podcast
app.post('/api/generate-podcast', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { text, voice_id } = req.body;
        
        if (!text || !voice_id) {
            throw new Error('Missing required parameters: text or voice_id');
        }

        // Get the actual ElevenLabs voice ID
        const actualVoiceId = VOICE_IDS[voice_id] || voice_id;
        
        console.log('Making request to ElevenLabs API...');
        console.log('Voice ID:', actualVoiceId);
        console.log('Text length:', text.length);
        console.log('API Key (first 5 chars):', API_KEY.substring(0, 5));
        
        // Test API Key direct access
        const requestData = {
            text: text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
                style: 0.0,
                use_speaker_boost: true
            }
        };
        
        console.log('Request payload:', JSON.stringify(requestData));
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': API_KEY
            },
            body: JSON.stringify(requestData)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());
        
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                console.error('ElevenLabs API Error:', errorData);
                errorMessage = errorData.detail || 'Failed to generate podcast';
            } catch (e) {
                errorMessage = `API returned status ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        // Save response to file for debugging
        const audioBuffer = await response.buffer();
        console.log('Audio buffer size:', audioBuffer.length);
        
        if (audioBuffer.length === 0) {
            throw new Error('Received empty audio response from ElevenLabs API');
        }
        
        res.set('Content-Type', 'audio/mpeg');
        res.send(audioBuffer);
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack,
            details: 'Check server logs for more information'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Test endpoint available at http://localhost:3000/test');
    console.log('Main page available at http://localhost:3000');
    console.log('Podcast generator available at http://localhost:3000/podcast.html');
    console.log('Available voice IDs:', VOICE_IDS);
}); 