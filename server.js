
import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const MCP_CONFIG_PATH = path.join(__dirname, 'mcp_config.json');

// Store active MCP clients
const mcpClients = {};

// Load MCP Config
const loadMcpConfig = () => {
  try {
    const data = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load mcp_config.json", e);
    return { mcpServers: {} };
  }
};

// Initialize MCP Clients
const initMcpClients = async () => {
  const config = loadMcpConfig();
  const logStream = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });
  const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    logStream.write(entry);
  };

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      log(`[MCP] Connecting to ${name}...`);

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: { ...process.env, ...(serverConfig.env || {}) }
      });

      const client = new Client({
        name: "LexiBackend",
        version: "1.0.0",
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      mcpClients[name] = client;
      log(`[MCP] Connected to ${name}`);
    } catch (e) {
      log(`[MCP] Failed to connect to ${name}: ${e.message}`);
    }
  }
};

// API: List all available tools
app.get('/mcp/tools', async (req, res) => {
  console.log(`[API] GET /mcp/tools called. Active clients: ${Object.keys(mcpClients).join(', ')}`);
  const allTools = [];

  for (const [serverName, client] of Object.entries(mcpClients)) {
    try {
      const result = await client.listTools();
      const tools = result.tools.map(tool => ({
        ...tool,
        server: serverName, // Tag tool with server name for routing
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        },
        type: 'function'
      }));
      allTools.push(...tools);
    } catch (e) {
      console.error(`[MCP] Failed to list tools for ${serverName}`, e);
    }
  }

  res.json(allTools);
});

// API: List active MCP servers
app.get('/mcp/servers', (req, res) => {
  const servers = Object.keys(mcpClients);
  console.log(`[API] GET /mcp/servers called. Returning: ${JSON.stringify(servers)}`);
  res.json(servers);
});

// API: Call a tool
app.post('/mcp/call', async (req, res) => {
  const { server, name, arguments: args } = req.body;

  if (!mcpClients[server]) {
    return res.status(404).json({ error: `MCP Server '${server}' not found` });
  }

  try {
    const result = await mcpClients[server].callTool({
      name: name,
      arguments: args
    });
    res.json(result);
  } catch (e) {
    console.error(`[MCP] Tool execution failed: ${name}`, e);
    res.status(500).json({ error: e.message });
  }
});

// API: Update .env configuration
app.post('/api/config/update', (req, res) => {
  const newConfig = req.body;
  const envPath = path.join(__dirname, '.env');

  try {
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const lines = envContent.split(/\r?\n/);
    const envMap = new Map();

    // 1. Parse existing file into a Map (deduplicates keys automatically)
    lines.forEach(line => {
      const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        const value = match[2] || '';
        envMap.set(key, value);
      }
    });

    // 2. Map config keys to ENV keys
    const configMap = {
      general: 'VITE_OLLAMA_MODEL_GENERAL',
      vision: 'VITE_OLLAMA_MODEL_VISION',
      creativity: 'VITE_OLLAMA_MODEL_CREATIVITY',
      adult: 'VITE_OLLAMA_MODEL_ADULT',
      uncensored: 'VITE_OLLAMA_MODEL_UNCENSORED',
      ollamaUrl: 'VITE_OLLAMA_URL',
      ttsBackend: 'VITE_TTS_BACKEND',
      kokoroUrl: 'VITE_KOKORO_URL'
    };

    // 3. Update Map with new values
    Object.entries(configMap).forEach(([configKey, envKey]) => {
      if (newConfig[configKey] !== undefined) {
        envMap.set(envKey, newConfig[configKey]);
      }
    });

    // 4. Generate new file content
    const newLines = [];
    envMap.forEach((value, key) => {
      newLines.push(`${key}=${value}`);
    });

    // 5. Write completely fresh content
    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log("[CONFIG] Regenerated .env file");
    res.json({ success: true });
  } catch (e) {
    console.error("[CONFIG] Failed to update .env", e);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

// API: Get .env configuration
app.get('/api/config', (req, res) => {
  const envPath = path.join(__dirname, '.env');
  try {
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const lines = envContent.split(/\r?\n/);
    const config = {};

    // Map ENV keys to config keys
    const envMap = {
      'VITE_OLLAMA_MODEL_GENERAL': 'general',
      'VITE_OLLAMA_MODEL_VISION': 'vision',
      'VITE_OLLAMA_MODEL_CREATIVITY': 'creativity',
      'VITE_OLLAMA_MODEL_ADULT': 'adult',
      'VITE_OLLAMA_MODEL_UNCENSORED': 'uncensored',
      'VITE_OLLAMA_URL': 'ollamaUrl',
      'VITE_TTS_BACKEND': 'ttsBackend',
      'VITE_KOKORO_URL': 'kokoroUrl'
    };

    lines.forEach(line => {
      const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        const value = match[2] || '';
        if (envMap[key]) {
          config[envMap[key]] = value;
        }
      }
    });

    res.json(config);
  } catch (e) {
    console.error("[CONFIG] Failed to read .env", e);
    res.status(500).json({ error: "Failed to read configuration" });
  }
});

// Start Server
app.listen(PORT, async () => {
  console.log(`Lexi Backend running on http://localhost:${PORT}`);
  await initMcpClients();
});
