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
    .select("id,name,inbound_phone_number,greeting,address,opening_hours,delivery_enabled,pickup_enabled,minimum_order_amount,delivery_fee,delivery_area_notes,payment_methods,handoff_phone_number,special_notes,active")
    .eq("inbound_phone_number", phoneNumber)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getRestaurantById(restaurantId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,inbound_phone_number,greeting,address,opening_hours,delivery_enabled,pickup_enabled,minimum_order_amount,delivery_fee,delivery_area_notes,payment_methods,handoff_phone_number,special_notes,active")
    .eq("id", restaurantId)
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

function normalizeMenuKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function pickItemPrice(menuItem, size) {
  if (!size) {
    return Number(menuItem.price);
  }

  const sizes = menuItem.sizes || {};
  const normalizedSize = normalizeMenuKey(size);

  for (const [key, value] of Object.entries(sizes)) {
    if (normalizeMenuKey(key) === normalizedSize) {
      return Number(value);
    }
  }

  if (Object.keys(sizes).length > 0) {
    throw new Error(`Groesse fuer ${menuItem.name} nicht gefunden: ${size}`);
  }

  return Number(menuItem.price);
}

async function resolveRestaurantForOrder(input) {
  if (input.restaurant_id) {
    return getRestaurantById(input.restaurant_id);
  }

  if (input.called_number) {
    return getRestaurantContextByPhone(input.called_number);
  }

  return null;
}

async function createOrder(input) {
  const restaurant = await resolveRestaurantForOrder(input);

  if (!restaurant) {
    throw new Error("Restaurant fuer Bestellung nicht gefunden");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Bestellung enthaelt keine Positionen");
  }

  const fulfillmentType = String(input.fulfillment_type || "pickup").trim().toLowerCase();
  if (!["pickup", "delivery"].includes(fulfillmentType)) {
    throw new Error("fulfillment_type muss pickup oder delivery sein");
  }

  if (fulfillmentType === "delivery" && !String(input.delivery_address || "").trim()) {
    throw new Error("delivery_address fehlt fuer Lieferung");
  }

  if (fulfillmentType === "delivery" && !restaurant.delivery_enabled) {
    throw new Error(`Lieferung ist bei ${restaurant.name} nicht verfuegbar`);
  }

  if (fulfillmentType === "pickup" && !restaurant.pickup_enabled) {
    throw new Error(`Abholung ist bei ${restaurant.name} nicht verfuegbar`);
  }

  const menu = await getMenuByRestaurant(restaurant.id);
  const menuByName = new Map(menu.map((item) => [normalizeMenuKey(item.name), item]));

  const preparedItems = input.items.map((rawItem) => {
    const quantity = Number(rawItem.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Ungueltige Menge fuer Artikel ${rawItem.item_name || rawItem.name || "unbekannt"}`);
    }

    const itemName = String(rawItem.item_name || rawItem.name || "").trim();
    if (!itemName) {
      throw new Error("Jede Bestellposition braucht einen Artikelnamen");
    }

    const menuItem = menuByName.get(normalizeMenuKey(itemName));
    if (!menuItem) {
      throw new Error(`Artikel nicht auf der Karte gefunden: ${itemName}`);
    }

    const itemSize = rawItem.item_size || rawItem.size || null;
    const unitPrice = pickItemPrice(menuItem, itemSize);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    return {
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      item_size: itemSize,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      special_instructions: rawItem.special_instructions || rawItem.notes || null
    };
  });

  const totalAmount = Number(
    preparedItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2)
  );

  if (
    fulfillmentType === "delivery" &&
    Number(restaurant.minimum_order_amount || 0) > 0 &&
    totalAmount < Number(restaurant.minimum_order_amount)
  ) {
    throw new Error(
      `Mindestbestellwert fuer Lieferung nicht erreicht: ${restaurant.minimum_order_amount} EUR`
    );
  }

  const deliveryFee =
    fulfillmentType === "delivery" ? Number(restaurant.delivery_fee || 0) : 0;
  const grandTotal = Number((totalAmount + deliveryFee).toFixed(2));

  const supabase = getSupabaseAdmin();
  const orderRow = {
    restaurant_id: restaurant.id,
    conversation_id: input.conversation_id || null,
    customer_name: input.customer_name || null,
    customer_phone: input.customer_phone || null,
    fulfillment_type: fulfillmentType,
    delivery_address: input.delivery_address || null,
    notes: input.notes || null,
    status: input.status || "confirmed",
    total_amount: grandTotal,
    currency: input.currency || "EUR",
    source: input.source || "elevenlabs"
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderRow)
    .select(
      "id,restaurant_id,conversation_id,customer_name,customer_phone,fulfillment_type,delivery_address,notes,status,total_amount,currency,created_at"
    )
    .single();

  if (orderError) {
    throw orderError;
  }

  const itemRows = preparedItems.map((item) => ({
    order_id: order.id,
    ...item
  }));

  const { data: storedItems, error: itemsError } = await supabase
    .from("order_items")
    .insert(itemRows)
    .select(
      "id,menu_item_id,item_name,item_size,quantity,unit_price,line_total,special_instructions"
    );

  if (itemsError) {
    throw itemsError;
  }

  return {
    order,
    items: storedItems || [],
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      inbound_phone_number: restaurant.inbound_phone_number
    },
    pricing: {
      subtotal: totalAmount,
      delivery_fee: deliveryFee,
      total_amount: grandTotal
    }
  };
}

module.exports = {
  getRestaurantContextByPhone,
  insertPostCallEvent,
  createOrder
};
