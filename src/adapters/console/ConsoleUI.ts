import * as readline from 'node:readline';
import { type GameEngine, GameEventType, GamePhase } from '../../core';
import type { GameEvent } from '../../core/events/GameEvent';
import { PropertyType } from '../../core/models/Property';
import { PlayerStrengthCalculator } from '../../core/utils';
import { DataLoader } from '../../core/utils';

import type {
  AcquirablePropertyType,
  AcquirePropertyCommand,
  AcquirePropertyCommandPayload,
  BuildFacilityCommand,
  BuildFacilityCommandPayload,
  BuildableFacilityType,
  GainInfluenceCommand,
  GainInfluenceCommandPayload,
  GatherMaterialsCommand,
  GatherMaterialsCommandPayload,
  LendMoneyCommand,
  LendMoneyCommandPayload,
  SellInvestmentUnit,
  SellMaterialsCommand,
  SellMaterialsCommandPayload,
} from '../../core/commands';
import type { AppCommand } from '../../core/engine/GameEngine';

const RAW_MATERIAL_SELL_BUNDLE_SIZE = 6;
const SPECIAL_MATERIAL_SELL_BUNDLE_SIZE = 1;

export class ConsoleUI {
  private engine: GameEngine;
  private rl: readline.Interface;
  private strengthCalculator: PlayerStrengthCalculator;
  private dataLoader: DataLoader;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.strengthCalculator = new PlayerStrengthCalculator();
    this.dataLoader = new DataLoader();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.engine.subscribe(this.handleGameEvent.bind(this));
  }

  public start(): void {
    this.clearScreen();
    this.showWelcome();
  }

  private log(message: string): void {
    console.log(message);
  }

  private prompt(question?: string, callback?: (answer: string) => void): void {
    if (question && callback) {
      this.rl.question(question, callback);
    } else {
      this.rl.prompt();
    }
  }

  private waitForEnter(callback: () => void): void {
    this.rl.question('Drücke Enter, um fortzufahren...', () => {
      callback();
    });
  }

  private handleGameEvent(event: GameEvent): void {
    this.log(`\nEVENT: ${event.type} for player ${event.playerId}`);
    // Simplified payload logging for brevity
    // if (event.payload && Object.keys(event.payload).length > 0) {
    //     this.log(`  Payload: ${JSON.stringify(event.payload)}`);
    // }

    switch (event.type) {
      case GameEventType.GAME_STARTED:
        this.displayGameInfo();
        this.showActionMenu();
        break;
      case GameEventType.PHASE_CHANGED: {
        this.displayGameInfo();
        const state = this.engine.getCurrentState();
        if (state.phase === GamePhase.ACTION) {
          this.showActionMenu();
        }
        break;
      }
      case GameEventType.MAINTENANCE_PERFORMED:
        this.log(
          `  Unterhalt bezahlt: ${event.payload.goldCost} Gold, ${event.payload.laborCost} Arbeitskraft`
        );
        this.displayGameInfo();
        break;
      case GameEventType.RESOURCES_PRODUCED:
        this.log('  Produktion abgeschlossen.');
        this.displayGameInfo();
        break;
      case GameEventType.RESOURCES_CONVERTED:
      case GameEventType.RESOURCES_AUTO_CONVERTED:
        this.log('  Ressourcen umgewandelt/verkauft.');
        this.displayGameInfo();
        break;
      case GameEventType.RESOURCES_RESET:
        this.log('  Ressourcen zurückgesetzt.');
        this.displayGameInfo();
        break;
      case GameEventType.INFLUENCE_GAINED:
        this.log(
          `  Einfluss gewonnen: ${event.payload.influenceGained} (Kosten: ${event.payload.goldSpent} Gold)`
        );
        this.displayGameInfo();
        break;
      case GameEventType.MATERIALS_SOLD:
        this.log(`  Materialien verkauft für ${event.payload.goldGained} Gold`);
        this.displayGameInfo();
        break;
      case GameEventType.MATERIALS_GATHERED: {
        this.log('  Materialien gesammelt:');
        const materials = event.payload.materialsGained as Record<
          string,
          number
        >;
        for (const [material, amount] of Object.entries(materials)) {
          this.log(`    ${material}: ${amount}`);
        }
        this.displayGameInfo();
        break;
      }
      case GameEventType.PROPERTY_ACQUIRED: {
        const property = event.payload.property as {
          name: string;
          type: string;
        };
        this.log(
          `  Neuer Besitz erworben: ${property.name} (${property.type})`
        );
        this.displayGameInfo();
        break;
      }
      case GameEventType.FACILITY_BUILT: {
        const facility = event.payload.facility as { name: string };
        this.log(`  Einrichtung gebaut: ${facility.name}`);
        this.displayGameInfo();
        break;
      }
      case GameEventType.GOLD_ADDED:
        this.log(
          `  Gold erhalten: ${event.payload.amount} (Quelle: ${event.payload.source})`
        );
        this.displayGameInfo();
        break;
      case GameEventType.GOLD_REMOVED:
        this.log(
          `  Goldverlust: ${event.payload.amount} (Quelle: ${event.payload.source})`
        );
        this.displayGameInfo();
        break;
      case GameEventType.ROUND_ADVANCED:
        this.log(`\nRunde ${event.payload.round} beginnt`);
        break;
      default:
        this.displayGameInfo();
    }
  }

  private showWelcome(): void {
    this.log('=== WILLKOMMEN ZU MYRANOR: STRATEGIESPIEL V1 ===');
    this.log(
      '\nIn diesem Spiel verwaltest du deine Ressourcen, baust dein Reich auf und triffst strategische Entscheidungen.'
    );
    this.log(
      'Du gewinnst, wenn du 30 Runden überstehst. Du verlierst, wenn dein Gold unter -20 fällt.\n'
    );
    this.promptForName();
  }

  private promptForName(): void {
    this.prompt('Wie ist dein Name? ', (_name) => {
      const playerId = 'player1';
      this.engine.startGame(playerId);
    });
  }

  private clearScreen(): void {
    console.clear();
  }

  private displayGameInfo(): void {
    this.clearScreen();
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    if (!player) {
      this.log('Spieler nicht gefunden. Lade...');
      return;
    }

    this.log(
      `=== RUNDE ${state.round} | PHASE: ${state.phase.toUpperCase()} ===`
    );
    this.log(`Spieler: ${player.name || state.currentPlayerId}`);
    this.log('---------------------------');
    this.log(`Gold: ${player.resources.gold}`);
    this.log(
      `Arbeitskraft: ${player.resources.laborPower}/${player.resources.baseLaborPower}`
    );
    this.log(
      `Einfluss: ${player.resources.temporaryInfluence} (temporär) + ${player.resources.permanentInfluence} (permanent) + ${player.resources.semiPermanentInfluenceBase || 0} (semi-permanent Basis)`
    );

    this.log('\nRohmaterialien:');
    const rawMaterials = player.resources.rawMaterials;
    if (Object.keys(rawMaterials).length === 0) this.log('  Keine Rohstoffe');
    else {
      for (const [material, amount] of Object.entries(rawMaterials)) {
        if (amount && amount > 0) this.log(`  ${material}: ${amount}`);
      }
    }

    this.log('\nSondermaterialien:');
    const specialMaterials = player.resources.specialMaterials;
    if (Object.keys(specialMaterials).length === 0)
      this.log('  Keine Sondermaterialien');
    else {
      for (const [material, amount] of Object.entries(specialMaterials)) {
        if (amount && amount > 0) this.log(`  ${material}: ${amount}`);
      }
    }

    this.log('\nBesitztümer:');
    if (player.propertyIds.length === 0) this.log('  Keine Besitztümer');
    else {
      for (const id of player.propertyIds) {
        const property = state.properties[id];
        if (property) {
          this.log(
            `  ${property.name} (${property.type}, ${property.size}) - ${property.active ? 'Aktiv' : 'Inaktiv'}`
          );
          for (const facId of property.facilityIds) {
            const facility = state.facilities[facId];
            if (facility) this.log(`    - ${facility.name}`);
          }
        }
      }
    }

    this.log(`\nAktionspunkte: ${state.actionPointsRemaining}`);
    this.log('---------------------------');
  }

  private showActionMenu(): void {
    const state = this.engine.getCurrentState();
    if (state.actionPointsRemaining <= 0 && state.phase === GamePhase.ACTION) {
      this.log('\nKeine Aktionspunkte mehr übrig in dieser Runde.');
      this.promptEndTurn();
      return;
    }

    this.log('\nWähle eine Aktion:');
    this.log('1. Einfluss gewinnen');
    this.log('2. Materialien verkaufen');
    this.log('3. Material gewinnen');
    this.log('4. Posten erwerben');
    this.log('5. Einrichtung bauen');
    this.log('6. Geld leihen');
    this.log('7. Runde beenden');

    this.prompt('\nDeine Wahl (1-7): ', (choice) => {
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
          this.showLendMoneyAction();
          break;
        case '7':
          this.endTurn();
          break;
        default:
          this.log('Ungültige Eingabe. Bitte wähle erneut.');
          this.showActionMenu();
      }
    });
  }

  private promptEndTurn(): void {
    this.prompt('Runde beenden? (j/n): ', (answer) => {
      if (answer.toLowerCase() === 'j') {
        this.endTurn();
      } else {
        this.showActionMenu();
      }
    });
  }

  private endTurn(): void {
    this.log('\nRunde wird beendet...');
    const state = this.engine.getCurrentState();
    if (state.phase === GamePhase.ACTION) {
      this.engine.advancePhase();
    } else {
      this.showActionMenu();
    }
  }

  private showGainInfluenceAction(): void {
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    if (!player) {
      this.log('Spieler nicht gefunden.');
      this.waitForEnter(() => this.showActionMenu());
      return;
    }

    this.log('\n=== EINFLUSS GEWINNEN ===');
    this.log('1. Temporären Einfluss gewinnen (1 Gold = 2 Einfluss)');
    this.log(
      '2. Semi-permanenten Einfluss gewinnen (Basis, kostet Aktionen & Gold)'
    );
    this.log('3. Abbrechen');

    this.prompt('Wähle eine Option (1-3): ', (choice) => {
      switch (choice) {
        case '1':
          this.promptTemporaryInfluence(player, state);
          break;
        case '2':
          this.promptSemiPermanentInfluence(player, state);
          break;
        case '3':
          this.showActionMenu();
          break;
        default:
          this.log('Ungültige Wahl.');
          this.waitForEnter(() => this.showGainInfluenceAction());
          break;
      }
    });
  }

  private promptTemporaryInfluence(
    player: (typeof this.engine.getCurrentState.prototype.players)[string],
    state: typeof this.engine.getCurrentState.prototype
  ): void {
    this.log('\n--- Temporärer Einfluss ---');
    this.log(`Aktuelles Gold: ${player.resources.gold}`);
    this.prompt(
      'Wie viel Gold möchtest du ausgeben? (0 zum Abbrechen): ',
      (amountStr) => {
        const goldAmount = Number.parseInt(amountStr, 10);
        if (Number.isNaN(goldAmount)) {
          this.log('Ungültige Eingabe.');
          this.waitForEnter(() => this.showGainInfluenceAction());
          return;
        }
        if (goldAmount <= 0) {
          this.log('Aktion abgebrochen.');
          this.showActionMenu();
          return;
        }

        const commandPayload: GainInfluenceCommandPayload = {
          influenceType: 'temporary',
          goldAmount,
        };
        const commandToExecute: GainInfluenceCommand = {
          type: 'GAIN_INFLUENCE',
          playerId: state.currentPlayerId,
          payload: commandPayload,
        };
        if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
          this.log(
            'Temporärer Einflussgewinn fehlgeschlagen (Validierung oder anderer Fehler).'
          );
        }
        this.waitForEnter(() => this.showActionMenu());
      }
    );
  }

  private promptSemiPermanentInfluence(
    player: (typeof this.engine.getCurrentState.prototype.players)[string],
    state: typeof this.engine.getCurrentState.prototype
  ): void {
    this.log('\n--- Semi-permanenter Einfluss ---');
    const offices = player.propertyIds
      .map((id) => state.properties[id])
      .filter((p) => p?.active && p.type === PropertyType.OFFICE);

    if (offices.length === 0) {
      this.log(
        'Du besitzt keine aktiven Ämter, um semi-permanenten Einfluss zu gewinnen.'
      );
      this.waitForEnter(() => this.showActionMenu());
      return;
    }

    this.log('Wähle ein Amt für den Einflussgewinn:');
    offices.forEach((office, index) => {
      if (office) {
        const gainedThisRound =
          player.influenceGainedThisRound?.semiPermanentPerOffice?.[
            office.id
          ] || 0;
        this.log(
          `${index + 1}. ${office.name} (bereits ${gainedThisRound}/2 Basispunkte diese Runde gewonnen)`
        );
      }
    });
    this.log(`${offices.length + 1}. Abbrechen`);

    this.prompt('Nummer des Amtes: ', (officeChoiceStr) => {
      const officeIndex = Number.parseInt(officeChoiceStr, 10) - 1;
      if (
        Number.isNaN(officeIndex) ||
        officeIndex < 0 ||
        officeIndex >= offices.length
      ) {
        if (officeIndex === offices.length) {
          // Abbrechen
          this.showActionMenu();
          return;
        }
        this.log('Ungültige Wahl.');
        this.waitForEnter(() =>
          this.promptSemiPermanentInfluence(player, state)
        );
        return;
      }

      const selectedOffice = offices[officeIndex];
      if (!selectedOffice) {
        this.log('Fehler bei der Auswahl des Amtes.');
        this.waitForEnter(() => this.showActionMenu());
        return;
      }

      const targetOfficeId = selectedOffice.id;
      const alreadyGainedBase =
        player.influenceGainedThisRound?.semiPermanentPerOffice?.[
          targetOfficeId
        ] || 0;
      const maxBaseGainThisAction = 2 - alreadyGainedBase;

      if (maxBaseGainThisAction <= 0) {
        this.log(
          `Für ${selectedOffice.name} können diese Runde keine weiteren Basispunkte für semi-permanenten Einfluss gewonnen werden.`
        );
        this.waitForEnter(() => this.showActionMenu());
        return;
      }

      this.log(
        `Du kannst noch ${maxBaseGainThisAction} Basispunkt(e) für ${selectedOffice.name} diese Runde investieren.`
      );
      this.log(
        'Kosten: 3 Gold pro Investment-Einheit. Jede Einheit gibt 1 Basispunkt (vor Bonus).'
      );
      this.prompt(
        `Anzahl Investment-Einheiten (1 oder 2, max ${maxBaseGainThisAction}): `,
        (unitsStr) => {
          const investmentUnits = Number.parseInt(unitsStr, 10);
          if (
            Number.isNaN(investmentUnits) ||
            investmentUnits <= 0 ||
            investmentUnits > 2 ||
            investmentUnits > maxBaseGainThisAction
          ) {
            this.log('Ungültige Anzahl an Investment-Einheiten.');
            this.waitForEnter(() =>
              this.promptSemiPermanentInfluence(player, state)
            );
            return;
          }

          const commandPayload: GainInfluenceCommandPayload = {
            influenceType: 'semiPermanent',
            targetOfficeId,
            investmentUnits,
          };
          const commandToExecute: GainInfluenceCommand = {
            type: 'GAIN_INFLUENCE',
            playerId: state.currentPlayerId,
            payload: commandPayload,
          };

          if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
            this.log(
              'Semi-permanenter Einflussgewinn fehlgeschlagen (Validierung oder anderer Fehler).'
            );
          }
          this.waitForEnter(() => this.showActionMenu());
        }
      );
    });
  }

  private showSellMaterialsAction(): void {
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    this.log('\n=== MATERIALIEN VERKAUFEN ===');
    this.log(
      `Verfügbare Rohmaterialien: ${JSON.stringify(player.resources.rawMaterials)}`
    );
    this.log(
      `Verfügbare Sondermaterialien: ${JSON.stringify(player.resources.specialMaterials)}`
    );

    this.prompt(
      'Welches Material (Typ:id, z.B. raw:wood oder special:tools): ',
      (matTypeAndId) => {
        const [typeStr, materialId] = matTypeAndId.split(':');
        if (!materialId || (typeStr !== 'raw' && typeStr !== 'special')) {
          this.log('Ungültige Materialeingabe (Format: typ:materialId).');
          this.waitForEnter(() => this.showSellMaterialsAction());
          return;
        }
        const materialTypeValidated: 'rawMaterial' | 'specialMaterial' =
          typeStr === 'raw' ? 'rawMaterial' : 'specialMaterial';

        this.prompt(`Menge von ${materialId} zu verkaufen: `, (amountStr) => {
          const amount = Number.parseInt(amountStr, 10);
          if (Number.isNaN(amount) || amount <= 0) {
            this.log('Ungültige Menge.');
            this.waitForEnter(() => this.showSellMaterialsAction());
            return;
          }

          const investmentUnits: SellInvestmentUnit[] = [];
          if (materialTypeValidated === 'rawMaterial') {
            if (amount % RAW_MATERIAL_SELL_BUNDLE_SIZE !== 0) {
              this.log(
                `Rohmaterialien müssen in Bündeln von ${RAW_MATERIAL_SELL_BUNDLE_SIZE} verkauft werden.`
              );
              this.waitForEnter(() => this.showSellMaterialsAction());
              return;
            }
            const numBundles = amount / RAW_MATERIAL_SELL_BUNDLE_SIZE;
            for (let i = 0; i < numBundles; i++) {
              investmentUnits.push({
                type: 'rawMaterial',
                materialId,
                count: RAW_MATERIAL_SELL_BUNDLE_SIZE,
              });
            }
          } else {
            if (amount % SPECIAL_MATERIAL_SELL_BUNDLE_SIZE !== 0) {
              this.log(
                `Sondermaterialien müssen in Bündeln von ${SPECIAL_MATERIAL_SELL_BUNDLE_SIZE} verkauft werden.`
              );
              this.waitForEnter(() => this.showSellMaterialsAction());
              return;
            }
            const numBundles = amount / SPECIAL_MATERIAL_SELL_BUNDLE_SIZE;
            for (let i = 0; i < numBundles; i++) {
              investmentUnits.push({
                type: 'specialMaterial',
                materialId,
                count: SPECIAL_MATERIAL_SELL_BUNDLE_SIZE,
              });
            }
          }

          if (investmentUnits.length === 0) {
            this.log('Keine gültigen Verkaufseinheiten erstellt.');
            this.waitForEnter(() => this.showActionMenu());
            return;
          }

          const commandPayload: SellMaterialsCommandPayload = {
            investments: investmentUnits,
          };
          const commandToExecute: SellMaterialsCommand = {
            type: 'SELL_MATERIALS',
            playerId: state.currentPlayerId,
            payload: commandPayload,
          };

          if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
            this.log(
              'Materialverkauf fehlgeschlagen (Validierung oder anderer Fehler).'
            );
          }
          this.waitForEnter(() => this.showActionMenu());
        });
      }
    );
  }

  private showGatherMaterialsAction(): void {
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    this.log('\n=== MATERIAL GEWINNEN ===');

    const gatherableProperties = player.propertyIds
      .map((id) => state.properties[id])
      .filter(
        (p) =>
          p?.active &&
          (p.type === PropertyType.DOMAIN ||
            p.type === PropertyType.CITY_PROPERTY)
      );

    if (gatherableProperties.length === 0) {
      this.log('Keine geeigneten Besitztümer für Materialgewinn.');
      this.waitForEnter(() => this.showActionMenu());
      return;
    }
    this.log('Wähle ein Besitztum für Materialgewinn:');
    for (const [i, p] of gatherableProperties.entries()) {
      if (p) this.log(`${i + 1}. ${p.name} (${p.type})`);
    }
    this.log(`${gatherableProperties.length + 1}. Abbrechen`);

    this.prompt('Nummer des Besitztums: ', (propChoiceStr) => {
      const propIndex = Number.parseInt(propChoiceStr, 10) - 1;
      if (
        Number.isNaN(propIndex) ||
        propIndex < 0 ||
        propIndex > gatherableProperties.length
      ) {
        this.log('Ungültige Wahl.');
        this.waitForEnter(() => this.showGatherMaterialsAction());
        return;
      }
      if (propIndex === gatherableProperties.length) {
        this.showActionMenu();
        return;
      }
      const selectedProperty = gatherableProperties[propIndex];
      if (!selectedProperty) {
        this.log('Fehler bei der Auswahl des Besitztums.');
        this.waitForEnter(() => this.showActionMenu());
        return;
      }

      this.prompt(
        `Wie viel Arbeitskraft einsetzen (Max ${player.resources.laborPower}): `,
        (laborStr) => {
          const laborAmount = Number.parseInt(laborStr, 10);
          if (
            Number.isNaN(laborAmount) ||
            laborAmount <= 0 ||
            laborAmount > player.resources.laborPower
          ) {
            this.log('Ungültige Arbeitskraftmenge.');
            this.waitForEnter(() => this.showGatherMaterialsAction());
            return;
          }

          const commandPayload: GatherMaterialsCommandPayload = {
            propertyId: selectedProperty.id,
            laborAmount,
          };
          const commandToExecute: GatherMaterialsCommand = {
            type: 'GATHER_MATERIALS',
            playerId: state.currentPlayerId,
            payload: commandPayload,
          };
          if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
            this.log(
              'Materialgewinn fehlgeschlagen (Validierung oder anderer Fehler).'
            );
          }
          this.waitForEnter(() => this.showActionMenu());
        }
      );
    });
  }

  private showAcquirePropertyAction(): void {
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    this.log('\n=== POSTEN ERWERBEN ===');
    this.log(`Aktuelles Gold: ${player.resources.gold}`);

    const acquirable: {
      name: string;
      key: AcquirablePropertyType;
      cost: number;
    }[] = [
      { name: 'Kleine Ländliche Domäne', key: 'SMALL_RURAL_DOMAIN', cost: 20 },
      {
        name: 'Mittlere Ländliche Domäne',
        key: 'MEDIUM_RURAL_DOMAIN',
        cost: 40,
      },
      {
        name: 'Kleiner Städtischer Besitz',
        key: 'SMALL_CITY_PROPERTY',
        cost: 15,
      },
      { name: 'Kleine Werkstatt', key: 'SMALL_WORKSHOP', cost: 10 },
      { name: 'Kleines Lager', key: 'SMALL_STORAGE', cost: 8 },
      { name: 'Kleines Amt', key: 'SMALL_OFFICE', cost: 25 },
    ];

    for (const [i, item] of acquirable.entries()) {
      this.log(`${i + 1}. ${item.name} (${item.cost} Gold)`);
    }
    this.log(`${acquirable.length + 1}. Abbrechen`);

    this.prompt('Deine Wahl: ', (choiceStr) => {
      const choice = Number.parseInt(choiceStr, 10) - 1;
      if (Number.isNaN(choice) || choice < 0 || choice > acquirable.length) {
        this.log('Ungültige Wahl.');
        this.waitForEnter(() => this.showAcquirePropertyAction());
        return;
      }
      if (choice === acquirable.length) {
        this.showActionMenu();
        return;
      }

      const selectedPropertyToAcquire = acquirable[choice];

      const commandPayload: AcquirePropertyCommandPayload = {
        propertyConfigKey: selectedPropertyToAcquire.key,
      };
      const commandToExecute: AcquirePropertyCommand = {
        type: 'ACQUIRE_PROPERTY',
        playerId: state.currentPlayerId,
        payload: commandPayload,
      };

      if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
        this.log(
          'Besitzerwerb fehlgeschlagen (Validierung oder anderer Fehler).'
        );
      }
      this.waitForEnter(() => this.showActionMenu());
    });
  }

  private showBuildFacilityAction(): void {
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    this.log('\n=== EINRICHTUNG BAUEN ===');

    if (!state.facilityBuildActionAvailable) {
      this.log(
        'Du hast diese Runde bereits eine Einrichtung gebaut/ausgebaut.'
      );
      this.waitForEnter(() => this.showActionMenu());
      return;
    }

    const buildableProperties = player.propertyIds
      .map((id) => state.properties[id])
      .filter(
        (p) =>
          p?.active &&
          (p.facilitySlots.general > 0 ||
            p.facilitySlots.specialized > 0 ||
            (p.facilitySlots.workshop || 0) > 0 ||
            (p.facilitySlots.warehouse || 0) > 0)
      );

    if (buildableProperties.length === 0) {
      this.log('Keine Besitztümer mit freien Einrichtungsslots.');
      this.waitForEnter(() => this.showActionMenu());
      return;
    }

    this.log('Wähle ein Besitztum für den Bau:');
    for (const [i, p] of buildableProperties.entries()) {
      if (p) this.log(`${i + 1}. ${p.name}`);
    }
    this.log(`${buildableProperties.length + 1}. Abbrechen`);

    this.prompt('Nummer des Besitztums: ', (propChoiceStr) => {
      const propIndex = Number.parseInt(propChoiceStr, 10) - 1;
      if (
        Number.isNaN(propIndex) ||
        propIndex < 0 ||
        propIndex > buildableProperties.length
      ) {
        this.log('Ungültige Wahl.');
        this.waitForEnter(() => this.showBuildFacilityAction());
        return;
      }
      if (propIndex === buildableProperties.length) {
        this.showActionMenu();
        return;
      }
      const selectedProperty = buildableProperties[propIndex];
      if (!selectedProperty) {
        this.log('Fehler: Besitztum nicht gefunden.');
        this.waitForEnter(() => this.showActionMenu());
        return;
      }

      // This list should align with the imported BuildableFacilityType
      const buildableFacilities: {
        name: string;
        key: BuildableFacilityType;
        cost: number;
      }[] = [
        {
          name: 'Erweiterte Arbeiterunterkünfte',
          key: 'BASIC_HOUSING',
          cost: 5,
        },
        { name: 'Kornspeicher', key: 'FOOD_STORAGE', cost: 4 },
        { name: 'Landgewinnung', key: 'LAND_EXPANSION', cost: 4 },
        {
          name: 'Einfache Verteidigungsanlagen',
          key: 'BASIC_DEFENSE',
          cost: 3,
        },
        { name: 'Großer Oktaden-Schrein', key: 'OCTAD_SHRINE', cost: 8 },
        { name: 'Marktplatz und Handelsposten', key: 'MARKETPLACE', cost: 16 },
        // Ensure 'MECHANICAL_MILL' and 'DAIRY' are part of BuildableFacilityType if listed here
      ];
      this.log('\nWähle eine Einrichtung zum Bauen:');
      for (const [i, f] of buildableFacilities.entries()) {
        this.log(`${i + 1}. ${f.name} (${f.cost} Gold)`);
      }
      this.log(`${buildableFacilities.length + 1}. Abbrechen`);

      this.prompt('Nummer der Einrichtung: ', (facChoiceStr) => {
        const facIndex = Number.parseInt(facChoiceStr, 10) - 1;
        if (
          Number.isNaN(facIndex) ||
          facIndex < 0 ||
          facIndex > buildableFacilities.length
        ) {
          this.log('Ungültige Wahl.');
          this.waitForEnter(() => this.showBuildFacilityAction());
          return;
        }
        if (facIndex === buildableFacilities.length) {
          this.showActionMenu();
          return;
        }
        const selectedFacilityToBuild = buildableFacilities[facIndex];

        const commandPayload: BuildFacilityCommandPayload = {
          facilityConfigKey: selectedFacilityToBuild.key,
          propertyId: selectedProperty.id,
        };
        const commandToExecute: BuildFacilityCommand = {
          type: 'BUILD_FACILITY',
          playerId: state.currentPlayerId,
          payload: commandPayload,
        };

        if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
          this.log(
            'Einrichtungsbau fehlgeschlagen (Validierung oder anderer Fehler).'
          );
        }
        this.waitForEnter(() => this.showActionMenu());
      });
    });
  }

  private showLendMoneyAction(): void {
    const state = this.engine.getCurrentState();
    const player = state.players[state.currentPlayerId];
    this.log('\n=== GELD LEIHEN (AKTION) ===');
    this.log('Investiere je 2 Gold, erhalte 5 Gold pro Investment (Basis).');
    this.log(`Aktuelles Gold: ${player.resources.gold}`);

    this.prompt('Anzahl der Investments (je 2 Gold): ', (investmentsStr) => {
      const investments = Number.parseInt(investmentsStr, 10);
      if (Number.isNaN(investments) || investments <= 0) {
        this.log('Ungültige Anzahl.');
        this.waitForEnter(() => this.showLendMoneyAction());
        return;
      }

      const commandPayload: LendMoneyCommandPayload = { investments };
      const commandToExecute: LendMoneyCommand = {
        type: 'LEND_MONEY',
        playerId: state.currentPlayerId,
        payload: commandPayload,
      };

      if (!this.engine.executeCommand(commandToExecute as AppCommand)) {
        this.log(
          'Geld leihen fehlgeschlagen (Validierung oder anderer Fehler).'
        );
      }
      this.waitForEnter(() => this.showActionMenu());
    });
  }

  public close(): void {
    // Renamed from stop()
    this.rl.close();
  }
}
