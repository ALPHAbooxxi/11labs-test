"""
Beispielskript, um ElevenLabs-Tool und Agent per API statt ueber das UI anzulegen.

Benutzung:
  export ELEVENLABS_API_KEY=...
  export PUBLIC_BASE_URL=https://deine-domain.tld
  python3 elevenlabs_setup.py
"""

from __future__ import annotations

import json
import os
from typing import Any

import requests

BASE_URL = "https://api.elevenlabs.io/v1/convai"


def headers() -> dict[str, str]:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY fehlt")

    return {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }


def create_server_tool(public_base_url: str) -> dict[str, Any]:
    payload = {
        "tool_config": {
            "type": "webhook",
            "name": "get_restaurant_context",
            "description": (
                "Laedt fuer eingehende Restaurantanrufe die passende Pizzeria "
                "anhand der angerufenen Nummer und liefert Begruessung, Oeffnungszeiten "
                "und Speisekarte."
            ),
            "response_timeout_secs": 10,
            "api_schema": {
                "url": f"{public_base_url}/tools/get_restaurant_context",
                "method": "POST",
                "content_type": "application/json",
                "request_body_schema": {
                    "type": "object",
                    "required": ["called_number"],
                    "properties": {
                        "called_number": {
                            "type": "string",
                            "description": (
                                "Die Easybell-Zielnummer bzw. SIP-Nummer des Restaurants "
                                "im E.164-Format."
                            ),
                        },
                        "caller_id": {
                            "type": "string",
                            "description": "Optional die Rufnummer des anrufenden Kunden.",
                        },
                    },
                },
                "request_headers": {},
            },
        }
    }

    response = requests.post(
        f"{BASE_URL}/tools",
        headers=headers(),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def create_agent(public_base_url: str, tool_id: str) -> dict[str, Any]:
    payload = {
        "name": "Pizza Telefonbot Test",
        "conversation_config": {
            "agent": {
                "prompt": {
                    "prompt": (
                        "Du bist ein zentraler Telefonassistent fuer mehrere Pizzerien. "
                        "Nutze zuerst die vorhandenen Dynamic Variables wie "
                        "{{restaurant_name}}, {{restaurant_opening_hours}} und "
                        "{{restaurant_greeting}}. Falls diese fehlen oder unvollstaendig sind, "
                        "verwende das Tool get_restaurant_context mit der angerufenen Nummer. "
                        "Begruesse den Anrufer immer im Namen des passenden Restaurants."
                    )
                },
                "first_message": "Willkommen, einen kleinen Moment bitte.",
            },
            "tools": [{"id": tool_id}],
        },
        "platform_settings": {
            "auth": {"enable_auth": False}
        },
    }

    response = requests.post(
        f"{BASE_URL}/agents/create?enable_versioning=true",
        headers=headers(),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    public_base_url = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")

    tool = create_server_tool(public_base_url)
    print("Tool erstellt:")
    print(json.dumps(tool, indent=2))

    agent = create_agent(public_base_url, tool["id"])
    print("\nAgent erstellt:")
    print(json.dumps(agent, indent=2))

    print("\nPre-Call-Webhook URL:")
    print(f"{public_base_url}/webhooks/elevenlabs/pre-call")


if __name__ == "__main__":
    main()
