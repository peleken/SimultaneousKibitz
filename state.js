/*
 * state.js
 *
 * Everything here is DATA: what the current situation IS, not what's
 * allowed to happen to it. No method in this file decides whether a
 * move is legal, resolves a battle, or grows a population -- that's
 * rules.js. This file only holds, copies, and serializes state.
 *
 * Keeping this boundary strict is what makes save/load, undo, and
 * "simulate a hypothetical turn on a cloned state" possible later
 * without rewriting anything here.
 */

export class Player {
    constructor(id, name, color, score) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.score = score;
        this.civilianRatio = 0.5;
        this.isEliminated = false;
    }
}

export class TilePopulation {
    constructor(ownerId = null, civilians = 0, soldiers = 0, babies = 0) {
        this.ownerId = ownerId;
        this.civilians = civilians;
        this.soldiers = soldiers;
        this.babies = babies;
    }
}

export class GameLog {
    constructor() {
        this.entries = [];
    }

    add(message, visibleTo = [], type = "default") {
        this.entries.push({ message, visibleTo, type, turn: this.entries.length });
    }

    getPlayerLog(playerId) {
        return this.entries.filter(e => !e.visibleTo.length || e.visibleTo.includes(playerId));
    }

    clear() {
        this.entries = [];
    }
}

// A GameLog with the same interface that discards everything it's given.
// Intended for headless/simulated turns (e.g. an AI trying out hypothetical
// moves) where you want resolveTurn() to run exactly as normal but don't
// want narrative log entries generated for every trial.
export class NullGameLog {
    add() {}
    getPlayerLog() { return []; }
    clear() {}
}

export class GameState {
    constructor(players = [], population = new Map(), turn = 0) {
        this.players = players;
        this.population = population;
        this.turn = turn;
        this.isGameOver = false;
        this.winnerId = null;
    }

    getPlayerById(id) {
        return this.players.find(p => p.id === id);
    }

    clone() {
        const players = this.players.map(p => {
            const copy = new Player(p.id, p.name, p.color, p.score);
            copy.civilianRatio = p.civilianRatio;
            copy.isEliminated = p.isEliminated;
            return copy;
        });

        const population = new Map();

        for (const [key, pop] of this.population) {
            population.set(
                key,
                new TilePopulation(
                    pop.ownerId,
                    pop.civilians,
                    pop.soldiers,
                    pop.babies
                )
            );
        }

        const newState = new GameState(players, population, this.turn);
        newState.isGameOver = this.isGameOver;
        newState.winnerId = this.winnerId;
        return newState;
    }

    serialize() {
        return {
            turn: this.turn,
            isGameOver: this.isGameOver,
            winnerId: this.winnerId,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                score: p.score,
                civilianRatio: p.civilianRatio,
                isEliminated: p.isEliminated
            })),
            population: Object.fromEntries(
                [...this.population.entries()].map(([key, pop]) => [
                    key,
                    {
                        ownerId: pop.ownerId,
                        civilians: pop.civilians,
                        soldiers: pop.soldiers,
                        babies: pop.babies
                    }
                ])
            )
        };
    }
}
