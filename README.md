# ElevenLabs Pizza Bot Test

Kleines Test-Setup fuer:

- Vercel als oeffentliches Backend
- Supabase als zentrale DB
- ElevenLabs `pre-call webhook`
- ElevenLabs `post-call webhook`
- optionales ElevenLabs `server tool`

## Architektur

1. Easybell leitet das Festnetz an eine ElevenLabs-SIP-Nummer weiter.
2. Beim eingehenden Anruf ruft ElevenLabs euren `pre-call webhook` auf.
3. Das Backend liest `called_number` und sucht die passende Pizzeria in Supabase.
4. Das Backend liefert `conversation_initiation_client_data` mit Greeting und Dynamic Variables zurueck.
5. Nach dem Call schickt ElevenLabs einen `post_call_transcription`-Webhook.
6. Das Backend validiert die `ElevenLabs-Signature` und speichert das Event in Supabase.

## Was laut ElevenLabs-Doku relevant ist

- `conversation_initiation_client_data` ist das korrekte Antwortformat fuer Personalisierung
- `system__called_number` und `system__caller_id` sind verfuegbare Systemvariablen in Voice Calls
- `post_call_transcription` ist das relevante Post-Call-Event fuer Transcript, Analyse und Metadaten
- Post-Call-Webhooks sollten per HMAC-Signatur validiert werden

## Dateien

- [api/pre-call.js](/Users/marvinwilkens/test/api/pre-call.js:1): Pre-Call-Webhook fuer ElevenLabs
- [api/post-call.js](/Users/marvinwilkens/test/api/post-call.js:1): Post-Call-Webhook mit HMAC-Pruefung
- [api/tool/get-restaurant-context.js](/Users/marvinwilkens/test/api/tool/get-restaurant-context.js:1): Optionales Server Tool
- [lib/supabase.js](/Users/marvinwilkens/test/lib/supabase.js:1): DB-Zugriffe
- [lib/raw-body.js](/Users/marvinwilkens/test/lib/raw-body.js:1): Raw-Body-Reading fuer Webhook-Signaturen
- [supabase/schema.sql](/Users/marvinwilkens/test/supabase/schema.sql:1): Tabellen
- [supabase/seed.sql](/Users/marvinwilkens/test/supabase/seed.sql:1): Testdaten
- [config/elevenlabs/tool.get-restaurant-context.json](/Users/marvinwilkens/test/config/elevenlabs/tool.get-restaurant-context.json:1): Tool-Template
- [config/elevenlabs/agent.pizza-bot.json](/Users/marvinwilkens/test/config/elevenlabs/agent.pizza-bot.json:1): Agent-Template
- [config/elevenlabs/convai-settings.template.json](/Users/marvinwilkens/test/config/elevenlabs/convai-settings.template.json:1): ConvAI-Settings-Template
- [scripts/setup-elevenlabs.js](/Users/marvinwilkens/test/scripts/setup-elevenlabs.js:1): API-Setup fuer Tool, Agent und Webhooks

## Supabase Setup

1. Neues Supabase-Projekt anlegen.
2. Im SQL Editor zuerst `supabase/schema.sql`, dann `supabase/seed.sql` ausfuehren.
3. Aus `Project Settings > API` diese Werte holen:
   - `SUPABASE_URL`
   - `service_role` key

## Vercel Setup

1. Repo oder Ordner bei Vercel deployen.
2. Diese Environment Variables setzen:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ELEVENLABS_WEBHOOK_SECRET`
   - `ELEVENLABS_API_KEY`
   - `PUBLIC_BASE_URL`
3. Deploy ausloesen.

Danach habt ihr diese Endpunkte:

- `https://YOUR-VERCEL-APP.vercel.app/api/health`
- `https://YOUR-VERCEL-APP.vercel.app/api/pre-call`
- `https://YOUR-VERCEL-APP.vercel.app/api/post-call`
- `https://YOUR-VERCEL-APP.vercel.app/api/tool/get-restaurant-context`

## ElevenLabs Konfiguration

### Pre-Call Webhook

In ElevenLabs tragt ihr als Pre-Call-Webhook ein:

```text
https://YOUR-VERCEL-APP.vercel.app/api/pre-call
```

Minimaler Testrequest laut Doku-Logik:

```json
{
  "caller_id": "+491701234567",
  "agent_id": "agent_test",
  "called_number": "+493012345670",
  "call_sid": "call_test_123"
}
```

Antwort eures Backends:

```json
{
  "type": "conversation_initiation_client_data",
  "dynamic_variables": {
    "restaurant_id": "11111111-1111-1111-1111-111111111111",
    "restaurant_name": "Pizzeria Roma",
    "restaurant_phone_number": "+493012345670",
    "restaurant_greeting": "Willkommen bei Pizzeria Roma in Berlin. Was moechten Sie heute bestellen?",
    "restaurant_address": "Hauptstrasse 10, 10827 Berlin",
    "restaurant_opening_hours": "Mo-So 11:00-22:00",
    "restaurant_menu_json": "[...]"
  },
  "conversation_config_override": {
    "agent": {
      "first_message": "Willkommen bei Pizzeria Roma in Berlin. Was moechten Sie heute bestellen?"
    }
  },
  "user_id": "11111111-1111-1111-1111-111111111111"
}
```

### Post-Call Webhook

In ElevenLabs Webhooks richtet ihr fuer `post_call_transcription` ein:

```text
https://YOUR-VERCEL-APP.vercel.app/api/post-call
```

Dabei erzeugt ElevenLabs einen Shared Secret. Genau dieser Wert kommt in:

```text
ELEVENLABS_WEBHOOK_SECRET
```

Das Backend erwartet das Header-Format aus der Doku:

```text
ElevenLabs-Signature: t=timestamp,v0=hash
```

und validiert die HMAC ueber den unveraenderten Raw Request Body:

```text
timestamp.raw_request_body
```

### Optionales Server Tool

Wenn der Agent waehrend des Gespraechs noch einmal Restaurantdaten holen soll, legt ihr ein Server Tool an:

- Name: `get_restaurant_context`
- URL: `https://YOUR-VERCEL-APP.vercel.app/api/tool/get-restaurant-context`
- Method: `POST`
- Content Type: `application/json`

Request schema:

```json
{
  "type": "object",
  "required": ["called_number"],
  "properties": {
    "called_number": {
      "type": "string",
      "description": "Die angerufene Restaurantnummer im E.164-Format."
    },
    "caller_id": {
      "type": "string",
      "description": "Optional die Rufnummer des Anrufers."
    }
  }
}
```

## ElevenLabs per Code konfigurieren

Ich habe euch dafuer ein Setup-Script gebaut. Es nutzt die offiziellen API-Endpunkte fuer:

- `PATCH /v1/convai/settings`
- `POST /v1/workspace/webhooks`
- `POST /v1/convai/tools`
- `POST /v1/convai/agents/create?enable_versioning=true`

Vorbereitung:

```bash
cp .env.example .env
```

Dann die benoetigten Werte setzen:

```bash
export ELEVENLABS_API_KEY=...
export PUBLIC_BASE_URL=https://YOUR-VERCEL-APP.vercel.app
export ELEVENLABS_WEBHOOK_SECRET=...
```

Optional:

```bash
export ELEVENLABS_WEBHOOK_NAME=pizza-bot-post-call
export PRECALL_AUTH_TOKEN=shared-secret-for-pre-call
export TOOL_AUTH_TOKEN=shared-secret-for-tool
```

Setup ausfuehren:

```bash
npm run setup:elevenlabs
```

Das Script:

1. setzt den `pre-call webhook` in den ConvAI Settings
2. legt einen Workspace Webhook fuer den Post-Call-Endpunkt an
3. erstellt das Server Tool `get_restaurant_context`
4. erstellt einen Test-Agenten mit dem Tool

Hinweis:

- Wenn ihr das Script mehrfach ausfuehrt, koennen in ElevenLabs mehrere Tools/Webhooks/Agents entstehen.
- Fuer einen ersten Test ist das okay. Fuer spaeter wuerde ich als naechsten Schritt ein `upsert`-faehiges Admin-Script bauen.

## Lokaler Schnelltest

Abhaengigkeiten installieren:

```bash
npm install
```

Syntaxcheck:

```bash
npm run check
```

Pre-Call-Beispiel lokal gegen die Vercel-Funktion-Logik:

```bash
curl -X POST http://localhost:3000/api/pre-call \
  -H "Content-Type: application/json" \
  -d '{
    "called_number": "+493012345670",
    "caller_id": "+491701234567",
    "agent_id": "agent_test",
    "call_sid": "call_test_123"
  }'
```

## Wichtig fuer euren Use Case

Nutzt fuer die Filial-Zuordnung primaer `called_number`, nicht `caller_id`.
Das passt auch zur ElevenLabs-Doku fuer Voice-Systemvariablen. `caller_id` ist die Nummer des Kunden, `called_number` die angerufene Zielnummer.

## Quellen

- ElevenLabs Personalization: https://elevenlabs.io/docs/agents-platform/customization/personalization
- ElevenLabs Dynamic Variables: https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables
- ElevenLabs Server Tools: https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools
- ElevenLabs Post-Call Webhooks: https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks
