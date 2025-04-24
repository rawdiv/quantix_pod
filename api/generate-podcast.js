// Vercel Serverless Function for Single-Voice Podcast Generation
const fetch = require('node-fetch');

// Voice IDs for ElevenLabs
const VOICE_IDS = {
    'rachel': 'XB0fDUnXU5powFXDhCwa',  // Charlotte
    'mike': 'iP95p4xoKVk53GoZ742B',    // Chris
    'sarah': 'EXAVITQu4vr4xnSDxMaL',   // Sarah
    'david': 'onwK4e9ZLuTAKqWW03F9'    // Daniel
};

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const API_KEY = process.env.ELEVENLABS_API_KEY;
        if (!API_KEY) {
            throw new Error('ELEVENLABS_API_KEY environment variable is not set');
        }

        const { text, voice_id } = req.body;
        
        if (!text || !voice_id) {
            throw new Error('Missing required parameters: text or voice_id');
        }

        // Get the actual ElevenLabs voice ID
        const actualVoiceId = VOICE_IDS[voice_id] || voice_id;
        
        console.log('Making request to ElevenLabs API...');
        console.log('Voice ID:', actualVoiceId);
        console.log('Text length:', text.length);
        
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
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`, {
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
                errorMessage = errorData.detail || 'Failed to generate podcast';
            } catch (e) {
                errorMessage = `API returned status ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        // Get audio buffer
        const audioBuffer = await response.buffer();
        
        if (audioBuffer.length === 0) {
            throw new Error('Received empty audio response from ElevenLabs API');
        }
        
        // Send the audio
        res.setHeader('Content-Type', 'audio/mpeg');
        res.status(200).send(audioBuffer);
        
    } catch (error) {
        console.error('Error generating podcast:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
}; 