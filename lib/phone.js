function normalizePhoneNumber(value) {
  if (!value) {
    return null;
  }

  let normalized = String(value).trim();
  normalized = normalized.replace(/[\s\-()/]/g, "");

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  return normalized;
}

function pickRestaurantPhone(payload) {
  const possibleKeys = [
    "called_number",
    "to",
    "phone_number",
    "restaurant_phone_number",
    "caller_id",
    "from"
  ];

  for (const key of possibleKeys) {
    if (payload && payload[key]) {
      return normalizePhoneNumber(payload[key]);
    }
  }

  return null;
}

module.exports = {
  normalizePhoneNumber,
  pickRestaurantPhone
};
