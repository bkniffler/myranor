Das ist ein fantastisches Projekt. Das `docs/reference/Aufbausystem.md` ist komplex, tiefgreifend und voller Abhängigkeiten – genau die Art von System, die am Spieltisch oft den Fluss bremst ("Warte, ich muss kurz ausrechnen, wie viel Rohmaterial ich für die Werkstatt brauche..."), aber asynchron zwischen den Sitzungen glänzen kann.

Ein **Protodemestikon-Bot** (nennen wir ihn "Kassian" oder einfach "Den Verwalter") ist die perfekte Lösung. Er nimmt den Spielern die Buchhaltung ab und verpackt sie in In-Game-Roleplay.

Hier ist ein Konzept, wie du das als Programmierer mit **React Native** und einem **Hybrid-Ansatz (LLM + deterministische Logik)** umsetzen kannst.

---

### 1. Das Konzept: Der hybride Protodemestikon

Verlasse dich für die Regeln **nicht** allein auf das LLM (wie GPT-4). Bei so viel Mathe (4:1 Umrechnung, Modifikatoren, DC-Würfe) halluzinieren LLMs gerne.

**Die Architektur sollte so aussehen:**

1.  **Rule Engine (TypeScript):** Der "harte" Kern. Hier sind die Kosten, Erträge und Zustände (Gold, AK, Gebäude) gespeichert. Diese Engine führt die Berechnungen durch.
2.  **LLM Layer (Persona):** Die Schnittstelle. Das LLM erhält den aktuellen Spielstand als JSON-Kontext und "spielt" den Verwalter. Es übersetzt User-Wünsche ("Bau mir ne Sägemühle") in Funktionsaufrufe für die Rule Engine.
3.  **Frontend (React Native):** Ein Chat-Interface + ein Dashboard (für den schnellen Überblick über Ressourcen).

---

### 2. Der Ablauf einer Runde (User Journey)

So könnte eine Interaktion in deiner App ablaufen:

**Phase A: Rundenbeginn & Ereignisse (Push Notification)**
*   **App:** Der Server würfelt die Markttabelle und Ereignisse aus.
*   **Kassian (Bot):** *"Mein Herr, ein Bote aus Denera traf ein. Baumaterialien sind diese Woche 'sehr gefragt' (+1d6 Gold!). Allerdings hören wir Gerüchte über Räuberbanden im Norden. Eure Befehle?"*
*   **UI:** Zeigt aktuelle Marktpreise und das Ereignis an.

**Phase B: Unterhalt & Planung**
*   **Spieler:** "Wie steht es um unsere Kasse?"
*   **Kassian:** *"Wir haben 45 Aureal und 12 Arbeitskräfte. Der Unterhalt für die Mittlere Domäne und die Söldner beträgt 7 Aureal. Sollen wir zahlen oder den Sold schuldig bleiben (Vorsicht: Loyalitätsverlust)?"*
*   **Spieler:** "Zahl alles. Und sag mir, was eine Sägemühle kostet."

**Phase C: Aktionen (Die 2 Aktionen + Bonus)**
*   **Kassian:** *"Eine Sägemühle benötigt 8 Gold und eine Mittlere Werkstatt als Voraussetzung. Ihr habt noch 2 Aktionen diese Runde. Wollt ihr den Bau in Auftrag geben oder lieber Einfluss am Hof gewinnen, solange das Fest noch läuft?"*
*   **Spieler:** "Bau die Mühle (Sonderaktion Einrichtungsbau) und schick meine Händler los, um das Holz zu verkaufen (Aktion: Geldgewinn)."
*   **Engine:** Führt Würfe aus (z.B. DC 14 für Verkauf).
*   **Kassian:** *"Es ist vollbracht. Der Bau hat begonnen. Eure Händler waren erfolgreich (Wurf: 16, Gut geschafft!). Wir haben 20 Gold eingenommen."*

---

### 3. Technische Umsetzung (Vibe Coding / Tech Stack)

Da du Programmierer bist, hier der konkrete Vorschlag für den Stack:

**Backend / Logic (Node.js oder Python):**
Du brauchst eine Klasse `GameState`.
*   `Resources`: { Gold, Einfluss, AK, RM, SM, Kampfkraft }
*   `Buildings`: Array von Objekten.
*   `Modifiers`: (z.B. "Akribisch: +1 Gold Unterhalt").

**LLM Integration (OpenAI API / Claude API):**
Nutze **Function Calling (Tools)**. Das ist entscheidend.
Definiere Tools wie:
*   `build_facility(type: string, location: string)`
*   `check_resources()`
*   `perform_action(action_type: "money" | "influence" | "material", investment_amount: number)`
*   `get_market_prices()`

**Prompt Engineering (System Prompt):**
> "Du bist der Protodemestikon, ein loyaler, leicht pedantischer Verwalter einer Adelsfamilie in einem römisch-byzantinisch angehauchten Fantasy-Reich.
> Deine Aufgabe: Berate den Spieler basierend auf den Regeln. Führe keine Aktionen aus, ohne sie vorher durch die Tools zu bestätigen.
> Stil: Höflich, unterwürfig, aber warnend bei Ressourcenmangel. Nutze Begriffe wie 'Aureal', 'None', 'Oktral'."

**React Native App:**
*   **Chat View:** (z.B. `react-native-gifted-chat`).
*   **Dashboard:** Ein Swipe-View, der den aktuellen JSON-State der Rule Engine visuell darstellt (Balkendiagramme für Ressourcen, Liste der Gebäude). Nichts ist nerviger, als den Bot ständig nach dem Kontostand zu fragen.

---

### 4. Simulation & Playtesting per AI

Bevor du die App den Spielern gibst, lass das System gegen sich selbst spielen, um Balance-Probleme zu finden (z.B. "Ist Geldgewinn viel stärker als Materialgewinn?").

**Simulations-Skript:**
Schreibe ein Skript, das 4 Instanzen der Rule Engine erstellt.
Setze 4 "KI-Agenten" (einfache LLM-Prompts mit verschiedenen Zielen) darauf an:
1.  **Der Kriegsheer:** Investiert alles in Truppen und Kampfkraft.
2.  **Der Händler:** Maximiert Gold und Handelsunternehmen.
3.  **Der Höfling:** Maximiert Einfluss und Ämter.
4.  **Der Baumeister:** Baut die Domäne maximal aus.

**Loop (für 20 Runden):**
1.  Generiere Zufalls-Events/Marktpreise.
2.  Lass jeden Agenten basierend auf seinem Ziel 2 Aktionen wählen (LLM entscheidet: "Ich brauche mehr Gold für Truppen -> Aktion Geldgewinn").
3.  Führe die Aktionen in der Rule Engine aus.
4.  Logge den Ressourcenstand.

**Auswertung:**
Am Ende hast du CSV-Daten. Wenn der "Kriegsheer" nach Runde 5 pleite ist, weil der Unterhalt der Söldner das Startkapital frisst, weißt du, dass die Unterhaltskosten im Markdown evtl. zu hoch sind oder die Startressourcen zu niedrig.

---

### 5. Beispiel für die Rule Engine Logik (Pseudo-Code)

Hier ein kleiner Ausschnitt, wie du die komplexe Logik kapseln solltest:

```typescript
type PlayerState = {
  gold: number;
  ak: number;
  buildings: Building[];
  actionsUsed: number;
  // ...
};

const RULES = {
  market: {
    // Implementierung der Würfeltabellen aus dem MD
  },
  actions: {
    build: (state, buildingType) => {
      const cost = getCost(buildingType);
      if (state.gold < cost.gold) throw new Error("Nicht genug Aureal, mein Herr.");
      
      // Check dependencies
      if (buildingType === "Sägemühle" && !hasBuilding(state, "Mittlere Werkstatt")) {
        throw new Error("Wir benötigen erst eine Mittlere Werkstatt.");
      }

      state.gold -= cost.gold;
      state.buildings.push(createBuilding(buildingType));
      return "Bau begonnen.";
    },
    convertResources: (state) => {
      // Automatische Umwandlung am Rundenende
      // 1. Werkstätten nutzen
      // 2. Rest RM zu Gold (4:1)
      // 3. SM zu Gold (1:2)
      // ... hier muss die Logik für Lagerkapazität rein!
    }
  }
};
```

### Zusammenfassung für dich als Programmierer

1.  **Bau die "Engine" zuerst:** Ein Node-Script, das `GameState` nimmt, eine `Action` anwendet und den neuen `GameState` zurückgibt. Implementiere die Markttabellen und Event-Tabellen.
2.  **Simuliere:** Lass KIs gegen diese Engine spielen, um Bugs in den Regeln (Markdown) zu finden.
3.  **Wrap it:** Packe die Engine in eine API (Serverless Function oder kleiner Express Server).
4.  **App:** React Native App, die mit der API spricht. Der Chatbot ist nur das UI für die API-Aufrufe.

Das wird das Spiel enorm bereichern, weil die Spieler in der Session nicht mehr rechnen müssen, sondern sich auf die Intrigen und das Rollenspiel konzentrieren können ("Ich habe letzte Woche meine Festung ausgebaut, jetzt bin ich sicher!").
---
status: legacy
scope: brainstorming
---

# Konzept (Legacy / Brainstorming)

Dieses Dokument ist **kein canonical Rules-Dokument**. Es ist ein historischer Entwurf/Brainstorming-Text und kann veraltet sein.
Für Regeln/Listen gilt: `docs/rules/README.md`.
