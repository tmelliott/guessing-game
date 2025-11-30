// TypeScript wrapper for the JavaScript game state module
// This allows API routes to use the in-memory game state

const gameStateModule = require('./game-state-server.js');

export function createGame(topic: string): { code: string; hostToken: string } {
  return gameStateModule.createGame(topic);
}

export function getGame(code: string) {
  return gameStateModule.getGame(code);
}

export function verifyHostToken(code: string, token: string): boolean {
  return gameStateModule.verifyHostToken(code, token);
}

export function addPlayer(code: string, name: string, token?: string): { playerId: string; token: string } {
  return gameStateModule.addPlayer(code, name, token);
}

export function getPlayer(code: string, token: string) {
  return gameStateModule.getPlayer(code, token);
}

export function addPhoto(code: string, playerToken: string, url: string, name: string): void {
  return gameStateModule.addPhoto(code, playerToken, url, name);
}

export function startQuestion(code: string, photoIndex: number): void {
  return gameStateModule.startQuestion(code, photoIndex);
}

export function submitAnswer(code: string, playerToken: string, answer: string): void {
  return gameStateModule.submitAnswer(code, playerToken, answer);
}

export function revealAnswer(code: string): void {
  return gameStateModule.revealAnswer(code);
}

export function getAnswerStatus(code: string): { total: number; answered: number; waitingFor: string[] } {
  return gameStateModule.getAnswerStatus(code);
}

export function deleteGame(code: string): void {
  return gameStateModule.deleteGame(code);
}

