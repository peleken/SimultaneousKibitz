import { describe, test, it, expect, beforeEach } from 'vitest';
import { TurnResolver } from './resolution.js';
import { GameState, Player, TilePopulation } from './state.js';
import { HexBoard, tileKey } from './geometry.js';

// Deterministic mock RNG returning fixed sequence
function createMockRng(values) {
    let index = 0;
    return () => values[index++ % values.length];
}

describe('TurnResolver', () => {
    let board;
    
    beforeEach(() => {
        board = new HexBoard(2);
    });

    test('resolves reciprocal edge battle correctly', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 5, 0)], // Player 1: 5 soldiers
            [tileKey(1, 0), new TilePopulation(2, 0, 3, 0)]  // Player 2: 3 soldiers
        ]);
        const state = new GameState([new Player(1, "P1"), new Player(2, "P2")], population, 1);

        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 5 }],
            2: [{ playerId: 2, type: "moveSoldiers", from: tileKey(1, 0), to: tileKey(0, 0), amount: 3 }]
        };

        // Inject deterministic RNG favoring P1
        const resolver = new TurnResolver();
        resolver.combat.random = createMockRng([0.9, 0.1]); // High for P1, low for P2

        const result = resolver.resolve(state, orders);
        
        // P1 wins edge battle and advances to destination (1,0)
        const destTile = result.state.population.get(tileKey(1, 0));
        expect(destTile.ownerId).toBe(1);
        expect(destTile.soldiers).toBeGreaterThan(0);
    });

    test('handles attacker entering a tile whose defender is simultaneously vacating', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 3, 0)], // P1 at (0,0)
            [tileKey(1, 0), new TilePopulation(2, 0, 3, 0)], // P2 at (1,0)
            [tileKey(2, 0), new TilePopulation(2, 0, 0, 0)]  // Empty friendly P2 tile
        ]);
        const state = new GameState([new Player(1, "P1"), new Player(2, "P2")], population, 1);

        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 3 }],
            2: [{ playerId: 2, type: "moveSoldiers", from: tileKey(1, 0), to: tileKey(2, 0), amount: 3 }]
        };

        const resolver = new TurnResolver();
        const result = resolver.resolve(state, orders);

        // (1,0) was vacated before P1 arrived; P1 captures without combat on (1,0)
        expect(result.state.population.get(tileKey(1, 0)).ownerId).toBe(1);
        expect(result.state.population.get(tileKey(1, 0)).soldiers).toBe(3);
        expect(result.state.population.get(tileKey(2, 0)).soldiers).toBe(3);
    });

    test('wipes civilians and babies upon tile loss', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 5, 0)], // P1 attacker
            [tileKey(1, 0), new TilePopulation(2, 4, 1, 2)]  // P2 defender: 4 civ, 1 sol, 2 babies
        ]);
        const state = new GameState([new Player(1, "P1"), new Player(2, "P2")], population, 1);

        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 5 }],
            2: []
        };

        const resolver = new TurnResolver();
        resolver.combat.random = createMockRng([0.9, 0.1]); // P1 wins combat

        const result = resolver.resolve(state, orders);
        const capturedTile = result.state.population.get(tileKey(1, 0));

        expect(capturedTile.ownerId).toBe(1);
        expect(capturedTile.civilians).toBe(0);
        expect(capturedTile.babies).toBe(0);
    });
});