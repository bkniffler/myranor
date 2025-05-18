src/
├── core/                   # Game core logic (framework/UI-agnostic)
│   ├── commands/           # Command objects representing user actions
│   │   ├── index.ts        # Exports all commands
│   │   ├── GainInfluenceCommand.ts
│   │   ├── SellMaterialsCommand.ts
│   │   ├── GatherMaterialsCommand.ts
│   │   └── AcquirePropertyCommand.ts
│   │
│   ├── events/             # Events that occur as a result of commands
│   │   ├── index.ts        # Exports all events
│   │   ├── InfluenceGainedEvent.ts
│   │   ├── MaterialsSoldEvent.ts
│   │   ├── MaterialsGatheredEvent.ts
│   │   ├── PropertyAcquiredEvent.ts
│   │   ├── MaintenancePerformedEvent.ts
│   │   ├── ResourcesProducedEvent.ts
│   │   └── RoundAdvancedEvent.ts
│   │
│   ├── models/             # Domain models and types
│   │   ├── index.ts
│   │   ├── GameState.ts    # Current state representation
│   │   ├── Player.ts
│   │   ├── Resources.ts
│   │   ├── Property.ts     # Base property interface
│   │   ├── Domain.ts
│   │   ├── Workshop.ts
│   │   └── Storage.ts
│   │
│   ├── handlers/           # Command/event handlers
│   │   ├── index.ts
│   │   ├── CommandHandler.ts  # Base handler interface
│   │   ├── ActionCommandHandlers.ts
│   │   ├── PropertyCommandHandlers.ts
│   │   └── PhaseHandlers.ts   # Game phase logic
│   │
│   ├── store/              # Event store and state management
│   │   ├── EventStore.ts   # Stores all game events
│   │   ├── GameEngine.ts   # Main game logic orchestrator
│   │   └── StateReducer.ts # Applies events to produce new state
│   │
│   └── config/             # Game configuration
│       ├── GameConfig.ts   # Game constants and formulas
│       ├── PropertyTypes.ts # Available property definitions
│       └── InitialState.ts # Starting game configuration
│
├── adapters/               # Interface adapters for different platforms
│   ├── console/            # Console interface
│   │   ├── index.ts        # Entry point for console app
│   │   ├── ConsoleUI.ts    # Console rendering
│   │   ├── ConsoleInput.ts # Input handling
│   │   └── ConsoleGame.ts  # Console-specific game controller
│   │
│   ├── api/                # API interface for backend
│   │   ├── index.ts
│   │   ├── routes.ts       # API endpoints
│   │   └── controllers.ts  # API controllers
│   │
│   └── react/              # React interface helpers (optional)
│       ├── index.ts
│       ├── hooks.ts        # React hooks for game state
│       └── GameContext.ts  # React context
│
└── utils/                  # Shared utilities
    ├── logger.ts           # Logging functionality
    ├── random.ts           # Random number generation
    └── validation.ts       # Input validation helpers