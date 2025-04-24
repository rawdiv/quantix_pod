// Vercel Serverless Function for Podcast Conversation Generation
const fetch = require('node-fetch');

// Voice IDs for ElevenLabs
const VOICE_IDS = {
    'rachel': 'XB0fDUnXU5powFXDhCwa',  // Charlotte
    'mike': 'iP95p4xoKVk53GoZ742B',    // Chris
    'sarah': 'EXAVITQu4vr4xnSDxMaL',   // Sarah
    'david': 'onwK4e9ZLuTAKqWW03F9'    // Daniel
};

// Helper function to generate audio for a single segment
async function generateAudioSegment(text, voiceId, apiKey) {
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
            'xi-api-key': apiKey
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

        const { segments, voices } = req.body;
        
        if (!segments || !voices || !Array.isArray(segments) || segments.length === 0) {
            throw new Error('Missing required parameters: segments or voices');
        }
        
        console.log(`Generating conversation with ${segments.length} segments`);
        
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
            const audioBuffer = await generateAudioSegment(segment.text, voiceId, API_KEY);
            audioSegmentBuffers.push(audioBuffer);
        }
        
        console.log(`Successfully generated ${audioSegmentBuffers.length} audio segments`);
        
        // Concatenate all audio segments
        const combinedBuffer = Buffer.concat(audioSegmentBuffers);
        
        // Send the combined audio
        res.setHeader('Content-Type', 'audio/mpeg');
        res.status(200).send(combinedBuffer);
        
    } catch (error) {
        console.error('Error generating conversation:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
}; 