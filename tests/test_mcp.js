
// Uses native fetch (Node 18+)
const BASE_URL = 'http://localhost:3001';

async function testMcp() {
    console.log('--- Starting MCP End-to-End Test ---');

    // 1. List Servers
    console.log('\n1. Testing /mcp/servers...');
    try {
        const serversRes = await fetch(`${BASE_URL}/mcp/servers`);
        const servers = await serversRes.json();
        console.log('Active Servers:', servers);

        if (!servers.includes('memory')) {
            console.error('FAIL: "memory" server not found.');
            // return; // Continue anyway to see other results
        }
    } catch (e) {
        console.error('FAIL: Could not fetch servers.', e);
        return;
    }

    // 2. List Tools
    console.log('\n2. Testing /mcp/tools...');
    let tools = [];
    try {
        const toolsRes = await fetch(`${BASE_URL}/mcp/tools`);
        tools = await toolsRes.json();
        console.log(`Found ${tools.length} tools.`);
    } catch (e) {
        console.error('FAIL: Could not fetch tools.', e);
        return;
    }

    // 3. Call a Tool (create_graph_memory from memory server)
    console.log('\n3. Testing Tool Execution...');

    // Find a suitable tool
    const memoryTool = tools.find(t => t.name === 'create_graph_memory' || t.name === 'create_entities');

    if (!memoryTool) {
        console.log("Could not find 'create_graph_memory' or 'create_entities'. Listing first 5 tools:");
        tools.slice(0, 5).forEach(t => console.log(`- ${t.name} (${t.server})`));
        return;
    }

    console.log(`Attempting to call ${memoryTool.name} on server ${memoryTool.server}...`);

    try {
        const callRes = await fetch(`${BASE_URL}/mcp/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                server: memoryTool.server,
                name: memoryTool.name,
                arguments: {
                    // Adjust arguments based on the tool. For memory, it might be 'entities'
                    entities: [{ name: "TestEntity", type: "TestType", observations: ["Test observation"] }]
                }
            })
        });

        const result = await callRes.json();
        console.log('Tool Execution Result:', JSON.stringify(result, null, 2));

        if (result.error) {
            console.error("Tool execution returned an error.");
        } else {
            console.log("SUCCESS: Tool executed successfully.");
        }

    } catch (e) {
        console.error('FAIL: Tool execution failed.', e);
    }
}

testMcp();
