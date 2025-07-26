// Jest setup file to silence console logs during tests
// This file runs before each test file

// Silence console.log, console.warn, and console.error during tests
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Silence all console output during tests
// console.log = () => {};
// console.warn = () => {};
// console.error = () => {};

// Alternative: Keep errors for debugging but silence logs and warnings
// console.log = () => {};
// console.warn = () => {};
// // console.error remains active for debugging 