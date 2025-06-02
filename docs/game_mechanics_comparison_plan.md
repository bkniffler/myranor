## Game Mechanics Comparison Plan

**Objective:** To perform a detailed comparison of the implemented game prototype (code in `src/`, data in `data/`) against the game system design outlined in [`docs/SOURCE.MD`](docs/SOURCE.MD), focusing on the agreed-upon "Grundprinzipien" (basic principles).

**Scope:** The comparison will cover:
1.  **Core Resources:** Definition, initial values, and management.
2.  **Round Structure & Phases:** Implementation of game rounds and their constituent phases (Maintenance, Actions, Automatic Conversion, Resource Reset).
3.  **Player Actions:** Availability and implementation of core player actions.
4.  **Posts (Properties/Holdings):** Types, attributes, acquisition, and effects of core posts.
5.  **Facilities (Einrichtungen):** Types, attributes, building, and effects of core facilities.
6.  **Starting Conditions:** How players are initialized.
7.  **Key Calculations & Rules:** Such as DC (Difficulty Class) checks, success scales, and specific conversion rates.

---

### I. Core Resources

*   **Document Reference:** [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 22-28: Grundressourcen; Lines 141-146: Startressourcen)
*   **Code/Data to Examine:**
    *   [`src/core/models/Resources.ts`](src/core/models/Resources.ts) (Interface: `PlayerResources`, `RawMaterials`, `SpecialMaterials`)
    *   [`data/materials/raw_materials.json`](data/materials/raw_materials.json)
    *   [`data/materials/special_materials.json`](data/materials/special_materials.json)
    *   [`src/core/models/GameState.ts`](src/core/models/GameState.ts) (Interface: `GameStateConfig` for initial resources)
    *   [`src/core/engine/GameEngineFactory.ts`](src/core/engine/GameEngineFactory.ts) (for how initial resources are set up)
*   **Comparison Points:**
    1.  **Resource Types:**
        *   Verify if Gold (Aureal), Einfluss (Influence - temporary & permanent), Arbeitskraft (Labor Power - base & current), Rohmaterial (Raw Material), and Sondermaterial (Special Material) are implemented as defined.
        *   Compare the list of specific raw materials in [`data/materials/raw_materials.json`](data/materials/raw_materials.json) against [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 53-85). Check for names, categories (billig, einfach, teuer - noting your JSON uses cheap, medium, expensive), and price bonuses.
        *   Compare the list of specific special materials in [`data/materials/special_materials.json`](data/materials/special_materials.json) against [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 105-137). Check for names, categories, price bonuses, and conversion requirements.
    2.  **Resource Accumulation/Reset:**
        *   Gold: Confirmed to remain and accumulate.
        *   Influence: Permanent influence accumulates; temporary influence resets (covered in Resource Reset phase).
        *   Labor Power: Permanent labor accumulates; temporary labor resets (covered in Resource Reset phase).
        *   Materials: Handled by conversion/storage (covered in Automatic Conversion & Lager).

---

### II. Round Structure & Phases

*   **Document Reference:** [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 2-13: Die Runde, Unterhalt, Aktionen, Automatische Umwandlung, Ressourcen-Reset)
*   **Code/Data to Examine:**
    *   [`src/core/models/GameState.ts`](src/core/models/GameState.ts) (Enum: `GamePhase`)
    *   [`src/core/engine/GameEngine.ts`](src/core/engine/GameEngine.ts) (Methods: `advancePhase`, `advanceRound`)
    *   [`src/core/engine/PhaseManager.ts`](src/core/engine/PhaseManager.ts) (Methods: `processMaintenancePhase`, `processProductionPhase` (Note: "Production" phase isn't explicitly named in `SOURCE.MD`'s top-level round structure, but actions occur. This might be how actions are handled or an intermediate step), `processResourceConversionPhase`, `processResourceResetPhase`)
*   **Comparison Points:**
    1.  **Phase Order:** Verify if the implemented game phases (`Maintenance`, `Action` (implicitly), `Resource Conversion`, `Resource Reset`) match the order described: Unterhalt -> Aktionen -> Automatische Umwandlung -> Ressourcen-Reset.
    2.  **Maintenance Phase (`processMaintenancePhase`):**
        *   Costs for Posts/Facilities: Check if costs are deducted (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 4).
        *   Labor Power Maintenance: Check if 1 Gold per 4 AK is deducted (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 6).
        *   Timing: Confirm these occur at the start of the round (after the 1st).
        *   Consequences of Non-Payment: Check if "Erträge und Vorteile...ausbleiben" (yields and benefits cease) is implemented (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 4).
    3.  **Action Phase (Handled within `GameEngine` and commands):**
        *   Timing: Confirm actions occur after Maintenance and before Automatic Conversion.
    4.  **Automatic Conversion Phase (`processResourceConversionPhase`):**
        *   Raw Material to Special Material (Workshops): Check if workshops automatically convert raw materials based on capacity (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 9). Verify the 4 Raw Material to 1 Special Material base rate.
        *   Raw Material to Gold: Check if remaining raw material converts to gold (4 Raw Material to 1 Gold) at round end (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 9).
        *   Special Material to Gold: Check if special material converts to gold (1 Special Material to 2 Gold) at round end (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 10).
        *   Lager (Storage): Check if having a "Lager" facility prevents automatic conversion of stored materials (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 11).
    5.  **Resource Reset Phase (`processResourceResetPhase`):**
        *   Labor Power & Influence: Check if these are reset based on current permanent posts/actions (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 13).

---

### III. Player Actions (Aktionen)

*   **Document Reference:** [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 16-20, 151-153, 207-318)
*   **Code/Data to Examine:**
    *   [`src/core/commands/`](src/core/commands/) (all command files)
    *   [`src/core/models/GameState.ts`](src/core/models/GameState.ts) (Enum: `GameActionType`)
*   **Comparison Points:**
    1.  **Number of Actions:**
        *   Check if players start with 2 actions per round (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 17, 148, 151).
        *   Check for implementation of bonus actions/additional actions (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 19, 153).
        *   Check for restriction of one action of the same type per round (sub-actions distinct) (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 152).
    2.  **Specific Actions:**
        *   **1. Einflussgewinn (Gain Influence):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 211-222)
            *   Compare [`src/core/commands/GainInfluenceCommand.ts`](src/core/commands/GainInfluenceCommand.ts) with rules for temporary and semi-permanent influence, costs, DC, and success scale.
        *   **2. Geldgewinn (Gain Money):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 224-235)
            *   **Geldverleih (Money Lending):** Check for a command/logic implementing this. Compare costs, returns, caps, DC, and success scale.
            *   **Verkauf von Materialien (Sell Materials):** Compare [`src/core/commands/SellMaterialsCommand.ts`](src/core/commands/SellMaterialsCommand.ts) with rules for selling raw/special materials, labor, exchange rates, caps, DC, and success scale.
        *   **3. Materialgewinn (Gain Materials):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 237-248)
            *   Compare [`src/core/commands/GatherMaterialsCommand.ts`](src/core/commands/GatherMaterialsCommand.ts) with rules for Domänenverwaltung (Domain Management) and Überwachung der Werkstätten (Workshop Supervision), costs (labor), caps, DC, and success scale.
        *   **4. Gewinn permanenter Posten oder Sondereinrichtungen (Gain Permanent Posts or Special Facilities):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 250-299)
            *   Compare [`src/core/commands/AcquirePropertyCommand.ts`](src/core/commands/AcquirePropertyCommand.ts) with rules for acquiring Domänen, Städtischer Grundbesitz, Werkstätten, Ämter, Handelsunternehmungen, Circel, Kulte, etc. Check costs (gold, influence), DC, and success scale.
        *   **5. Politische Schritte (Political Actions):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 301-312)
            *   Check for a command/logic implementing this. Compare costs, sub-actions (Beschädigen, Manipulieren), caps, DC, and success scale.
        *   **6. Einrichtungen errichten/ausbauen (Sonderaktion) (Build/Upgrade Facilities - Special Action):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 314-345)
            *   Compare [`src/core/commands/BuildFacilityCommand.ts`](src/core/commands/BuildFacilityCommand.ts) with rules for this special action (automatic success for small, DC for medium/large), costs. Confirm it doesn't count towards max actions.
    3.  **Proben (Checks/Rolls) & DC:** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 155-172)
        *   Verify d20 system for checks.
        *   Verify success scale (Sehr gut, Gut, Geschafft, Schlecht geschafft, Fehlschlag).
        *   Verify DC modification for Small/Medium/Large undertakings.
        *   Verify DC reduction caps from posts.

---

### IV. Posts (Properties/Holdings)

*   **Document Reference:** [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 184-191, 351-719) - Domänen, Städtischer Besitz, Ämter, Circel und Collegien, Handelsunternehmungen.
*   **Code/Data to Examine:**
    *   [`src/core/models/Property.ts`](src/core/models/Property.ts)
    *   [`data/properties/property_types.json`](data/properties/property_types.json)
    *   [`src/core/data/factories/PropertyFactory.ts`](src/core/data/factories/PropertyFactory.ts)
*   **Comparison Points:**
    1.  **Domänen (Domains):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 353-365)
        *   Compare implemented domain types (e.g., "small_rural_domain") in [`data/properties/property_types.json`](data/properties/property_types.json) with `SOURCE.MD` definitions for maintenance, yield (Arbeitskraft, Rohmaterialien), and DC reduction advantages.
    2.  **Städtischer Besitz (City Property):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 425-445)
        *   Compare implemented city property types (e.g., "small_city_property") with `SOURCE.MD` definitions for maintenance, yield (rented vs. own production), DC reduction advantages, and facility slots.
    3.  **Ämter (Offices):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 584-594)
        *   Compare implemented office types (e.g., "small_office") with `SOURCE.MD` definitions for yield (influence/gold) and DC reduction advantages.
    4.  **Werkstätten (Workshops) & Lager (Warehouses) as Properties:** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 939-962, also mentioned as acquirable posts)
        *   Compare implemented workshop/warehouse property types (e.g., "small_workshop", "small_storage") with `SOURCE.MD` definitions for function (conversion capacity, storage capacity) and maintenance.
    5.  **Circel und Collegien (Circles and Collegia):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 523-582)
        *   Check if any Circle/Collegium types are defined in [`data/properties/property_types.json`](data/properties/property_types.json) or if there's logic for them. Compare against `SOURCE.MD` for types (Unterwelt, Spionage, Kult, Handwerk/Handel), maintenance, yield, advantages, and follower rules.
    6.  **Handelsunternehmungen (Trading Ventures):** (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Lines 690-704)
        *   Check if Trading Ventures are defined in [`data/properties/property_types.json`](data/properties/property_types.json) or if there's logic. Compare against `SOURCE.MD` for maintenance, yield (SM or Gold), and DC reduction advantages.
    7.  **Facility Slots:** For all relevant posts, compare the `facilitySlots` in [`data/properties/property_types.json`](data/properties/property_types.json) with the limits described in [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 201-205).

---

### V. Facilities (Einrichtungen)

*   **Document Reference:** [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 192-206, and specific facility lists under Domänen, Städtischer Besitz, etc.)
*   **Code/Data to Examine:**
    *   [`src/core/models/Facility.ts`](src/core/models/Facility.ts)
    *   [`data/facilities/facility_types.json`](data/facilities/facility_types.json)
    *   [`src/core/data/factories/FacilityFactory.ts`](src/core/data/factories/FacilityFactory.ts) (or similar, e.g. [`src/core/config/FacilityFactory.ts`](src/core/config/FacilityFactory.ts))
*   **Comparison Points:**
    1.  **General Facilities:**
        *   Compare facilities in [`data/facilities/facility_types.json`](data/facilities/facility_types.json) categorized as "general" against the "Allgemeine Einrichtungen der Domäne" (Lines 367-379) and "Allgemeine Stadtausbauten" (Lines 446-457) in `SOURCE.MD`. Check names, costs, effects, and build requirements.
    2.  **Specialized Facilities:**
        *   Compare facilities in [`data/facilities/facility_types.json`](data/facilities/facility_types.json) categorized as "specialized" against the "Domänenspezialisierung" (Lines 381-423) and "Städtische Spezialisierungen" (Lines 458-521) in `SOURCE.MD`. Check names, costs, effects, build requirements (including property specializations).
    3.  **Build Requirements & Costs:** Verify alignment between JSON data and `SOURCE.MD`.
    4.  **Effects:** Verify alignment of production bonuses, storage capacities, conversion rates, etc.
    5.  **Maintenance:** Check if maintenance costs for facilities are implemented as per `SOURCE.MD`.

---

### VI. Starting Conditions

*   **Document Reference:** [`docs/SOURCE.MD`](docs/SOURCE.MD) (Lines 139-149)
*   **Code/Data to Examine:**
    *   [`src/core/models/Resources.ts`](src/core/models/Resources.ts) (Interface: `GameStateConfig`)
    *   [`src/core/engine/GameEngineFactory.ts`](src/core/engine/GameEngineFactory.ts) (Function: `createFromJsonData` or similar initialization logic)
    *   [`data/game_state.json`](data/game_state.json) (or similar config file if used for initial setup)
*   **Comparison Points:**
    1.  **Initial Resources:** Compare `initialResources` in `GameStateConfig` (or actual starting values) with [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 141-146 (Domäne yield, Arbeitskraft, Werkstatt, Städtischer Besitz, Gold).
        *   "Besonders Kleine Ländliche Domäne (Ertrag per Runde: 2 Arbeitskraft, 4 Rohmaterial (Ausnahme))" - Note: The JSON for `small_rural_domain` shows 8 grain, 4 wood. This needs checking.
        *   "2 Arbeitskraft aus Arbeitsdiensten der Untertanen"
        *   "Kleine Werkstatt als (Sonder) Einrichtung der Domäne"
        *   "Kleiner Städtischer Besitz (Verpachtet)"
        *   "4 Gold"
    2.  **Starting Actions:** Confirm players start with 2 actions (Ref: [`docs/SOURCE.MD`](docs/SOURCE.MD) Line 148). (This is also covered under Player Actions).

---

### VII. Diagrams & Visualization

*   **Round Flow Diagram:**
    ```mermaid
    graph TD
        A[Start Round] --> B(Maintenance Phase);
        B --> C(Action Phase);
        C --> D(Automatic Conversion Phase);
        D --> E(Resource Reset Phase);
        E --> F[End Round / Start Next Round];
    ```
*   **Resource Conversion Flow (Example):**
    ```mermaid
    graph TD
        subgraph Workshop
            RW1[Raw Material 1] --> WC(Conversion Process);
            RW2[Raw Material 2] --> WC;
            WC --> SM[Special Material];
        end
        subgraph End of Round
            SM_Market[Special Material] --> G1[Gold];
            RW_Market[Raw Material] --> G2[Gold];
        end
    ```

---