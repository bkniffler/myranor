import { startConsoleApp } from './adapters/console';

// Start the console version by default
startConsoleApp();

// To support future frontend implementations, we could export the core directly
export * from './core';
