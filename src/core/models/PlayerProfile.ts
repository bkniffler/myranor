/**
 * Represents a calculated profile of a player's overall strength or standing in the game.
 * This can be used for scoring, AI decision-making, or providing feedback to the player.
 */
export interface PlayerStrengthProfile {
  // Current liquid assets and their AVE
  liquidResourcesAVE: number; // AVE of current Gold, RM, SM, temporary Influence.

  // Economic engine assessment
  netIncomePerRoundAVE: number; // Net AVE generated per round from all properties/facilities after maintenance.
  assetPotentialAVE: number; // Summed future potential value (e.g., totalNetBenefitOverPaybackPeriodAVE)
  // of all owned, active properties and their facilities.

  // Influence and power
  permanentInfluencePerRoundAVE: number; // AVE of per-round permanent influence generation.
  combatStrengthAVE: number; // AVE of the player's combatPower.
  // actionPointValueAVE?: number;  // Optional: AVE of remaining action points for the current turn.

  // Overall score
  totalStrengthScore: number; // A weighted sum or direct sum of the above components.
}
