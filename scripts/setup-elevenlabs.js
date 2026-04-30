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

function getHeaders() {
  return {
    "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
    "Content-Type": "application/json"
  };
}

async function apiRequest(method, endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${method} ${endpoint} fehlgeschlagen: ${response.status} ${text}`);
  }

  return data;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function deepReplace(value, replacements) {
  if (typeof value === "string") {
    let result = value;
    for (const [key, replacement] of Object.entries(replacements)) {
      result = result.split(key).join(replacement);
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepReplace(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepReplace(item, replacements)])
    );
  }

  return value;
}

async function createWorkspaceWebhook(publicBaseUrl) {
  const webhookName = process.env.ELEVENLABS_WEBHOOK_NAME || "pizza-bot-post-call";
  const payload = {
    name: webhookName,
    url: `${publicBaseUrl}/api/post-call`
  };

  return apiRequest("POST", "/workspace/webhooks", payload);
}

async function updateConvaiSettings(publicBaseUrl) {
  const templatePath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "convai-settings.template.json"
  );
  const template = loadJson(templatePath);
  const payload = deepReplace(template, {
    "__PUBLIC_BASE_URL__": publicBaseUrl
  });

  const optionalAuthToken = process.env.PRECALL_AUTH_TOKEN;
  if (optionalAuthToken) {
    payload.conversation_initiation_client_data_webhook.request_headers.Authorization =
      `Bearer ${optionalAuthToken}`;
  }

  return apiRequest("PATCH", "/convai/settings", payload);
}

async function createServerTool(publicBaseUrl) {
  const templatePath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "tool.get-restaurant-context.json"
  );
  const template = loadJson(templatePath);
  const payload = deepReplace(template, {
    "__PUBLIC_BASE_URL__": publicBaseUrl
  });

  const optionalAuthToken = process.env.TOOL_AUTH_TOKEN;
  if (optionalAuthToken) {
    payload.tool_config.api_schema.request_headers.Authorization = `Bearer ${optionalAuthToken}`;
  }

  return apiRequest("POST", "/convai/tools", payload);
}

async function createAgent(toolId) {
  const templatePath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "agent.pizza-bot.json"
  );
  const template = loadJson(templatePath);
  const payload = deepReplace(template, {
    "__TOOL_ID__": toolId
  });

  return apiRequest("POST", "/convai/agents/create?enable_versioning=true", payload);
}

async function main() {
  const publicBaseUrl = requireEnv("PUBLIC_BASE_URL").replace(/\/$/, "");

  console.log("1. ConvAI Settings aktualisieren");
  const settings = await updateConvaiSettings(publicBaseUrl);
  console.log(JSON.stringify(settings, null, 2));

  console.log("\n2. Workspace Webhook anlegen");
  const webhook = await createWorkspaceWebhook(publicBaseUrl);
  console.log(JSON.stringify(webhook, null, 2));

  console.log("\n3. Server Tool anlegen");
  const tool = await createServerTool(publicBaseUrl);
  console.log(JSON.stringify(tool, null, 2));

  console.log("\n4. Agent anlegen");
  const agent = await createAgent(tool.id);
  console.log(JSON.stringify(agent, null, 2));

  console.log("\nZusammenfassung");
  console.log(`Pre-call URL: ${publicBaseUrl}/api/pre-call`);
  console.log(`Post-call URL: ${publicBaseUrl}/api/post-call`);
  console.log(`Tool URL: ${publicBaseUrl}/api/tool/get-restaurant-context`);
  console.log(`Tool ID: ${tool.id}`);
  console.log(`Agent ID: ${agent.agent_id || agent.id || "unbekannt"}`);
  console.log(`Webhook ID: ${webhook.id || "unbekannt"}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
