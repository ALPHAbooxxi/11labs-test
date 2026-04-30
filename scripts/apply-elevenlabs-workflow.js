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

function getToolIds(agent) {
  const prompt = agent?.conversation_config?.agent?.prompt || {};
  const toolIds = prompt.tool_ids || [];
  const tools = prompt.tools || [];
  const byName = {};

  tools.forEach((tool, index) => {
    if (tool?.name && toolIds[index]) {
      byName[tool.name] = toolIds[index];
    }
  });

  if (!byName.get_restaurant_context || !byName.create_order) {
    throw new Error("Tool-IDs fuer get_restaurant_context oder create_order fehlen am Agenten");
  }

  return {
    getRestaurantContext: byName.get_restaurant_context,
    createOrder: byName.create_order
  };
}

function loadWorkflow(toolIds) {
  const workflowPath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "workflow.pizza-bot.json"
  );
  const workflow = loadJson(workflowPath);
  return deepReplace(workflow, {
    "__TOOL_GET_RESTAURANT_CONTEXT_ID__": toolIds.getRestaurantContext,
    "__TOOL_CREATE_ORDER_ID__": toolIds.createOrder
  });
}

async function main() {
  const agentId = process.env.ELEVENLABS_AGENT_ID || "agent_1501kqf1zhrpez7s00w9wpa00g5t";
  const agent = await apiRequest("GET", `/convai/agents/${agentId}`);
  const toolIds = getToolIds(agent);
  const workflow = loadWorkflow(toolIds);

  const updated = await apiRequest(
    "PATCH",
    `/convai/agents/${agentId}?enable_versioning_if_not_enabled=true`,
    { workflow }
  );

  const verified = await apiRequest("GET", `/convai/agents/${agentId}`);
  const nodeCount = Object.keys(verified.workflow?.nodes || {}).length;
  const edgeCount = Object.keys(verified.workflow?.edges || {}).length;

  console.log(`Agent aktualisiert: ${updated.agent_id || agentId}`);
  console.log(`Workflow Nodes: ${nodeCount}`);
  console.log(`Workflow Edges: ${edgeCount}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
