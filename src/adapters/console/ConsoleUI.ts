import * as readline from 'node:readline';
import { type GameEngine, GameEventType, GamePhase } from '../../core';
import { FacilityTypes, PropertyTypes } from '../../core';
import type {
  MaintenancePerformedPayload,
  RoundAdvancedPayload,
} from '../../core/events/EventPayloads';
import type { GameEvent } from '../../core/events/GameEvent';

export class ConsoleUI {
  private engine: GameEngine;
  private rl: readline.Interface;

  constructor(engine: GameEngine) {
    this.engine = engine;

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Subscribe to game events
    this.engine.subscribe(this.handleGameEvent.bind(this));
  }

  // Start the UI
  public start(): void {
    this.clearScreen();
    this.showWelcome();
  }

  // Handle game events
  private handleGameEvent(event: GameEvent): void {
    // Update UI based on event type
    switch (event.type) {
      case GameEventType.GAME_STARTED:
        this.displayGameInfo();
        this.showActionMenu();
        break;

      case GameEventType.PHASE_CHANGED: {
        this.displayGameInfo();

        // Show phase-specific UI
        const state = this.engine.getCurrentState();
        switch (state.phase) {
          case GamePhase.ACTION:
            this.showActionMenu();
            break;

          default:
            // For automatic phases, just wait for next event
            break;
        }
        break;
      }

      case GameEventType.MAINTENANCE_PERFORMED: {
        const payload = event.payload as MaintenancePerformedPayload;
        console.log(
          `\nUnterhalt bezahlt: ${payload.goldCost} Gold, ${payload.laborCost} Arbeitskraft`
        );
        break;
      }

      case GameEventType.RESOURCES_PRODUCED:
        console.log('\nProduktion abgeschlossen');
        break;

      case GameEventType.RESOURCES_RESET:
        console.log('\nRessourcen zurückgesetzt');
        break;

      case GameEventType.ROUND_ADVANCED: {
        const payload = event.payload as RoundAdvancedPayload;
        console.log(`\nRunde ${payload.round} beginnt`);
        break;
      }
    }
  }

  // Show welcome screen
  private showWelcome(): void {
    console.log('=== WILLKOMMEN ZU MYRANOR: STRATEGIESPIEL V1 ===');
    console.log(
      '\nIn diesem Spiel verwaltest du deine Ressourcen, baust dein Reich auf und triffst strategische Entscheidungen.'
    );
    console.log(
      'Du gewinnst, wenn du 30 Runden überstehst. Du verlierst, wenn dein Gold unter -20 fällt.\n'
    );

    this.promptForName();
  }

  // Prompt for player name
  private promptForName(): void {
    this.rl.question('Wie ist dein Name? ', (name) => {
      const playerId = 'player1';

      // Initialize game state with player - startGame will handle this
      const engine = this.engine;
      engine.startGame(playerId, name || 'Spieler 1');
    });
  }

  // Clear the screen
  private clearScreen(): void {
    console.clear();
  }

  // Display game information
  private displayGameInfo(): void {
    this.clearScreen();

    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];

    console.log(
      `=== RUNDE ${state.round} | PHASE: ${state.phase.toUpperCase()} ===`
    );
    console.log(`Spieler: ${player.name}`);
    console.log('---------------------------');
    console.log(`Gold: ${player.resources.gold}`);
    console.log(
      `Arbeitskraft: ${player.resources.laborPower}/${player.resources.baseLaborPower}`
    );
    console.log(
      `Einfluss: ${player.resources.temporaryInfluence} (temporär) + ${player.resources.permanentInfluence} (permanent)`
    );

    // Display raw materials
    console.log('\nRohmaterialien:');
    const rawMaterials = player.resources.rawMaterials;

    if (Object.keys(rawMaterials).length === 0) {
      console.log('  Keine Rohstoffe');
    } else {
      for (const [material, amount] of Object.entries(rawMaterials)) {
        if (amount && amount > 0) {
          const marketData = state.market.rawMaterials[material];
          if (marketData) {
            const price = marketData.basePrice;
            console.log(
              `  ${material}: ${amount} (Wert: ${price} Gold pro Stück)`
            );
          } else {
            console.log(`  ${material}: ${amount}`);
          }
        }
      }
    }

    // Display special materials
    console.log('\nSondermaterialien:');
    const specialMaterials = player.resources.specialMaterials;

    if (Object.keys(specialMaterials).length === 0) {
      console.log('  Keine Sondermaterialien');
    } else {
      for (const [material, amount] of Object.entries(specialMaterials)) {
        if (amount && amount > 0) {
          const marketData = state.market.specialMaterials[material];
          if (marketData) {
            const price = marketData.basePrice;
            console.log(
              `  ${material}: ${amount} (Wert: ${price} Gold pro Stück)`
            );
          } else {
            console.log(`  ${material}: ${amount}`);
          }
        }
      }
    }

    // Display properties
    console.log('\nBesitztümer:');
    if (player.propertyIds.length === 0) {
      console.log('  Keine Besitztümer');
    } else {
      for (const id of player.propertyIds) {
        const property = state.properties[id];
        if (property) {
          console.log(`  ${property.name} (${property.type})`);
          console.log(`    Größe: ${property.size}`);
          console.log(`    Status: ${property.active ? 'Aktiv' : 'Inaktiv'}`);

          // Display facilities on this property
          if (property.facilityIds.length > 0) {
            for (const facilityId of property.facilityIds) {
              const facility = state.facilities[facilityId];
              if (facility) {
                console.log(`    - ${facility.name}`);
              }
            }
          }
        }
      }
    }

    console.log(`\nAktionspunkte: ${state.actionPointsRemaining}`);
    console.log('---------------------------');

    // Debug: Show available market data
    console.log('\n=== DEBUG: MARKT ===');
    console.log(
      `Verfügbare Rohstoffe im Markt: ${Object.keys(state.market.rawMaterials).length}`
    );
    console.log(
      `Verfügbare Spezialmat. im Markt: ${Object.keys(state.market.specialMaterials).length}`
    );

    // Show sample of each
    if (Object.keys(state.market.rawMaterials).length > 0) {
      const sampleKey = Object.keys(state.market.rawMaterials)[0];
      console.log(
        `Beispiel Rohstoff: ${sampleKey}, Preis: ${state.market.rawMaterials[sampleKey].basePrice}`
      );
    }

    if (Object.keys(state.market.specialMaterials).length > 0) {
      const sampleKey = Object.keys(state.market.specialMaterials)[0];
      console.log(
        `Beispiel Spezialmaterial: ${sampleKey}, Preis: ${state.market.specialMaterials[sampleKey].basePrice}`
      );
    }
  }

  // Show the main action menu
  private showActionMenu(): void {
    // Always display the current game state first
    this.displayGameInfo();

    const state = this.engine.getCurrentState();

    if (state.actionPointsRemaining <= 0) {
      console.log('\nKeine Aktionspunkte mehr übrig in dieser Runde.');
      this.promptEndTurn();
      return;
    }

    console.log('\nWähle eine Aktion:');
    console.log('1. Einfluss gewinnen');
    console.log('2. Geld gewinnen (Materialien verkaufen)');
    console.log('3. Material gewinnen (Domänenverwaltung)');
    console.log('4. Posten/Einrichtung erwerben');
    console.log('5. Einrichtung ausbauen');
    console.log('6. Runde beenden');

    this.rl.question('\nDeine Wahl (1-6): ', (choice) => {
      switch (choice) {
        case '1':
          this.showGainInfluenceAction();
          break;
        case '2':
          this.showSellMaterialsAction();
          break;
        case '3':
          this.showGatherMaterialsAction();
          break;
        case '4':
          this.showAcquirePropertyAction();
          break;
        case '5':
          this.showBuildFacilityAction();
          break;
        case '6':
          this.endTurn();
          break;
        default:
          console.log('Ungültige Eingabe. Bitte wähle erneut.');
          this.showActionMenu();
      }
    });
  }

  // Placeholder methods for various actions
  private showGainInfluenceAction(): void {
    this.clearScreen();
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];

    console.log('=== EINFLUSS GEWINNEN ===');
    console.log('Du kannst Gold ausgeben, um temporären Einfluss zu gewinnen.');
    console.log('Verhältnis: 1 Gold = 2 Einfluss');
    console.log(`Aktuelles Gold: ${player.resources.gold}`);

    this.rl.question(
      'Wie viel Gold möchtest du ausgeben? (0 zum Abbrechen): ',
      (amountStr) => {
        const amount = Number.parseInt(amountStr, 10);

        // Validate input
        if (Number.isNaN(amount)) {
          console.log('Ungültige Eingabe. Bitte gib eine Zahl ein.');
          this.showGainInfluenceAction();
          return;
        }

        // Cancel action
        if (amount <= 0) {
          console.log('Aktion abgebrochen.');
          this.showActionMenu();
          return;
        }

        // Check if player has enough gold
        if (amount > player.resources.gold) {
          console.log('Du hast nicht genug Gold!');
          this.waitForEnter(() => {
            this.showGainInfluenceAction();
          });
          return;
        }

        // Execute command
        const result = this.engine.executeCommand({
          type: 'GAIN_INFLUENCE',
          playerId: state.currentPlayerId,
          payload: {
            goldAmount: amount,
          },
          validate: (state) => {
            return (
              state.phase === 'action' &&
              state.actionPointsRemaining > 0 &&
              state.players[state.currentPlayerId].resources.gold >= amount
            );
          },
          execute: (state) => {
            const influenceGained = amount * 2;

            return [
              {
                id: Date.now().toString(),
                type: GameEventType.INFLUENCE_GAINED,
                timestamp: Date.now(),
                playerId: state.currentPlayerId,
                payload: {
                  goldSpent: amount,
                  influenceGained,
                },
                apply: (state) => {
                  const player = { ...state.players[state.currentPlayerId] };

                  player.resources = {
                    ...player.resources,
                    gold: player.resources.gold - amount,
                    temporaryInfluence:
                      player.resources.temporaryInfluence + influenceGained,
                  };

                  return {
                    ...state,
                    players: {
                      ...state.players,
                      [state.currentPlayerId]: player,
                    },
                    actionPointsRemaining: state.actionPointsRemaining - 1,
                  };
                },
              },
            ];
          },
        });

        if (result) {
          console.log(
            `Du hast ${amount} Gold ausgegeben und ${amount * 2} Einfluss gewonnen.`
          );
        } else {
          console.log('Die Aktion konnte nicht ausgeführt werden.');
        }

        this.waitForEnter(() => {
          this.showActionMenu();
        });
      }
    );
  }

  private showSellMaterialsAction(): void {
    this.clearScreen();
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];

    console.log('=== MATERIALIEN VERKAUFEN ===');
    console.log(
      'Du kannst Rohmaterialien und Sondermaterialien verkaufen, um Gold zu gewinnen.'
    );

    // Display available materials
    console.log('\nVerfügbare Rohmaterialien:');
    const rawMaterials: string[] = [];
    for (const [material, amount] of Object.entries(
      player.resources.rawMaterials
    )) {
      if (amount && amount > 0) {
        console.log(`  ${material}: ${amount}`);
        rawMaterials.push(material);
      }
    }

    console.log('\nVerfügbare Sondermaterialien:');
    const specialMaterials: string[] = [];
    for (const [material, amount] of Object.entries(
      player.resources.specialMaterials
    )) {
      if (amount && amount > 0) {
        console.log(`  ${material}: ${amount}`);
        specialMaterials.push(material);
      }
    }

    // If no materials available, abort
    if (rawMaterials.length === 0 && specialMaterials.length === 0) {
      console.log('\nDu hast keine Materialien zum Verkaufen.');
      this.waitForEnter(() => {
        this.showActionMenu();
      });
      return;
    }

    // Simple V1 implementation - just let user choose one type to sell
    this.rl.question(
      '\nWelches Material möchtest du verkaufen? ',
      (materialName) => {
        if (!materialName) {
          console.log('Aktion abgebrochen.');
          this.showActionMenu();
          return;
        }

        // Check if the material is available
        let materialType: 'raw' | 'special' | null = null;
        let materialAmount = 0;

        if (
          rawMaterials.includes(materialName) &&
          player.resources.rawMaterials[materialName]
        ) {
          materialType = 'raw';
          materialAmount = player.resources.rawMaterials[materialName] || 0;
        } else if (
          specialMaterials.includes(materialName) &&
          player.resources.specialMaterials[materialName]
        ) {
          materialType = 'special';
          materialAmount = player.resources.specialMaterials[materialName] || 0;
        }

        if (!materialType) {
          console.log('Dieses Material ist nicht verfügbar.');
          this.showSellMaterialsAction();
          return;
        }

        this.rl.question(
          `Wie viel ${materialName} möchtest du verkaufen? (Max: ${materialAmount}): `,
          (amountStr) => {
            const amount = Number.parseInt(amountStr, 10);

            // Validate input
            if (Number.isNaN(amount) || amount <= 0) {
              console.log(
                'Ungültige Eingabe. Bitte gib eine positive Zahl ein.'
              );
              this.waitForEnter(() => {
                this.showSellMaterialsAction();
              });
              return;
            }

            // Check if player has enough of the material
            if (amount > materialAmount) {
              console.log(`Du hast nicht genug ${materialName}!`);
              this.waitForEnter(() => {
                this.showSellMaterialsAction();
              });
              return;
            }

            // Execute command
            const payload: Record<string, unknown> = {
              rawMaterials: {},
              specialMaterials: {},
            };

            if (materialType === 'raw') {
              payload.rawMaterials[materialName] = amount;
              payload.specialMaterials = undefined;
            } else {
              payload.specialMaterials[materialName] = amount;
              payload.rawMaterials = undefined;
            }

            const result = this.engine.executeCommand({
              type: 'SELL_MATERIALS',
              playerId: state.currentPlayerId,
              payload,
              validate: (state) => {
                return (
                  state.phase === 'action' && state.actionPointsRemaining > 0
                );
              },
              execute: (state) => {
                // Simple pricing model for V1
                const materialPrice = materialType === 'raw' ? 1 : 2;
                const goldGained = amount * materialPrice;

                return [
                  {
                    id: Date.now().toString(),
                    type: GameEventType.MATERIALS_SOLD,
                    timestamp: Date.now(),
                    playerId: state.currentPlayerId,
                    payload: {
                      rawMaterials:
                        materialType === 'raw'
                          ? { [materialName]: amount }
                          : {},
                      specialMaterials:
                        materialType === 'special'
                          ? { [materialName]: amount }
                          : {},
                      goldGained,
                    },
                    apply: (state) => {
                      const player = {
                        ...state.players[state.currentPlayerId],
                      };

                      // Add gold
                      player.resources = {
                        ...player.resources,
                        gold: player.resources.gold + goldGained,
                      };

                      // Remove materials
                      if (materialType === 'raw') {
                        const updatedRawMaterials = {
                          ...player.resources.rawMaterials,
                        };
                        updatedRawMaterials[materialName] =
                          (updatedRawMaterials[materialName] || 0) - amount;
                        player.resources.rawMaterials = updatedRawMaterials;
                      } else {
                        const updatedSpecialMaterials = {
                          ...player.resources.specialMaterials,
                        };
                        updatedSpecialMaterials[materialName] =
                          (updatedSpecialMaterials[materialName] || 0) - amount;
                        player.resources.specialMaterials =
                          updatedSpecialMaterials;
                      }

                      return {
                        ...state,
                        players: {
                          ...state.players,
                          [state.currentPlayerId]: player,
                        },
                        actionPointsRemaining: state.actionPointsRemaining - 1,
                      };
                    },
                  },
                ];
              },
            });

            if (result) {
              const materialPrice = materialType === 'raw' ? 1 : 2;
              const goldGained = amount * materialPrice;
              console.log(
                `Du hast ${amount} ${materialName} für ${goldGained} Gold verkauft.`
              );
            } else {
              console.log('Die Aktion konnte nicht ausgeführt werden.');
            }

            this.waitForEnter(() => {
              this.showActionMenu();
            });
          }
        );
      }
    );
  }

  private showGatherMaterialsAction(): void {
    this.clearScreen();
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];

    console.log('=== MATERIAL GEWINNEN ===');
    console.log(
      'Du kannst Arbeitskraft einsetzen, um Rohmaterialien zu gewinnen.'
    );
    console.log(`Verfügbare Arbeitskraft: ${player.resources.laborPower}`);

    // Show available properties to gather from
    console.log('\nVerfügbare Besitztümer:');
    const activeProperties = player.propertyIds
      .map((id) => state.properties[id])
      .filter((p) => p?.active);

    if (activeProperties.length === 0) {
      console.log(
        'Du hast keine aktiven Besitztümer, von denen du sammeln kannst.'
      );
      this.waitForEnter(() => {
        this.showActionMenu();
      });
      return;
    }

    activeProperties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.name} (${property.type})`);
    });

    // Let user choose a property
    this.rl.question(
      '\nVon welchem Besitztum möchtest du sammeln? (Nummer, 0 zum Abbrechen): ',
      (choiceStr) => {
        const choice = Number.parseInt(choiceStr, 10);

        // Validate input
        if (
          Number.isNaN(choice) ||
          choice < 0 ||
          choice > activeProperties.length
        ) {
          console.log('Ungültige Eingabe.');
          this.showGatherMaterialsAction();
          return;
        }

        // Cancel action
        if (choice === 0) {
          console.log('Aktion abgebrochen.');
          this.showActionMenu();
          return;
        }

        const selectedProperty = activeProperties[choice - 1];

        // Ask for labor amount
        this.rl.question(
          `Wie viel Arbeitskraft möchtest du einsetzen? (Max: ${player.resources.laborPower}): `,
          (laborStr) => {
            const laborAmount = Number.parseInt(laborStr, 10);

            // Validate input
            if (Number.isNaN(laborAmount) || laborAmount <= 0) {
              console.log(
                'Ungültige Eingabe. Bitte gib eine positive Zahl ein.'
              );
              this.waitForEnter(() => {
                this.showGatherMaterialsAction();
              });
              return;
            }

            // Check if player has enough labor
            if (laborAmount > player.resources.laborPower) {
              console.log('Du hast nicht genug Arbeitskraft!');
              this.waitForEnter(() => {
                this.showGatherMaterialsAction();
              });
              return;
            }

            // Execute command
            const result = this.engine.executeCommand({
              type: 'GATHER_MATERIALS',
              playerId: state.currentPlayerId,
              payload: {
                laborAmount,
                propertyId: selectedProperty.id,
              },
              validate: (state) => {
                return (
                  state.phase === 'action' &&
                  state.actionPointsRemaining > 0 &&
                  state.players[state.currentPlayerId].resources.laborPower >=
                    laborAmount
                );
              },
              execute: (state) => {
                // Roll for success
                const roll = Math.floor(Math.random() * 20) + 1;
                const dc = 10; // Basic DC for V1
                const success = roll >= dc;

                // Calculate materials gained
                let materialsGained: Record<string, number> = {};
                const baseAmount = Math.floor(
                  laborAmount * (success ? 1.0 : 0.5)
                );

                // Different materials based on property type
                if (selectedProperty.type === 'domain') {
                  materialsGained = {
                    grain: Math.floor(baseAmount * 1.5),
                    wood: baseAmount,
                  };
                } else if (selectedProperty.type === 'cityProperty') {
                  materialsGained = {
                    bricks: baseAmount,
                  };
                } else {
                  materialsGained = {
                    grain: baseAmount,
                  };
                }

                return [
                  {
                    id: Date.now().toString(),
                    type: GameEventType.MATERIALS_GATHERED,
                    timestamp: Date.now(),
                    playerId: state.currentPlayerId,
                    payload: {
                      laborSpent: laborAmount,
                      propertyId: selectedProperty.id,
                      roll,
                      dc,
                      success,
                      materialsGathered: materialsGained,
                    },
                    apply: (state) => {
                      const player = {
                        ...state.players[state.currentPlayerId],
                      };

                      // Update labor
                      player.resources = {
                        ...player.resources,
                        laborPower: player.resources.laborPower - laborAmount,
                      };

                      // Add materials
                      const updatedRawMaterials = {
                        ...player.resources.rawMaterials,
                      };

                      for (const [material, amount] of Object.entries(
                        materialsGained
                      )) {
                        updatedRawMaterials[material] =
                          (updatedRawMaterials[material] || 0) + amount;
                      }

                      player.resources.rawMaterials = updatedRawMaterials;

                      return {
                        ...state,
                        players: {
                          ...state.players,
                          [state.currentPlayerId]: player,
                        },
                        actionPointsRemaining: state.actionPointsRemaining - 1,
                      };
                    },
                  },
                ];
              },
            });

            if (result) {
              const state = this.engine.getCurrentState();
              const event = state.players[state.currentPlayerId].resources;

              console.log('Sammeln abgeschlossen!');

              // Show what materials were gathered by comparing before and after
              for (const [material, amount] of Object.entries(
                event.rawMaterials
              )) {
                if (player.resources.rawMaterials[material] !== amount) {
                  const difference =
                    (amount || 0) -
                    (player.resources.rawMaterials[material] || 0);
                  if (difference > 0) {
                    console.log(`Du hast ${difference} ${material} gesammelt.`);
                  }
                }
              }
            } else {
              console.log('Die Aktion konnte nicht ausgeführt werden.');
            }

            this.waitForEnter(() => {
              this.showActionMenu();
            });
          }
        );
      }
    );
  }

  private showAcquirePropertyAction(): void {
    this.clearScreen();
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];

    console.log('=== POSTEN ERWERBEN ===');
    console.log(
      'Du kannst neue Besitztümer erwerben, wenn du genug Gold hast.'
    );
    console.log(`Aktuelles Gold: ${player.resources.gold}`);

    // For V1, offer a simple list of property types to acquire
    console.log('\nVerfügbare Besitztümer:');
    console.log('1. Kleine Ländliche Domäne (20 Gold)');
    console.log('2. Mittlere Ländliche Domäne (40 Gold)');
    console.log('3. Kleiner Städtischer Besitz (15 Gold)');
    console.log('4. Kleine Werkstatt (10 Gold)');
    console.log('5. Kleines Lager (8 Gold)');
    console.log('6. Kleines Amt (25 Gold)');

    this.rl.question(
      '\nWelches Besitztum möchtest du erwerben? (1-6, 0 zum Abbrechen): ',
      (choiceStr) => {
        const choice = Number.parseInt(choiceStr, 10);

        // Validate input
        if (Number.isNaN(choice) || choice < 0 || choice > 6) {
          console.log('Ungültige Eingabe.');
          this.showAcquirePropertyAction();
          return;
        }

        // Cancel action
        if (choice === 0) {
          console.log('Aktion abgebrochen.');
          this.showActionMenu();
          return;
        }

        // Map choice to property config key
        const propertyConfigKeys = [
          'SMALL_RURAL_DOMAIN',
          'MEDIUM_RURAL_DOMAIN',
          'SMALL_CITY_PROPERTY',
          'SMALL_WORKSHOP',
          'SMALL_STORAGE',
          'SMALL_OFFICE',
        ];

        const propertyCosts = [20, 40, 15, 10, 8, 25];

        const selectedKey = propertyConfigKeys[choice - 1];
        const cost = propertyCosts[choice - 1];

        // Check if player has enough gold
        if (player.resources.gold < cost) {
          console.log(
            `Du hast nicht genug Gold für dieses Besitztum. Du benötigst ${cost} Gold.`
          );
          this.waitForEnter(() => {
            this.showAcquirePropertyAction();
          });
          return;
        }

        // Execute command to acquire property
        const result = this.engine.executeCommand({
          type: 'ACQUIRE_PROPERTY',
          playerId: state.currentPlayerId,
          payload: {
            propertyConfigKey: selectedKey,
          },
          validate: (state) => {
            return (
              state.phase === 'action' &&
              state.actionPointsRemaining > 0 &&
              state.players[state.currentPlayerId].resources.gold >= cost
            );
          },
          execute: (state) => {
            // Create property instance from config
            const propertyConfig = PropertyTypes[selectedKey];
            const newPropertyId =
              Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

            const newProperty = {
              id: newPropertyId,
              name: propertyConfig.name,
              type: propertyConfig.type,
              size: propertyConfig.size,
              specialization: propertyConfig.specialization,
              active: propertyConfig.defaultActive || false,
              maintenanceCost: propertyConfig.maintenanceCost,
              baseProduction: propertyConfig.baseProduction,
              facilityIds: [],
              facilitySlots: propertyConfig.facilitySlots,
              dcModifiers: propertyConfig.dcModifiers,
              specialData: propertyConfig.specialData,
            };

            return [
              {
                id: Date.now().toString(),
                type: GameEventType.PROPERTY_ACQUIRED,
                timestamp: Date.now(),
                playerId: state.currentPlayerId,
                payload: {
                  property: newProperty,
                  cost: { gold: cost },
                },
                apply: (state) => {
                  const player = { ...state.players[state.currentPlayerId] };

                  // Update gold
                  player.resources = {
                    ...player.resources,
                    gold: player.resources.gold - cost,
                  };

                  // Add property to player's properties
                  player.propertyIds = [...player.propertyIds, newProperty.id];

                  return {
                    ...state,
                    players: {
                      ...state.players,
                      [state.currentPlayerId]: player,
                    },
                    properties: {
                      ...state.properties,
                      [newProperty.id]: newProperty,
                    },
                    actionPointsRemaining: state.actionPointsRemaining - 1,
                  };
                },
              },
            ];
          },
        });

        if (result) {
          console.log('Du hast ein neues Besitztum erworben!');
        } else {
          console.log('Die Aktion konnte nicht ausgeführt werden.');
        }

        this.waitForEnter(() => {
          this.showActionMenu();
        });
      }
    );
  }

  private showBuildFacilityAction(): void {
    this.clearScreen();
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];

    console.log('=== EINRICHTUNG AUSBAUEN ===');
    console.log('Du kannst Einrichtungen auf deinen Besitztümern ausbauen.');

    // Check if build action is available
    if (!state.facilityBuildActionAvailable) {
      console.log(
        'Du hast in dieser Runde bereits eine Einrichtung ausgebaut.'
      );
      this.waitForEnter(() => {
        this.showActionMenu();
      });
      return;
    }

    // Show properties to build on
    console.log('\nVerfügbare Besitztümer:');
    const activeProperties = player.propertyIds
      .map((id) => state.properties[id])
      .filter((p) => p?.active);

    if (activeProperties.length === 0) {
      console.log(
        'Du hast keine aktiven Besitztümer, auf denen du ausbauen kannst.'
      );
      this.waitForEnter(() => {
        this.showActionMenu();
      });
      return;
    }

    activeProperties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.name} (${property.type})`);
    });

    // Let user choose a property
    this.rl.question(
      '\nAuf welchem Besitztum möchtest du ausbauen? (Nummer, 0 zum Abbrechen): ',
      (choiceStr) => {
        const choice = Number.parseInt(choiceStr, 10);

        // Validate input
        if (
          Number.isNaN(choice) ||
          choice < 0 ||
          choice > activeProperties.length
        ) {
          console.log('Ungültige Eingabe.');
          this.showBuildFacilityAction();
          return;
        }

        // Cancel action
        if (choice === 0) {
          console.log('Aktion abgebrochen.');
          this.showActionMenu();
          return;
        }

        const selectedProperty = activeProperties[choice - 1];

        // For V1, show a simple list of available facilities
        console.log('\nVerfügbare Einrichtungen:');
        console.log('1. Erweiterte Arbeiterunterkünfte (5 Gold)');
        console.log('2. Kornspeicher (4 Gold)');
        console.log('3. Landgewinnung (4 Gold, 2 Arbeitskraft)');
        console.log(
          '4. Einfache Verteidigungsanlage (3 Gold, 3 Holz, 1 Arbeitskraft)'
        );
        console.log('5. Großer Oktaden-Schrein (8 Gold)');
        console.log('6. Marktplatz (16 Gold)');

        this.rl.question(
          '\nWelche Einrichtung möchtest du bauen? (1-6, 0 zum Abbrechen): ',
          (facilityChoiceStr) => {
            const facilityChoice = Number.parseInt(facilityChoiceStr, 10);

            // Validate input
            if (
              Number.isNaN(facilityChoice) ||
              facilityChoice < 0 ||
              facilityChoice > 6
            ) {
              console.log('Ungültige Eingabe.');
              this.waitForEnter(() => {
                this.showBuildFacilityAction();
              });
              return;
            }

            // Cancel action
            if (facilityChoice === 0) {
              console.log('Aktion abgebrochen.');
              this.showActionMenu();
              return;
            }

            // Map choice to facility config key
            const facilityConfigKeys = [
              'BASIC_HOUSING',
              'FOOD_STORAGE',
              'LAND_EXPANSION',
              'BASIC_DEFENSE',
              'OCTAD_SHRINE',
              'MARKETPLACE',
            ];

            const selectedFacilityKey = facilityConfigKeys[facilityChoice - 1];
            const facilityConfig = FacilityTypes[selectedFacilityKey];

            // Check if facility can be built on this property type
            if (
              facilityConfig.buildRequirements.propertyTypes &&
              !facilityConfig.buildRequirements.propertyTypes.includes(
                selectedProperty.type
              )
            ) {
              console.log(
                `Diese Einrichtung kann nicht auf einem ${selectedProperty.type} gebaut werden.`
              );
              this.waitForEnter(() => {
                this.showBuildFacilityAction();
              });
              return;
            }

            // Check resource requirements
            const resources = facilityConfig.buildRequirements.resources || {
              gold: 0,
              laborPower: 0,
              rawMaterials: {},
              specialMaterials: {},
            };
            let canBuild = true;
            const missingResources: string[] = [];

            if (resources.gold && player.resources.gold < resources.gold) {
              canBuild = false;
              missingResources.push(
                `${resources.gold - player.resources.gold} Gold`
              );
            }

            if (
              resources.laborPower &&
              player.resources.laborPower < resources.laborPower
            ) {
              canBuild = false;
              missingResources.push(
                `${resources.laborPower - player.resources.laborPower} Arbeitskraft`
              );
            }

            if (resources.rawMaterials) {
              for (const [material, amount] of Object.entries(
                resources.rawMaterials
              )) {
                const playerAmount =
                  player.resources.rawMaterials[
                    material as keyof typeof player.resources.rawMaterials
                  ] || 0;
                const amountNumber = amount as number;
                if (playerAmount < amountNumber) {
                  canBuild = false;
                  missingResources.push(
                    `${amountNumber - playerAmount} ${material}`
                  );
                }
              }
            }

            if (!canBuild) {
              console.log(
                `Du hast nicht genug Ressourcen für diese Einrichtung. Es fehlt: ${missingResources.join(', ')}`
              );
              this.waitForEnter(() => {
                this.showBuildFacilityAction();
              });
              return;
            }

            // Execute command to build facility
            const result = this.engine.executeCommand({
              type: 'BUILD_FACILITY',
              playerId: state.currentPlayerId,
              payload: {
                facilityConfigKey: selectedFacilityKey,
                propertyId: selectedProperty.id,
              },
              validate: (state) => {
                return (
                  state.phase === 'action' && state.facilityBuildActionAvailable
                );
              },
              execute: (state) => {
                // Create facility instance
                const newFacilityId =
                  Date.now().toString(36) +
                  Math.random().toString(36).substr(2, 5);

                const newFacility = {
                  id: newFacilityId,
                  name: facilityConfig.name,
                  type: facilityConfig.type,
                  description: facilityConfig.description,
                  category: facilityConfig.category,
                  buildRequirements: facilityConfig.buildRequirements,
                  maintenanceCost: facilityConfig.maintenanceCost,
                  effects: facilityConfig.effects,
                };

                return [
                  {
                    id: Date.now().toString(),
                    type: GameEventType.FACILITY_BUILT,
                    timestamp: Date.now(),
                    playerId: state.currentPlayerId,
                    payload: {
                      facility: newFacility,
                      propertyId: selectedProperty.id,
                      success: true,
                      resourceCosts: resources,
                    },
                    apply: (state) => {
                      const player = {
                        ...state.players[state.currentPlayerId],
                      };
                      const property = {
                        ...state.properties[selectedProperty.id],
                      };

                      // Update player resources
                      player.resources = {
                        ...player.resources,
                        gold: player.resources.gold - (resources.gold || 0),
                        laborPower:
                          player.resources.laborPower -
                          (resources.laborPower || 0),
                      };

                      // Update raw materials if needed
                      if (resources.rawMaterials) {
                        const updatedRawMaterials = {
                          ...player.resources.rawMaterials,
                        };

                        for (const [material, amount] of Object.entries(
                          resources.rawMaterials
                        )) {
                          const materialKey =
                            material as keyof typeof updatedRawMaterials;
                          const amountNumber = amount as number;
                          updatedRawMaterials[materialKey] =
                            (updatedRawMaterials[materialKey] || 0) -
                            amountNumber;
                        }

                        player.resources.rawMaterials = updatedRawMaterials;
                      }

                      // Add facility to property
                      property.facilityIds = [
                        ...property.facilityIds,
                        newFacility.id,
                      ];

                      return {
                        ...state,
                        players: {
                          ...state.players,
                          [state.currentPlayerId]: player,
                        },
                        properties: {
                          ...state.properties,
                          [selectedProperty.id]: property,
                        },
                        facilities: {
                          ...state.facilities,
                          [newFacility.id]: newFacility,
                        },
                        facilityBuildActionAvailable: false,
                      };
                    },
                  },
                ];
              },
            });

            if (result) {
              console.log(
                `Du hast eine neue Einrichtung gebaut: ${facilityConfig.name}`
              );
            } else {
              console.log('Die Aktion konnte nicht ausgeführt werden.');
            }

            this.showActionMenu();
          }
        );
      }
    );
  }

  // Helper method to wait for Enter
  private waitForEnter(callback: () => void): void {
    this.rl.question('Drücke Enter, um fortzufahren...', () => {
      this.clearScreen();
      callback();
    });
  }

  // Prompt to end the turn
  private promptEndTurn(): void {
    this.rl.question('Runde beenden? (j/n): ', (answer) => {
      if (answer.toLowerCase() === 'j') {
        this.clearScreen();
        this.endTurn();
      } else {
        this.clearScreen();
        this.showActionMenu();
      }
    });
  }

  // End the current turn
  private endTurn(): void {
    this.engine.advancePhase();
  }

  // Close the UI
  public close(): void {
    this.rl.close();
  }
}
