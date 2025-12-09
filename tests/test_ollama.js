
// Uses native fetch (Node 18+)
const OLLAMA_URL = 'http://localhost:11434';

async function testOllama() {
    console.log('--- Testing Ollama API ---');
    console.log(`Fetching models from ${OLLAMA_URL}/api/tags...`);

    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.models && Array.isArray(data.models)) {
            console.log(`SUCCESS: Found ${data.models.length} models.`);
            data.models.forEach(m => console.log(`- ${m.name}`));
        } else {
            console.error('FAIL: Unexpected response structure:', data);
        }

    } catch (e) {
        console.error('FAIL: Could not fetch models from Ollama.', e);
        console.log('Ensure Ollama is running and accessible at ' + OLLAMA_URL);
    }
}

testOllama();
