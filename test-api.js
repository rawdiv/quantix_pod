const fetch = require('node-fetch');
const fs = require('fs');
require('dotenv').config();

// Use API key from environment variables with fallback
const API_KEY = process.env.ELEVENLABS_API_KEY || 'your_api_key_here';
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice

async function testVoicesAPI() {
  try {
    console.log('Testing ElevenLabs API - Voices endpoint');
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': API_KEY
      }
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Error response:', await response.text());
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    console.log('Available voices:', data.voices.map(voice => ({
      voice_id: voice.voice_id,
      name: voice.name
    })));
    
    return data;
  } catch (error) {
    console.error('Error testing voices API:', error);
    throw error;
  }
}

async function testTextToSpeechAPI() {
  try {
    console.log('\nTesting ElevenLabs API - Text-to-Speech endpoint');
    
    const text = 'This is a test of the ElevenLabs API. If you can hear this message, the API is working correctly.';
    
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
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
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
      console.error('Error response:', await response.text());
      throw new Error(`API returned status ${response.status}`);
    }

    const audioBuffer = await response.buffer();
    console.log('Audio buffer received, size:', audioBuffer.length);
    
    // Save the audio file
    fs.writeFileSync('test-output.mp3', audioBuffer);
    console.log('Audio saved to test-output.mp3');
    
    return true;
  } catch (error) {
    console.error('Error testing text-to-speech API:', error);
    throw error;
  }
}

// Run the tests
async function runTests() {
  try {
    await testVoicesAPI();
    await testTextToSpeechAPI();
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('\nTests failed:', error);
  }
}

runTests(); 