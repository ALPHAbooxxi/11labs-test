const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.elevenlabs.io/v1";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} fehlt`);
  }
  return value;
}

async function apiRequest(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
      "Content-Type": "application/json"
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`GET ${endpoint} fehlgeschlagen: ${response.status} ${text}`);
  }

  return data;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const agentId = process.env.ELEVENLABS_AGENT_ID || "agent_1501kqf1zhrpez7s00w9wpa00g5t";
  const agent = await apiRequest(`/convai/agents/${agentId}`);
  const outputDir = path.join(process.cwd(), "tmp", "elevenlabs");

  writeJson(path.join(outputDir, `${agentId}.agent.json`), agent);
  writeJson(path.join(outputDir, `${agentId}.workflow.json`), agent.workflow || null);

  console.log(`Agent exportiert: tmp/elevenlabs/${agentId}.agent.json`);
  console.log(`Workflow exportiert: tmp/elevenlabs/${agentId}.workflow.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
