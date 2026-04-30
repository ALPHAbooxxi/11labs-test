"""
Minimales FastAPI-Backend fuer einen zentralen Pizza-Telefonbot mit ElevenLabs.

Testfluss:
1. Easybell leitet einen Anruf an eine ElevenLabs-SIP-Nummer weiter.
2. ElevenLabs ruft den Pre-Call-Webhook auf.
3. Das Backend findet die Pizzeria ueber die angerufene Nummer.
4. Das Backend gibt Greeting + Dynamic Variables fuer den Agenten zurueck.
5. Optional kann der Agent spaeter per Server Tool denselben Restaurant-Kontext holen.
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from database import (
    get_orders_by_restaurant,
    get_restaurant_context,
    init_db,
    normalize_phone_number,
    seed_test_data,
)

app = FastAPI(title="Pizza Bot Test Backend", version="0.1.0")


def pick_restaurant_phone(payload: dict[str, Any]) -> str | None:
    """
    Bevorzugt die angerufene Nummer fuer Mandanten-Zuordnung.
    Fallback auf caller_id, weil das fuer lokale Tests einfacher ist.
    """
    possible_keys = (
        "called_number",
        "to",
        "phone_number",
        "restaurant_phone_number",
        "caller_id",
        "from",
    )
    for key in possible_keys:
        value = payload.get(key)
        if value:
            return normalize_phone_number(str(value))
    return None


def build_restaurant_response(payload: dict[str, Any]) -> dict[str, Any]:
    phone_number = pick_restaurant_phone(payload)
    if not phone_number:
        raise HTTPException(status_code=400, detail="Keine Telefonnummer im Request gefunden")

    restaurant = get_restaurant_context(phone_number)
    if not restaurant:
        raise HTTPException(
            status_code=404,
            detail=f"Kein aktives Restaurant fuer Nummer {phone_number} gefunden",
        )

    dynamic_variables = {
        "restaurant_id": restaurant["id"],
        "restaurant_name": restaurant["name"],
        "restaurant_phone_number": restaurant["phone_number"],
        "restaurant_greeting": restaurant["greeting"],
        "restaurant_address": restaurant["address"],
        "restaurant_opening_hours": restaurant["opening_hours"],
        "restaurant_menu_json": json.dumps(restaurant["menu"], ensure_ascii=True),
    }

    return {
        "restaurant": restaurant,
        "dynamic_variables": dynamic_variables,
    }


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    seed_test_data()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/webhooks/elevenlabs/pre-call")
async def elevenlabs_pre_call(request: Request) -> JSONResponse:
    """
    Minimaler Pre-Call-Webhook fuer Personalisierung vor dem ersten Bot-Satz.

    Erwartet fuer den Test JSON wie:
    {
      "caller_id": "+493012345670",
      "called_number": "+493012345670",
      "agent_id": "agent_123",
      "call_id": "call_123"
    }
    """
    payload = await request.json()
    context = build_restaurant_response(payload)
    restaurant = context["restaurant"]

    response = {
        "type": "conversation_initiation_client_data",
        "dynamic_variables": context["dynamic_variables"],
        "conversation_config_override": {
            "agent": {
                "first_message": restaurant["greeting"],
            }
        },
    }
    return JSONResponse(response)


@app.post("/tools/get_restaurant_context")
async def get_restaurant_context_tool(request: Request) -> JSONResponse:
    """
    Server Tool fuer ElevenLabs.
    Der Agent kann dieses Tool nutzen, um Begruessung, Oeffnungszeiten und Menu
    fuer die aktuell angerufene Filiale zu laden.
    """
    payload = await request.json()
    context = build_restaurant_response(payload)
    restaurant = context["restaurant"]

    return JSONResponse(
        {
            "success": True,
            "restaurant_id": restaurant["id"],
            "restaurant_name": restaurant["name"],
            "greeting": restaurant["greeting"],
            "address": restaurant["address"],
            "opening_hours": restaurant["opening_hours"],
            "menu": restaurant["menu"],
        }
    )


@app.get("/restaurants/{restaurant_id}/orders")
def list_restaurant_orders(restaurant_id: str, status: str | None = None) -> dict[str, Any]:
    """
    Simuliert das Tablet im Restaurant, das Bestellungen aus der zentralen DB zieht.
    """
    return {
        "restaurant_id": restaurant_id,
        "orders": get_orders_by_restaurant(restaurant_id, status=status),
    }


@app.post("/webhooks/elevenlabs/post-call")
async def elevenlabs_post_call(request: Request) -> JSONResponse:
    """
    Minimaler Platzhalter fuer spaetere Bestellpersistenz.
    Im echten Setup validiert ihr hier die ElevenLabs-Signatur und extrahiert
    conversation_id, Transcript und Analyse.
    """
    payload = await request.json()
    event_type = payload.get("type", "unknown")
    conversation_id = payload.get("data", {}).get("conversation_id")

    return JSONResponse(
        {
            "received": True,
            "event_type": event_type,
            "conversation_id": conversation_id,
        }
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
