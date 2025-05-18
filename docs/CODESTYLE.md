# Myranor Code Style Guide

This document outlines the coding standards and patterns observed in the Myranor project codebase. Follow these guidelines to maintain consistency across the project.

## TypeScript Patterns

### 1. File & Directory Structure

- **Modular Architecture**: Use a domain-driven design with clear separation of concerns
- **File naming**: Use camelCase for files (`idGenerator.ts`) and PascalCase for class/interface files (`GameEngine.ts`)
- **Barrel Files**: Use index.ts barrel files for clean imports (`export * from './idGenerator'`)
- **Directory Structure**:
  - `src/core`: Business logic independent of UI
  - `src/adapters`: Interface-specific implementations
  - `src/utils`: Shared utility functions

### 2. Types & Interfaces

- **Strict Typing**: Prefer explicit types over `any`
- **Exported Types**: Always prefix with `export type` for clarity
- **Interface Naming**: Use PascalCase for interfaces (`GameState`)
- **Enums**: Use PascalCase for enum names and UPPER_CASE for enum values
- **Record Types**: Use `Record<string, T>` over index signatures
- **Discriminated Unions**: Use for type-safe handling of different variants (example: event payloads)
- **Generics**: Use for reusable components with type safety

### 3. Functions & Methods

- **Function Signatures**: Include return types for public functions
- **Named Functions**: Prefer named functions over anonymous functions
- **Pure Functions**: Keep functions pure where possible
- **Arrow Functions**: Use for callbacks and event handlers
- **Early Returns**: Use early returns for validation logic
- **Default Parameters**: Use for optional parameters with common values

### 4. Class Structure

- **Private/Public**: Mark methods and properties as private/public explicitly
- **Method Order**: Group methods by functionality, with similar methods adjacent
- **Constructor First**: Place constructor at the top of the class
- **Interface Implementation**: Implement interfaces explicitly
- **Event Handlers**: Use the `handleEventName` pattern for event handlers

### 5. State Management

- **Immutability**: Use immutable patterns for state updates
- **Spread Operator**: Use to create new objects with updated properties
- **Event Sourcing**: Use events to describe state changes
- **Command Pattern**: Validate commands before execution
- **Single Source of Truth**: Maintain one source of truth for state

### 6. Code Style

- **Double Quotes**: Use double quotes for strings
- **Trailing Commas**: Include trailing commas in multi-line objects and arrays
- **Semicolons**: Include semicolons at the end of statements
- **Indentation**: Use 2 spaces for indentation
- **Line Length**: Keep lines under 80 characters when possible
- **Type Assertions**: Use `as` syntax for type assertions
- **Optional Chaining**: Use `?.` for nullable object access
- **Nullish Coalescing**: Use `??` for default values

### 7. Comments & Documentation

- **JSDoc Comments**: Use for public APIs and complex functions
- **TODO Comments**: Mark incomplete code with `// TODO:`
- **Code Section Comments**: Use comments to separate logical sections
- **Type Comments**: Comment complex type definitions
- **Implementation Comments**: Include for non-obvious logic

### 8. Specific Patterns

- **Event Handling**:
  ```typescript
  handleGameEvent(event: GameEvent): void {
    switch (event.type) {
      case GameEventType.GAME_STARTED:
        // Handle event
        break;
    }
  }
  ```

- **State Updates**:
  ```typescript
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: player,
    },
  };
  ```

- **Command Execution**:
  ```typescript
  executeCommand(command: GameCommand): boolean {
    if (!command.validate(currentState)) {
      return false;
    }
    const events = command.execute(currentState);
    // Process events
    return true;
  }
  ```

### 9. UI Guidelines (Console)

- **Clear Screen**: Always clear the screen before displaying a new menu or significant information
- **Consistent Headers**: Use a consistent format for section headers (e.g., `=== SECTION NAME ===`)
- **User Prompts**: Provide clear instructions for user input
- **Input Validation**: Always validate user input before processing
- **Feedback**: Provide feedback for user actions
- **Wait for Enter**: Use the `waitForEnter` pattern for pausing between screens
- **Error Messages**: Format error messages distinctly
- **Navigation Clarity**: Make navigation options obvious (numbers, back options)

### 10. Testing Guidelines

- **Unit Tests**: Write tests for core business logic
- **Test Naming**: Use descriptive test names following `should_expectedBehavior_when_condition`
- **Test Structure**: Use Arrange-Act-Assert pattern
- **Mock Dependencies**: Mock external dependencies in unit tests
- **Test Coverage**: Aim for high test coverage of core logic

## Console User Interface

When implementing console-based interfaces:

1. **Clear the Screen Properly**:
   - Call `clearScreen()` before displaying new menus or significant information
   - Ensure the user always sees relevant information without scrolling
   - Clear after waiting for user confirmation (after `waitForEnter`)

2. **Structured Display**:
   - Use consistent section headers
   - Format information with proper spacing and alignment
   - Group related information together

3. **User Interaction Flow**:
   - Always provide clear navigation options
   - Validate all user input
   - Provide feedback for actions
   - Use `waitForEnter` for user-paced interaction

Follow these patterns to maintain a consistent, maintainable, and effective codebase.
