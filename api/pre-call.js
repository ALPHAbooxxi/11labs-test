const { getRestaurantContextByPhone } = require("../lib/supabase");
const { pickRestaurantPhone } = require("../lib/phone");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const payload = req.body || {};
    const phoneNumber = pickRestaurantPhone(payload);

    if (!phoneNumber) {
      res.status(400).json({ error: "missing_phone_number" });
      return;
    }

    const restaurant = await getRestaurantContextByPhone(phoneNumber);

    if (!restaurant) {
      res.status(404).json({ error: "restaurant_not_found", phone_number: phoneNumber });
      return;
    }

    res.status(200).json({
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        restaurant_phone_number: restaurant.inbound_phone_number,
        restaurant_greeting: restaurant.greeting,
        restaurant_address: restaurant.address,
        restaurant_opening_hours: restaurant.opening_hours,
        restaurant_menu_json: JSON.stringify(restaurant.menu || []),
        restaurant_delivery_enabled: String(Boolean(restaurant.delivery_enabled)),
        restaurant_pickup_enabled: String(Boolean(restaurant.pickup_enabled)),
        restaurant_minimum_order_amount: String(restaurant.minimum_order_amount ?? 0),
        restaurant_delivery_fee: String(restaurant.delivery_fee ?? 0),
        restaurant_delivery_area_notes: restaurant.delivery_area_notes || "",
        restaurant_payment_methods_json: JSON.stringify(restaurant.payment_methods || []),
        restaurant_handoff_phone_number: restaurant.handoff_phone_number || "",
        restaurant_special_notes: restaurant.special_notes || ""
      },
      user_id: restaurant.id
    });
  } catch (error) {
    res.status(500).json({
      error: "internal_error",
      message: error.message
    });
  }
};
