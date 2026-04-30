const { createClient } = require("@supabase/supabase-js");

let cachedClient = null;

function getSupabaseAdmin() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt");
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cachedClient;
}

async function getRestaurantByPhone(phoneNumber) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,inbound_phone_number,greeting,address,opening_hours,active")
    .eq("inbound_phone_number", phoneNumber)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getMenuByRestaurant(restaurantId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id,name,description,price,category,sizes,available")
    .eq("restaurant_id", restaurantId)
    .eq("available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function getRestaurantContextByPhone(phoneNumber) {
  const restaurant = await getRestaurantByPhone(phoneNumber);
  if (!restaurant) {
    return null;
  }

  const menu = await getMenuByRestaurant(restaurant.id);
  return {
    ...restaurant,
    menu
  };
}

async function insertPostCallEvent(event) {
  const supabase = getSupabaseAdmin();
  const payload = event.data || {};
  const initiationData = payload.conversation_initiation_client_data || {};
  const dynamicVariables = initiationData.dynamic_variables || {};
  const metadata = payload.metadata || {};
  const analysis = payload.analysis || {};

  const row = {
    event_type: event.type || "unknown",
    event_timestamp: event.event_timestamp || null,
    conversation_id: payload.conversation_id || null,
    agent_id: payload.agent_id || null,
    call_status: payload.status || null,
    restaurant_id: dynamicVariables.restaurant_id || null,
    called_number: dynamicVariables.restaurant_phone_number || null,
    caller_id: metadata.caller_id || null,
    summary: analysis.transcript_summary || analysis.summary || null,
    raw_payload: event
  };

  const { data, error } = await supabase
    .from("call_events")
    .insert(row)
    .select("id,event_type,conversation_id,restaurant_id,created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  getRestaurantContextByPhone,
  insertPostCallEvent
};
