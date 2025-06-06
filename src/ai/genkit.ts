
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const googleApiKey = process.env.GOOGLE_API_KEY;

if (!googleApiKey || googleApiKey === 'YOUR_GOOGLE_GENERATIVE_AI_API_KEY') {
  let errorMessage = 'CRITICAL GENKIT CONFIGURATION ERROR: GOOGLE_API_KEY is not set or is using a placeholder value in your .env.local file. ';
  if (!googleApiKey) {
    errorMessage += 'Please add GOOGLE_API_KEY to your .env.local file and restart the server. ';
  } else {
    errorMessage += 'Please replace YOUR_GOOGLE_GENERATIVE_AI_API_KEY with your actual key in .env.local and restart the server. ';
  }
  errorMessage += 'Genkit AI features will not work without it. You can obtain a key from Google AI Studio.';
  throw new Error(errorMessage);
}

export const ai = genkit({
  plugins: [googleAI({apiKey: googleApiKey})],
  model: 'googleai/gemini-2.0-flash',
});

console.log("Genkit initialized successfully for AI features.");
