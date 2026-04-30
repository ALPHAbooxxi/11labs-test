# ElevenLabs Workflow Blueprint

## Ziel

Dieser Workflow soll fuer mehrere Restaurants mit einer gemeinsamen Telefonnummern-Infrastruktur funktionieren.
Die Filiale wird bereits im `pre-call webhook` ueber `called_number` erkannt.
Der Workflow in ElevenLabs soll danach vor allem:

- den Anrufer richtig fuehren
- Restaurantregeln einhalten
- Bestellungen strukturiert aufnehmen
- nur bestaetigte Bestellungen speichern
- bei Sonderfaellen sauber an einen Menschen uebergeben

## Harte Fallback-Regel

Diese Regel sollte im gesamten Workflow immer gelten:

- Wenn der Bot ueberfordert ist
- wenn der Kunde ausdruecklich mit dem Restaurant sprechen will
- wenn der Fall ausserhalb des Menues oder der Regeln liegt
- wenn eine Reklamation oder ein Sonderfall auftaucht
- wenn nach mehreren Nachfragen weiterhin Unsicherheit besteht

dann soll der Bot an die `Fallback-Nummer` bzw. `restaurant_handoff_phone_number` weiterleiten oder sie aktiv anbieten.

Das ist keine optionale Ausnahme, sondern eine feste Eskalationsregel.

## Voraussetzungen

Vor dem Workflow muessen diese Teile bereits funktionieren:

- `Pre-call webhook`
  - URL: `/api/pre-call`
  - liefert `dynamic_variables` fuer das passende Restaurant
- `Post-call webhook`
  - URL: `/api/post-call`
  - speichert Transcript und Eventdaten
- Tool `get_restaurant_context`
  - holt Restaurantdaten nach, falls etwas fehlt oder unklar ist
- Tool `create_order`
  - speichert eine bestaetigte Bestellung in Supabase

## Dynamic Variables aus dem Pre-Call Hook

Der Workflow sollte davon ausgehen, dass diese Werte vorhanden sind:

- `restaurant_id`
- `restaurant_name`
- `restaurant_phone_number`
- `restaurant_greeting`
- `restaurant_address`
- `restaurant_opening_hours`
- `restaurant_menu_json`
- `restaurant_delivery_enabled`
- `restaurant_pickup_enabled`
- `restaurant_minimum_order_amount`
- `restaurant_delivery_fee`
- `restaurant_delivery_area_notes`
- `restaurant_payment_methods_json`
- `restaurant_handoff_phone_number`
- `restaurant_special_notes`

## Benoetigte Tools

### 1. `get_restaurant_context`

Zweck:
- Restaurantdaten nachladen
- Menue aktualisieren
- Regeln nachladen, falls Dynamic Variables fehlen oder veraltet wirken

Wann einsetzen:
- direkt zu Beginn nur wenn noetig
- wenn Menueeintrag unklar ist
- wenn Lieferregeln oder Zahlungsarten unklar sind
- wenn der Bot nicht sicher ist, ob eine Filiale Lieferung oder Abholung anbietet

Empfohlene Inputs:
- `called_number`
- optional `caller_id`

### 2. `create_order`

Zweck:
- finale Bestellung verbindlich speichern

Wann einsetzen:
- erst ganz am Ende
- erst nach Zusammenfassung
- erst nach expliziter Bestaetigung durch den Kunden

Nie einsetzen:
- waehrend der Kunde noch ueberlegt
- wenn Adresse fehlt
- wenn Lieferart unklar ist
- wenn Menueartikel nicht sauber bestaetigt wurden
- wenn Restaurantregeln verletzt sind

Empfohlene Inputs:
- `restaurant_id`
- `conversation_id`
- `customer_name`
- `customer_phone`
- `fulfillment_type`
- `delivery_address`
- `notes`
- `items`

## Empfohlene Workflow-Struktur im ElevenLabs Editor

Der Editor zeigt diese Bausteine:

- `Subagent`
- `Say`
- `Update state`
- `Agent transfer`
- `Phone number transfer`
- `Tool`
- `End`

Fuer euren Fall ist dieser Aufbau sinnvoll.

## Grafische Darstellung

```text
[Start / Pre-call]
        |
        v
[Say: Begruessung im Namen des Restaurants]
        |
        v
[Update state: Restaurant-Kontext]
        |
        v
[Subagent: Intent Router]
   |             |               |
   |             |               |
   v             v               v
[Info]        [Order]       [Handoff / Fallback]
   |             |               |
   |             |               |
   v             v               v
[Subagent:   [Subagent:      [Subagent:
 Info]        Order Intake]   Handoff Assistant]
   |             |               |
   |             v               v
   |        [Tool optional:  [Phone number transfer
   |         get_restaurant_   oder Say mit
   |         context]          Fallback-Nummer]
   |             |               |
   |             v               v
   |        [Subagent:       [End]
   |         Fulfillment]
   |             |
   |             v
   |        [Subagent:
   |         Kundendaten]
   |             |
   |             v
   |        [Subagent:
   |         Regelpruefung]
   |             |
   |             +-----------------------------+
   |             |                             |
   |             | Regel verletzt / Bot unsicher
   |             v                             |
   |        [Subagent: Zusammenfassung]        |
   |             |                             |
   |             v                             |
   |        [Subagent: Bestaetigung]           |
   |             |                             |
   |      +------+--------+                    |
   |      |               |                    |
   |      | bestaetigt    | aendern / unklar   |
   |      v               v                    |
   | [Tool: create_order] [zurueck zu Order]   |
   |      |                                    |
   |      v                                    |
   | [Say: Erfolg]                             |
   |      |                                    |
   |      v                                    |
   +---->[End] <-------------------------------+
```

---

## Hauptworkflow

### 1. `Say` oder kleiner `Subagent`: Begruessung

Ziel:
- richtige Filiale nennen
- Gespraech sofort sauber einordnen

Beispiel:
- "Willkommen bei {{restaurant_name}}. Wie kann ich Ihnen helfen?"

Hinweise:
- wenn `restaurant_greeting` schon gut ist, direkt diese verwenden
- nicht sofort zu viel sagen

### 2. `Update state`: Restaurant-Kontext setzen

Ziel:
- internen State fuer den restlichen Verlauf vorbereiten

Empfohlene State-Werte:
- `restaurant_id`
- `restaurant_name`
- `delivery_enabled`
- `pickup_enabled`
- `minimum_order_amount`
- `delivery_fee`
- `payment_methods`
- `handoff_phone_number`
- `intent = unknown`
- `order_started = false`
- `order_confirmed = false`

### 3. `Subagent`: Intent-Erkennung

Ziel:
- erkennen, ob es um Bestellung oder Info geht

Intent-Klassen:
- `new_order`
- `opening_hours`
- `address`
- `delivery_rules`
- `payment_question`
- `human_handoff`
- `unsupported_request`

Ausgabe in State:
- `intent`

Danach verzweigen.

---

## Pfad A: Informationsanfragen

### 4A. `Subagent`: Informationsantwort

Fuer:
- `opening_hours`
- `address`
- `delivery_rules`
- `payment_question`

Regeln:
- nur Daten aus Dynamic Variables oder `get_restaurant_context`
- nichts erfinden

Wenn Daten fehlen:
- `Tool -> get_restaurant_context`
- danach Antwort wiederholen

### 5A. `End`

Wenn Frage beantwortet:
- freundlich beenden

Beispiel:
- "Gern. Wenn Sie moechten, koennen Sie jederzeit wieder anrufen. Auf Wiederhoeren."

---

## Pfad B: Neue Bestellung

### 4B. `Update state`

Setzen:
- `order_started = true`
- `cart = []`
- `fulfillment_type = unknown`

### 5B. `Subagent`: Bestellung aufnehmen

Ziel:
- Artikel sammeln
- Groesse, Menge, Sonderwuensche klaeren

Regeln:
- nur Artikel aus `restaurant_menu_json`
- bei unklarer Groesse immer nachfragen
- bei mehreren Artikeln einzeln bestaetigen
- keine Preise raten, falls unsicher

State aktualisieren:
- `cart`
- `cart_notes`

Wenn Menue unklar:
- `Tool -> get_restaurant_context`

### 6B. `Subagent`: Lieferart klaeren

Ziel:
- `pickup` oder `delivery`

Regeln:
- wenn `restaurant_delivery_enabled = false`, keine Lieferung anbieten
- wenn `restaurant_pickup_enabled = false`, keine Abholung anbieten
- wenn beides moeglich ist, aktiv fragen

State:
- `fulfillment_type`

### 7B. `Subagent`: Kundendaten erfassen

Bei `delivery` erfassen:
- `customer_name`
- `customer_phone`
- `delivery_address`

Bei `pickup` erfassen:
- `customer_name`
- optional `customer_phone`

Regeln:
- Telefonnummer und Adresse bei Unsicherheit wiederholen
- nur eine fehlende Info gleichzeitig abfragen

### 8B. `Subagent`: Restaurantregeln pruefen

Pruefen:
- Lieferung erlaubt?
- Abholung erlaubt?
- Mindestbestellwert erreicht?
- Liefergebuehr korrekt?
- Zahlungsarten passend?
- Sonderhinweise aus `restaurant_special_notes` relevant?

Wenn Mindestbestellwert nicht erreicht:
- Kunde informieren
- Wahl anbieten:
  - mehr bestellen
  - auf Abholung wechseln

Wenn Regelkonflikt:
- zur passenden frueheren Stufe zurueck

### 9B. `Subagent`: Bestellung zusammenfassen

Muss enthalten:
- Restaurantname
- alle Artikel
- Mengen
- Groessen
- Sonderwuensche
- Lieferart
- Lieferadresse falls Lieferung
- Zwischensumme
- Liefergebuehr
- Gesamtbetrag

Beispiel:
- "Ich fasse kurz zusammen: ..."

### 10B. `Subagent`: Explizite Bestaetigung holen

Akzeptierte Bestaetigungen:
- "ja"
- "das passt"
- "bitte so bestellen"
- "bestellen"

Wenn Kunde aendern will:
- zur Bestellaufnahme zurueck

Wenn bestaetigt:
- State setzen:
  - `order_confirmed = true`

### 11B. `Tool`: `create_order`

Nur wenn:
- `order_confirmed = true`
- alle Pflichtdaten vorhanden
- kein Regelkonflikt offen

Payload:
- `restaurant_id`
- `customer_name`
- `customer_phone`
- `fulfillment_type`
- `delivery_address`
- `notes`
- `items`

### 12B. `Say`

Nach erfolgreichem Tool-Call:
- Bestellung bestaetigen
- freundlich abschliessen

Beispiel:
- "Vielen Dank. Ihre Bestellung wurde aufgenommen."

### 13B. `End`

---

## Pfad C: Menschliche Uebergabe

### 4C. `Subagent`: Handoff pruefen

Fuer:
- Kunde will mit Mensch sprechen
- Bot ist ueberfordert
- Bot ist nach mehreren Rueckfragen immer noch unsicher
- Reklamation
- Sonderfall
- Catering
- komplexe Rueckfrage

Wenn `restaurant_handoff_phone_number` vorhanden:

Option 1:
- `Phone number transfer`

Option 2:
- nur nennen und Rueckruf anbieten

Wenn keine Weiterleitung technisch moeglich oder gewuenscht:
- Nummer ansagen
- Hinweis auf Rueckruf / direktes Nachfassen

### 5C. `Phone number transfer` oder `Say`

Empfehlung:
- Nur echte Weiterleitung nutzen, wenn die Zielnummer sauber besetzt werden kann
- sonst lieber Nummer nennen und sauber beenden

Wichtige Regel:
- Wenn der Kunde aktiv "mit dem Restaurant", "mit einem Mitarbeiter" oder "mit jemandem vor Ort" sprechen will, nicht diskutieren und nicht weiter automatisiert aufhalten
- direkt in diesen Pfad wechseln

### 6C. `End`

---

## Empfohlene States

Diese States solltest du im Workflow aktiv nutzen:

- `intent`
- `restaurant_id`
- `restaurant_name`
- `delivery_enabled`
- `pickup_enabled`
- `minimum_order_amount`
- `delivery_fee`
- `payment_methods`
- `handoff_phone_number`
- `cart`
- `cart_notes`
- `fulfillment_type`
- `customer_name`
- `customer_phone`
- `delivery_address`
- `order_started`
- `order_confirmed`

## Empfohlene Subagents

Statt einen einzigen riesigen Agenten zu bauen, ist diese Aufteilung sinnvoll:

### Subagent 1: `Intent Router`

Aufgabe:
- klassifiziert den Anrufgrund

### Subagent 2: `Info Assistant`

Aufgabe:
- beantwortet Oeffnungszeiten, Adresse, Lieferung, Zahlarten

### Subagent 3: `Order Intake`

Aufgabe:
- nimmt Menueartikel sauber auf

### Subagent 4: `Checkout`

Aufgabe:
- Lieferart, Kundendaten, Zusammenfassung, Bestaetigung

### Subagent 5: `Handoff Assistant`

Aufgabe:
- behandelt Sonderfaelle und Uebergaben

## Konkrete Reihenfolge im Editor

Wenn du es 1:1 bauen willst, nimm diese Reihenfolge:

1. `Say` Begruessung
2. `Update state` Restaurant-Kontext
3. `Subagent` Intent Router
4. Branch `Info`
5. Branch `Order`
6. Branch `Handoff`

### Branch `Info`

1. `Subagent` Info Assistant
2. optional `Tool` get_restaurant_context
3. `End`

### Branch `Order`

1. `Update state` order_started
2. `Subagent` Order Intake
3. optional `Tool` get_restaurant_context
4. `Subagent` Checkout fuer Lieferart
5. `Subagent` Checkout fuer Kundendaten
6. `Subagent` Checkout fuer Regelpruefung
7. `Subagent` Checkout fuer Zusammenfassung
8. `Subagent` Checkout fuer Bestaetigung
9. `Tool` create_order
10. `Say` Erfolgsbestaetigung
11. `End`

### Branch `Handoff`

1. `Subagent` Handoff Assistant
2. optional `Phone number transfer`
3. sonst `Say`
4. `End`

## Wann welcher Hook oder welches Tool kommt

### Pre-call webhook

Vor dem ersten gesprochenen Satz.

Zweck:
- richtige Filiale erkennen
- Dynamic Variables setzen

### `get_restaurant_context`

Nicht standardmaessig zu Beginn noetig, sondern nur:
- wenn Daten fehlen
- wenn Menue oder Regeln unklar sind
- wenn du Sicherheit statt Halluzination willst

### `create_order`

Ganz am Ende des Bestellpfads.

Nie vorher.

### Post-call webhook

Nach dem Gespraech.

Zweck:
- Transcript speichern
- Analyse speichern
- spaeter Fehler- und Conversion-Auswertung

## Wichtige Regeln fuer den Bot

- Immer im Namen des richtigen Restaurants sprechen
- Nie Menueartikel erfinden
- Nie Lieferzeiten erfinden
- Nie Zahlungsarten erfinden
- Nie Bestellung speichern, bevor der Kunde klar bestaetigt hat
- Bei Unsicherheit lieber eine Rueckfrage stellen
- Bei Sonderfaellen lieber an Filiale uebergeben
- Wenn der Bot ueberfordert ist, sofort Fallback-Handoff statt weiter zu improvisieren
- Wenn der Kunde mit dem Restaurant sprechen will, immer Fallback-Handoff priorisieren

## Fallback-Trigger

Diese Trigger solltest du im Workflow bewusst auf den `Handoff`-Pfad routen:

- "Ich will mit dem Restaurant sprechen"
- "Verbinden Sie mich"
- "Ich moechte mit einem Mitarbeiter reden"
- Reklamation
- Catering oder Gruppenbestellung
- Allergie- oder Sonderanfrage, die nicht sicher beantwortet werden kann
- Menueartikel oder Preis mehrfach unklar
- Adresse oder Telefonnummer nach mehreren Versuchen nicht sicher
- Bot versteht den Kunden wiederholt nicht
- allgemeine Ueberforderung des Bots

## Minimaler Start fuer den UI-Aufbau

Wenn du klein anfangen willst, baue zuerst nur:

1. `Say` Begruessung
2. `Update state`
3. `Subagent` Intent Router
4. `Subagent` Order Intake
5. `Subagent` Checkout
6. `Tool` create_order
7. `End`

Danach erweiterst du:
- Info-Branch
- Handoff-Branch
- Phone transfer
- feinere State-Checks

## Empfehlung

Fuer euren ersten echten Test wuerde ich in ElevenLabs diese Prioritaet nehmen:

1. sauberer `Order`-Pfad
2. einfacher `Info`-Pfad
3. klarer `Handoff`-Pfad
4. erst danach komplexere Transfers und Spezialfaelle

So bleibt der Bot stabil und telefoniert nicht in zu viele unklare Richtungen.
