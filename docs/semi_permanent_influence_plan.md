# Plan to Implement Semipermanent Influence

**Objective:** Extend the "Einflussgewinn" (Gain Influence) action to allow players to gain semi-permanent influence according to the rules in `docs/SOURCE.MD`, including per-office caps and corrected success scales.

---

## 1. Data Model Adjustments:

*   **Player Resources (`src/core/models/Resources.ts`):**
    *   Add `semiPermanentInfluenceBase: number` to the `PlayerResources` interface. This will store the sum of all semi-permanent influence points the player has acquired. This base value is refreshed as available influence each round and does not reset to zero.
*   **Player State (within `GameState.players[playerId]` in `src/core/models/GameState.ts`):**
    *   Add a new structure to the `Player` interface (or a sub-interface like `PlayerRoundData` if preferred):
        ```typescript
        interface Player {
          // ... existing player properties
          influenceGainedThisRound: {
            semiPermanentPerOffice: Record<string, number>; // Key: propertyId of Office, Value: points gained for that office this round
            // temporaryInfluenceGainedThisRound?: number; // Optional: if we need to track temporary influence cap usage separately
          };
        }
        ```
    *   This `semiPermanentPerOffice` record will track how many of the 2 semi-permanent influence points have been "used up" for each specific Office property *in the current round*. This record will be reset to an empty object `{}` for each player at the beginning of each round or during the resource reset phase.
*   **Office Properties (`Property` model in `src/core/models/Property.ts`):**
    *   No direct changes needed on the persistent `Property` model for storing semi-permanent influence itself, as this is now a player-level base (`semiPermanentInfluenceBase`) and round-specific tracking (`influenceGainedThisRound.semiPermanentPerOffice`).
    *   The existing `PropertySize` (Small, Medium, Large) on an Office property will be used to confirm it's a valid target but doesn't directly influence the *amount* gained per investment (that's fixed at 1 base point per 3 gold), only the *cap* of 2 points per office per round.

---

## 2. Command Logic Extension (`src/core/commands/GainInfluenceCommand.ts`):

*   **Payload Update (`GainInfluenceCommandPayload`):**
    ```typescript
    export interface GainInfluenceCommandPayload {
      influenceType: 'temporary' | 'semiPermanent';
      goldAmount?: number; // For temporary influence
      investmentUnits?: number; // For semi-permanent (1 unit = 3 Gold = 1 base semi-permanent point)
      targetOfficeId?: string; // Required if influenceType is 'semiPermanent'
      [key: string]: any; // For GameCommand compatibility
    }
    ```
*   **Validation Update (`validate` method in `gainInfluenceHandler`):**
    *   **If `influenceType` is `'temporary'`:**
        *   Check gold cost (`payload.goldAmount`).
        *   Implement the cap based on office/circle levels as per `docs/SOURCE.MD` line 214: "Maximal 4 Gold ohne Amt/Circel, 6 Gold bei kleinem Amt/Circel, 8 Gold bei mittlerem Amt/Circel und 12 Gold bei Großem Amt/Circel". This will require checking the player's owned, active offices and potentially circles to determine the correct gold cap for temporary influence.
    *   **If `influenceType` is `'semiPermanent'`:**
        *   Ensure `targetOfficeId` and `investmentUnits` are provided.
        *   Verify `targetOfficeId` belongs to the player, is active, and is of `PropertyType.OFFICE`.
        *   Calculate `basePointsToGain = payload.investmentUnits * 1`.
        *   Check gold cost: `payload.investmentUnits * 3`.
        *   Check against the per-office round cap:
            *   `alreadyGainedThisRoundForOffice = player.influenceGainedThisRound.semiPermanentPerOffice[payload.targetOfficeId] || 0`.
            *   If `alreadyGainedThisRoundForOffice + basePointsToGain > 2`, then invalid (unless `basePointsToGain` itself is > 2, in which case only up to the cap of 2 can be gained for this office this round from this action). The action should probably be structured to gain 1 or 2 points at a time to simplify cap logic. If `investmentUnits` can be > 2, the validation needs to ensure the *total for this office this round* doesn't exceed 2. For simplicity, assume `investmentUnits` will be 1 or 2.
*   **Execution Update (`execute` method in `gainInfluenceHandler`):**
    *   **If `influenceType` is `'temporary'`:**
        *   Calculate temporary influence: `payload.goldAmount / 1 * 4` (as per 1 Gold for 4 Temp Inf).
        *   Event payload: `influenceType: 'temporary'`, `pointsGained`.
    *   **If `influenceType` is `'semiPermanent'`:**
        *   Perform DC 12 check (simulated for now, actual roll later).
        *   `baseGain = payload.investmentUnits * 1`.
        *   `finalSemiPermanentPointsGained = 0;`
        *   `goldCost = payload.investmentUnits * 3;`
        *   Switch on successLevel:
            *   'Sehr gut': `finalSemiPermanentPointsGained = baseGain + (payload.investmentUnits * 2)`.
            *   'Gut': `finalSemiPermanentPointsGained = baseGain + (payload.investmentUnits * 1)`.
            *   'Geschafft': `finalSemiPermanentPointsGained = baseGain`.
            *   'Schlecht': `finalSemiPermanentPointsGained = Math.ceil(baseGain / 2)`.
            *   'Fehlschlag': `goldLost = goldCost`, `finalSemiPermanentPointsGained = 0`.
        *   Ensure `finalSemiPermanentPointsGained` when added to `player.influenceGainedThisRound.semiPermanentPerOffice[payload.targetOfficeId]` does not exceed 2 for that office. Adjust `finalSemiPermanentPointsGained` if necessary (player gets the max possible up to the cap).
        *   Event payload: `influenceType: 'semiPermanent'`, `pointsAddedToSemiPermanentBase: finalSemiPermanentPointsGained`, `targetOfficeId: payload.targetOfficeId`, `goldCostOrLost`.
*   **Event Application (`apply` function within the created event):**
    *   If `temporary`:
        *   `player.resources.temporaryInfluence += pointsGained`.
        *   `player.resources.gold -= goldSpent`.
    *   If `semiPermanent`:
        *   `player.resources.semiPermanentInfluenceBase += pointsAddedToSemiPermanentBase`.
        *   `player.resources.gold -= goldCostOrLost` (if not a fehlschlag where gold is already considered lost).
        *   `player.influenceGainedThisRound.semiPermanentPerOffice[targetOfficeId] = (player.influenceGainedThisRound.semiPermanentPerOffice[targetOfficeId] || 0) + pointsAddedToSemiPermanentBase` (or rather, the portion of `baseGain` that was allowed by the cap). This needs careful thought: the cap is on points *gained*, so if `baseGain` was 2, and they got a bonus, they still only "used up" 2 points of their cap for that office. The bonus is extra. So, update `semiPermanentPerOffice` by the capped `baseGain` portion.

---

## 3. Game Engine & Phase Manager Adjustments:

*   **`Player` interface in `src/core/models/GameState.ts`:**
    *   Add `influenceGainedThisRound: { semiPermanentPerOffice: Record<string, number>; };`
    *   Initialize this to `{ semiPermanentPerOffice: {} }` when a player is created.
*   **`PhaseManager.ts` - `processResourceResetPhase`:**
    *   For each player:
        *   `player.resources.temporaryInfluence = 0;`
        *   `player.resources.laborPower = player.resources.baseLaborPower;`
        *   `player.influenceGainedThisRound.semiPermanentPerOffice = {};` (Reset the per-office tracking for the new round).
*   **Total Available Influence Calculation (Conceptual - for UI or other game logic checks):**
    *   When checking available influence for actions or displaying to user:
        `totalAvailableInfluence = player.resources.temporaryInfluence + player.resources.permanentInfluence + player.resources.semiPermanentInfluenceBase`.

---

## 4. Console UI Adjustments (`src/adapters/console/ConsoleUI.ts`):

*   **`showGainInfluenceAction`:**
    1.  Ask player if they want to gain 'temporary' or 'semiPermanent' influence.
    2.  If 'temporary': Proceed mostly as current, but add validation for the gold cap based on offices/circles.
    3.  If 'semiPermanent':
        *   List player's active "Amt" (Office) properties with numbers.
        *   Ask player to select the target office by number.
        *   Inform them they can gain up to 2 semi-permanent points for this office this round (if not already capped).
        *   Ask for `investmentUnits` (e.g., "1 Einheit für 1 Punkt (kostet 3 Gold) oder 2 Einheiten für 2 Punkte (kostet 6 Gold)?").
        *   Construct and dispatch the `GainInfluenceCommand` with `influenceType: 'semiPermanent'`, `targetOfficeId`, and `investmentUnits`.

---
## Mermaid Diagram for Semipermanent Influence Gain Action:

```mermaid
graph TD
    A[Player chooses "Gain Influence"] --> B{Choose Type};
    B -- Temporary --> TEMP_LOGIC[Temporary Influence Logic (existing + new gold cap validation)];
    B -- Semipermanent --> D[List Player's Active Offices];
    D --> D_CHOOSE[Player Selects Target Office];
    D_CHOOSE -- Invalid Office --> D;
    D_CHOOSE -- Valid Office --> E[Display Remaining SP Cap for this Office (2 - already_gained_this_round)];
    E --> F[Input Investment Units (1 or 2, for 1 or 2 base SP points, cost 3 Gold/unit)];
    F -- Invalid Units (e.g., > remaining cap) --> E;
    F -- Valid Units --> G{Validate Gold Cost};
    G -- Not Enough Gold --> E;
    G -- Enough Gold --> H[Perform DC 12 Check];
    H --> I{Success Level?};
    I -- Sehr Gut (+2/unit bonus) --> J[Calculate Total SP Gain (base + bonus)];
    I -- Gut (+1/unit bonus) --> J;
    I -- Geschafft (base gain) --> J;
    I -- Schlecht (half base) --> J;
    I -- Fehlschlag --> K[Gold Lost, No SP Gain];
    J --> L[Ensure Gain respects Office's remaining round cap of 2 base points];
    L --> M[Update Player.resources.semiPermanentInfluenceBase];
    M --> N[Update Player.influenceGainedThisRound.semiPermanentPerOffice[targetOfficeId] by base points used from cap];
    K --> EVENT_FAIL[Dispatch Event (Failure)];
    N --> EVENT_SUCCESS[Dispatch Event (Success, SP Gained)];
    TEMP_LOGIC --> Z[End Action];
    EVENT_FAIL --> Z;
    EVENT_SUCCESS --> Z;
```

---
This plan provides a comprehensive approach to implementing the semi-permanent influence mechanic.