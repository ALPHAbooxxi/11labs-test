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
        restaurant_menu_json: JSON.stringify(restaurant.menu || [])
      },
      conversation_config_override: {
        agent: {
          first_message: restaurant.greeting
        }
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
