require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const { promisify } = require('util');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

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

// Helper function to generate audio for a single segment
async function generateAudioSegment(text, voiceId) {
    console.log(`Generating audio for voice ${voiceId}, text length: ${text.length}`);
    
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
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': API_KEY
        },
        body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
        let errorMessage;
        try {
            const errorData = await response.json();
            console.error('ElevenLabs API Error:', errorData);
            errorMessage = errorData.detail || 'Failed to generate audio segment';
        } catch (e) {
            errorMessage = `API returned status ${response.status}`;
        }
        throw new Error(errorMessage);
    }
    
    return await response.buffer();
}

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

// API endpoint for generating conversational podcast
app.post('/api/generate-conversation', async (req, res) => {
    try {
        console.log('Received conversation request:', req.body);
        const { segments, voices } = req.body;
        
        if (!segments || !voices || !Array.isArray(segments) || segments.length === 0) {
            throw new Error('Missing required parameters: segments or voices');
        }
        
        console.log(`Generating conversation with ${segments.length} segments`);
        console.log('Host voice:', voices.host);
        console.log('Guest voice:', voices.guest);
        
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        
        // Generate audio for each segment
        const audioSegmentBuffers = [];
        
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            console.log(`Processing segment ${i+1}/${segments.length}, speaker: ${segment.speaker}`);
            
            // Skip empty segments
            if (!segment.text || segment.text.trim() === '') {
                console.log('Skipping empty segment');
                continue;
            }
            
            // Get the proper voice ID
            const voiceType = voices[segment.speaker]; // e.g., 'rachel', 'mike', etc.
            const voiceId = VOICE_IDS[voiceType];
            
            if (!voiceId) {
                throw new Error(`Invalid voice type: ${voiceType}`);
            }
            
            // Generate audio for this segment
            const audioBuffer = await generateAudioSegment(segment.text, voiceId);
            audioSegmentBuffers.push(audioBuffer);
            
            // Add a short pause between segments (500ms of silence)
            if (i < segments.length - 1) {
                // We'll handle this in the concatenation process
                console.log('Adding pause between segments');
                
                // In a real implementation, we'd add silence here
                // For now, we'll just leave a gap in the MP3 concatenation
            }
        }
        
        console.log(`Successfully generated ${audioSegmentBuffers.length} audio segments`);
        
        // Concatenate all audio segments
        // For simplicity, we'll just concatenate the buffers directly
        // In a production environment, you'd want to use ffmpeg or a similar tool
        // to properly concatenate MP3 files with silence padding
        const combinedBuffer = Buffer.concat(audioSegmentBuffers);
        
        // Send the combined audio
        res.set('Content-Type', 'audio/mpeg');
        res.send(combinedBuffer);
        
    } catch (error) {
        console.error('Error generating conversation:', error);
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