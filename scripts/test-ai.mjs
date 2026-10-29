import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

async function runDiagnosis() {
  console.log('=== AI AUTOMATIC DIAGNOSTIC TOOL ===\n');

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.argv[2];

  if (!apiKey) {
    console.error('❌ NO API KEY FOUND!');
    console.error('Please run with your API key, like this:');
    console.error('  node scripts/test-ai.mjs <your-gemini-api-key>\n');
    console.error('Or save it to .env.local as GOOGLE_GENAI_API_KEY=<key>');
    process.exit(1);
  }

  console.log(`🔑 Using API Key: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`);

  const modelsToTest = [
    'googleai/gemini-3.8-flash',
    'googleai/gemini-3.5-flash-lite',
    'googleai/gemini-1.5-flash',
  ];

  const ai = genkit({
    plugins: [googleAI({ apiKey })],
  });

  for (const modelName of modelsToTest) {
    process.stdout.write(`🧪 Testing model "${modelName}"... `);
    try {
      const response = await ai.generate({
        model: modelName,
        prompt: 'Say "hello" and nothing else.',
      });
      console.log(`✅ SUCCESS: "${response.text.trim()}"`);
    } catch (err) {
      console.log(`❌ FAILED`);
      console.log(`   Error: ${err.message}`);
      if (err.status) console.log(`   HTTP Status: ${err.status}`);
    }
  }

  console.log('\n--- Testing Project Flow: getEnvironmentalData ---');
  try {
    const { getEnvironmentalData } = await import('../src/ai/flows/get-environmental-data.ts');
    const result = await getEnvironmentalData({
      location: 'San Francisco, USA',
      currentMonth: 'October',
      apiKeys: { gemini: apiKey },
    });
    console.log('✅ Flow getEnvironmentalData succeeded:', result);
  } catch (err) {
    console.error('❌ Flow getEnvironmentalData failed:');
    console.error(err);
  }
}

runDiagnosis().catch(console.error);
