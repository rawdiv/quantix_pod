require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Test route
app.get('/test', (req, res) => {
    res.send('Server is running!');
});

// API endpoint for generating podcast
app.post('/api/generate-podcast', async (req, res) => {
    try {
        const { text, voice_id } = req.body;
        
        if (!text || !voice_id) {
            throw new Error('Missing required parameters');
        }

        console.log('Making request to ElevenLabs API...');
        console.log('Voice ID:', voice_id);
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                voice_id: voice_id,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                    style: 0.0,
                    use_speaker_boost: true
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(errorData.detail || 'Failed to generate podcast');
        }

        const audioBuffer = await response.buffer();
        res.set('Content-Type', 'audio/mpeg');
        res.send(audioBuffer);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Test endpoint available at http://localhost:3000/test');
}); 