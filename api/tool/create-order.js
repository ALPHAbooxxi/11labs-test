const { createOrder } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const payload = req.body || {};
    const result = await createOrder(payload);

    res.status(200).json({
      success: true,
      order_id: result.order.id,
      restaurant_id: result.restaurant.id,
      restaurant_name: result.restaurant.name,
      fulfillment_type: result.order.fulfillment_type,
      subtotal: result.pricing.subtotal,
      delivery_fee: result.pricing.delivery_fee,
      total_amount: result.pricing.total_amount,
      currency: result.order.currency,
      item_count: result.items.length,
      items: result.items
    });
  } catch (error) {
    res.status(400).json({
      error: "order_creation_failed",
      message: error.message
    });
  }
};
