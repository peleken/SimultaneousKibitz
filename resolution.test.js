import { describe, test, expect, beforeEach } from 'vitest';
import { TurnResolver } from './resolution.js';
import { GameState, Player, TilePopulation } from './state.js';
import { HexBoard, tileKey } from './geometry.js';

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
            [tileKey(0, 0), new TilePopulation(1, 0, 5, 0)],
            [tileKey(1, 0), new TilePopulation(2, 0, 3, 0)]
        ]);
        const state = new GameState(
            [new Player(1, "P1"), new Player(2, "P2")],
            population,
            1
        );
        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 5 }],
            2: [{ playerId: 2, type: "moveSoldiers", from: tileKey(1, 0), to: tileKey(0, 0), amount: 3 }]
        };

        const resolver = new TurnResolver();
        resolver.combat.random = createMockRng([0.9, 0.1]);
        const result = resolver.resolve(state, orders);
        const destTile = result.state.population.get(tileKey(1, 0));

        expect(destTile.ownerId).toBe(1);
        expect(destTile.soldiers).toBeGreaterThan(0);
    });

    test('resolves reciprocal edge battle with one victor', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 5, 0)],
            [tileKey(1, 0), new TilePopulation(2, 0, 3, 0)]
        ]);
        const state = new GameState(
            [new Player(1, "P1"), new Player(2, "P2")],
            population,
            1
        );
        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 5 }],
            2: [{ playerId: 2, type: "moveSoldiers", from: tileKey(1, 0), to: tileKey(0, 0), amount: 3 }]
        };

        const resolver = new TurnResolver();
        resolver.combat.random = createMockRng([0.9, 0.1]);
        const result = resolver.resolve(state, orders);

        const destTile = result.state.population.get(tileKey(1, 0));
        expect(destTile.ownerId).toBe(1);
        expect(destTile.soldiers).toBeGreaterThan(0);

        const originTile = result.state.population.get(tileKey(0, 0));
        expect(originTile.soldiers).toBe(0);
    });

    test('handles attacker entering a tile whose defender is simultaneously vacating', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 3, 0)],
            [tileKey(1, 0), new TilePopulation(2, 0, 3, 0)],
            [tileKey(2, 0), new TilePopulation(2, 0, 0, 0)]
        ]);
        const state = new GameState(
            [new Player(1, "P1"), new Player(2, "P2")],
            population,
            1
        );
        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 3 }],
            2: [{ playerId: 2, type: "moveSoldiers", from: tileKey(1, 0), to: tileKey(2, 0), amount: 3 }]
        };

        const resolver = new TurnResolver();
        const result = resolver.resolve(state, orders);

        expect(result.state.population.get(tileKey(1, 0)).ownerId).toBe(1);
        expect(result.state.population.get(tileKey(1, 0)).soldiers).toBe(3);
        expect(result.state.population.get(tileKey(2, 0)).soldiers).toBe(3);
    });

    test('wipes civilians and babies upon tile loss', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 5, 0)],
            [tileKey(1, 0), new TilePopulation(2, 4, 1, 2)]
        ]);
        const state = new GameState(
            [new Player(1, "P1"), new Player(2, "P2")],
            population,
            1
        );
        const orders = {
            1: [{ playerId: 1, type: "moveSoldiers", from: tileKey(0, 0), to: tileKey(1, 0), amount: 5 }],
            2: []
        };

        const resolver = new TurnResolver();
        resolver.combat.random = createMockRng([0.9, 0.1]);
        const result = resolver.resolve(state, orders);
        const capturedTile = result.state.population.get(tileKey(1, 0));

        expect(capturedTile.ownerId).toBe(1);
        expect(capturedTile.civilians).toBe(0);
        expect(capturedTile.babies).toBe(0);
    });
});
