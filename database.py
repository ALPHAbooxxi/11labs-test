"""
Datenbank-Setup für den KI-Telefonbot.
SQLite mit Tabellen für Restaurants, Menü, Bestellungen.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "pizzabot.db")


def get_connection() -> sqlite3.Connection:
    """Erstellt eine DB-Connection mit Row-Factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Erstellt alle Tabellen falls nicht vorhanden."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS restaurants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone_number TEXT UNIQUE NOT NULL,
            greeting TEXT NOT NULL,
            address TEXT,
            opening_hours TEXT,
            active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            sizes TEXT,  -- JSON: {"klein": 7.50, "mittel": 9.50, "groß": 12.50}
            available INTEGER DEFAULT 1,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL,
            customer_name TEXT,
            customer_phone TEXT,
            delivery_address TEXT,
            notes TEXT,
            status TEXT DEFAULT 'new',
            total_price REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            conversation_id TEXT,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            menu_item_name TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            size TEXT,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );

        CREATE INDEX IF NOT EXISTS idx_restaurants_phone ON restaurants(phone_number);
        CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);
    """)

    conn.commit()
    conn.close()
    print("✅ Datenbank initialisiert")


# --- Repository-Funktionen ---

def normalize_phone_number(phone_number: str | None) -> str | None:
    """Normalisiert Telefonnummern für Lookup und Speicherung."""
    if not phone_number:
        return None

    normalized = phone_number.strip().replace(" ", "").replace("-", "")
    normalized = normalized.replace("(", "").replace(")", "").replace("/", "")

    if normalized.startswith("00"):
        normalized = "+" + normalized[2:]

    return normalized


def get_restaurant_by_phone(phone_number: str) -> dict | None:
    """Findet ein Restaurant anhand der Easybell-Telefonnummer."""
    conn = get_connection()
    normalized = normalize_phone_number(phone_number)

    cursor = conn.execute(
        "SELECT * FROM restaurants WHERE phone_number = ? AND active = 1",
        (normalized,)
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None


def get_restaurant_context(phone_number: str) -> dict | None:
    """Lädt Restaurant plus Menü für Tool- oder Webhook-Antworten."""
    restaurant = get_restaurant_by_phone(phone_number)
    if not restaurant:
        return None

    menu = get_menu_by_restaurant(restaurant["id"])
    restaurant["menu"] = [
        {
            **item,
            "sizes": json.loads(item["sizes"]) if item.get("sizes") else None,
        }
        for item in menu
    ]
    return restaurant


def get_menu_by_restaurant(restaurant_id: str) -> list[dict]:
    """Lädt die Speisekarte eines Restaurants."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM menu_items WHERE restaurant_id = ? AND available = 1 ORDER BY category, name",
        (restaurant_id,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def create_order(
    order_id: str,
    restaurant_id: str,
    items: list[dict],
    customer_name: str = None,
    customer_phone: str = None,
    delivery_address: str = None,
    notes: str = None,
    conversation_id: str = None,
) -> dict:
    """Erstellt eine neue Bestellung."""
    conn = get_connection()

    total_price = sum(
        item.get("price", 0) * item.get("quantity", 1)
        for item in items
    )

    conn.execute(
        """INSERT INTO orders (id, restaurant_id, customer_name, customer_phone,
           delivery_address, notes, status, total_price, created_at, conversation_id)
           VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)""",
        (
            order_id, restaurant_id, customer_name, customer_phone,
            delivery_address, notes, total_price,
            datetime.now().isoformat(), conversation_id
        )
    )

    for i, item in enumerate(items):
        item_id = f"{order_id}_item_{i}"
        conn.execute(
            """INSERT INTO order_items (id, order_id, menu_item_name, quantity, size, price)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                item_id, order_id,
                item.get("name", "Unbekannt"),
                item.get("quantity", 1),
                item.get("size"),
                item.get("price", 0)
            )
        )

    conn.commit()

    # Bestellung zurückladen
    cursor = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = dict(cursor.fetchone())

    cursor = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    order["items"] = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return order


def get_orders_by_restaurant(restaurant_id: str, status: str = None) -> list[dict]:
    """Lädt Bestellungen für ein Restaurant (für das Tablet)."""
    conn = get_connection()

    if status:
        cursor = conn.execute(
            "SELECT * FROM orders WHERE restaurant_id = ? AND status = ? ORDER BY created_at DESC",
            (restaurant_id, status)
        )
    else:
        cursor = conn.execute(
            "SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC",
            (restaurant_id,)
        )

    orders = []
    for row in cursor.fetchall():
        order = dict(row)
        items_cursor = conn.execute(
            "SELECT * FROM order_items WHERE order_id = ?", (order["id"],)
        )
        order["items"] = [dict(r) for r in items_cursor.fetchall()]
        orders.append(order)

    conn.close()
    return orders


def update_order_status(order_id: str, new_status: str) -> dict | None:
    """Aktualisiert den Status einer Bestellung."""
    valid_statuses = {"new", "confirmed", "preparing", "ready", "delivered", "cancelled"}
    if new_status not in valid_statuses:
        raise ValueError(f"Ungültiger Status: {new_status}. Erlaubt: {valid_statuses}")

    conn = get_connection()
    conn.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        (new_status, order_id)
    )
    conn.commit()

    cursor = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None


def seed_test_data():
    """Legt ein kleines Test-Setup mit zwei Pizzerien an."""
    restaurants = [
        {
            "id": "pizzeria-roma",
            "name": "Pizzeria Roma",
            "phone_number": "+493012345670",
            "greeting": "Willkommen bei Pizzeria Roma in Berlin. Was moechten Sie heute bestellen?",
            "address": "Hauptstrasse 10, 10827 Berlin",
            "opening_hours": "Mo-So 11:00-22:00",
        },
        {
            "id": "pizzeria-napoli",
            "name": "Pizzeria Napoli",
            "phone_number": "+498912345670",
            "greeting": "Buongiorno bei Pizzeria Napoli in Muenchen. Wie kann ich helfen?",
            "address": "Marienplatz 5, 80331 Muenchen",
            "opening_hours": "Di-So 12:00-23:00",
        },
    ]

    menu_items = [
        {
            "id": "roma-margherita",
            "restaurant_id": "pizzeria-roma",
            "name": "Pizza Margherita",
            "description": "Tomatensauce, Mozzarella, Basilikum",
            "price": 8.5,
            "category": "Pizza",
            "sizes": json.dumps({"klein": 7.5, "mittel": 8.5, "gross": 10.5}),
        },
        {
            "id": "roma-salami",
            "restaurant_id": "pizzeria-roma",
            "name": "Pizza Salami",
            "description": "Tomatensauce, Mozzarella, Salami",
            "price": 9.5,
            "category": "Pizza",
            "sizes": json.dumps({"klein": 8.5, "mittel": 9.5, "gross": 11.5}),
        },
        {
            "id": "napoli-margherita",
            "restaurant_id": "pizzeria-napoli",
            "name": "Pizza Margherita",
            "description": "San-Marzano-Tomaten, Fior di Latte, Basilikum",
            "price": 9.0,
            "category": "Pizza",
            "sizes": json.dumps({"mittel": 9.0, "gross": 12.0}),
        },
        {
            "id": "napoli-cola",
            "restaurant_id": "pizzeria-napoli",
            "name": "Coca-Cola 0,33l",
            "description": "Kaltgetraenk",
            "price": 2.5,
            "category": "Getraenke",
            "sizes": None,
        },
    ]

    conn = get_connection()

    for restaurant in restaurants:
        conn.execute(
            """
            INSERT OR REPLACE INTO restaurants
            (id, name, phone_number, greeting, address, opening_hours, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (
                restaurant["id"],
                restaurant["name"],
                normalize_phone_number(restaurant["phone_number"]),
                restaurant["greeting"],
                restaurant["address"],
                restaurant["opening_hours"],
            ),
        )

    for item in menu_items:
        conn.execute(
            """
            INSERT OR REPLACE INTO menu_items
            (id, restaurant_id, name, description, price, category, sizes, available)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                item["id"],
                item["restaurant_id"],
                item["name"],
                item["description"],
                item["price"],
                item["category"],
                item["sizes"],
            ),
        )

    conn.commit()
    conn.close()
    print("✅ Testdaten angelegt")


if __name__ == "__main__":
    init_db()
    seed_test_data()
