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

function loadWorkflow() {
  const workflowPath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "workflow.pizza-bot.json"
  );
  return loadJson(workflowPath);
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
    settings: {
      name: webhookName,
      webhook_url: `${publicBaseUrl}/api/post-call`,
      auth_type: "hmac"
    }
  };

  return apiRequest("POST", "/workspace/webhooks", payload);
}

async function updateConvaiSettings(publicBaseUrl, postCallWebhookId) {
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

  if (postCallWebhookId) {
    payload.webhooks.post_call_webhook_id = postCallWebhookId;
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

async function createCreateOrderTool(publicBaseUrl) {
  const templatePath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "tool.create-order.json"
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

async function createAgent(toolIds) {
  const templatePath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "agent.pizza-bot.json"
  );
  const template = loadJson(templatePath);
  const payload = deepReplace(template, {
    "__TOOL_GET_RESTAURANT_CONTEXT_ID__": toolIds.getRestaurantContext,
    "__TOOL_CREATE_ORDER_ID__": toolIds.createOrder
  });
  payload.workflow = loadWorkflow();

  return apiRequest("POST", "/convai/agents/create?enable_versioning=true", payload);
}

async function updateAgent(agentId, toolIds) {
  const templatePath = path.join(
    process.cwd(),
    "config",
    "elevenlabs",
    "agent.pizza-bot.json"
  );
  const template = loadJson(templatePath);
  const payload = deepReplace(template, {
    "__TOOL_GET_RESTAURANT_CONTEXT_ID__": toolIds.getRestaurantContext,
    "__TOOL_CREATE_ORDER_ID__": toolIds.createOrder
  });
  payload.workflow = loadWorkflow();

  return apiRequest(
    "PATCH",
    `/convai/agents/${agentId}?enable_versioning_if_not_enabled=true`,
    payload
  );
}

async function getAgent(agentId) {
  return apiRequest("GET", `/convai/agents/${agentId}`);
}

async function main() {
  const publicBaseUrl = requireEnv("PUBLIC_BASE_URL").replace(/\/$/, "");

  console.log("1. Workspace Webhook anlegen");
  const webhook = await createWorkspaceWebhook(publicBaseUrl);
  console.log(JSON.stringify(webhook, null, 2));

  console.log("\n2. ConvAI Settings aktualisieren");
  const settings = await updateConvaiSettings(
    publicBaseUrl,
    webhook.webhook_id || webhook.id || null
  );
  console.log(JSON.stringify(settings, null, 2));

  console.log("\n3. Server Tool anlegen");
  const restaurantTool = await createServerTool(publicBaseUrl);
  console.log(JSON.stringify(restaurantTool, null, 2));

  console.log("\n4. Bestell-Tool anlegen");
  const orderTool = await createCreateOrderTool(publicBaseUrl);
  console.log(JSON.stringify(orderTool, null, 2));

  const toolIds = {
    getRestaurantContext: restaurantTool.id,
    createOrder: orderTool.id
  };

  const existingAgentId = process.env.ELEVENLABS_AGENT_ID;
  console.log(existingAgentId ? "\n5. Agent aktualisieren" : "\n5. Agent anlegen");
  const agent = existingAgentId
    ? await updateAgent(existingAgentId, toolIds)
    : await createAgent(toolIds);
  console.log(JSON.stringify(agent, null, 2));

  const resolvedAgentId = agent.agent_id || agent.id || existingAgentId;

  console.log("\n6. Agent verifizieren");
  const verifiedAgent = await getAgent(resolvedAgentId);
  const attachedToolIds =
    verifiedAgent?.conversation_config?.agent?.prompt?.tool_ids || [];
  console.log(
    JSON.stringify(
      {
        agent_id: verifiedAgent.agent_id,
        tool_ids: attachedToolIds,
        workflow_present: Boolean(verifiedAgent.workflow),
        workflow_name: verifiedAgent?.workflow?.workflow_name || null
      },
      null,
      2
    )
  );

  console.log("\nZusammenfassung");
  console.log(`Pre-call URL: ${publicBaseUrl}/api/pre-call`);
  console.log(`Post-call URL: ${publicBaseUrl}/api/post-call`);
  console.log(`Tool URL: ${publicBaseUrl}/api/tool/get-restaurant-context`);
  console.log(`Create-order URL: ${publicBaseUrl}/api/tool/create-order`);
  console.log(`Restaurant Tool ID: ${restaurantTool.id}`);
  console.log(`Create-order Tool ID: ${orderTool.id}`);
  console.log(`Agent ID: ${resolvedAgentId || "unbekannt"}`);
  console.log(`Webhook ID: ${webhook.webhook_id || webhook.id || "unbekannt"}`);
  console.log(`Webhook Secret: ${webhook.webhook_secret || "nicht von API zurueckgegeben"}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
