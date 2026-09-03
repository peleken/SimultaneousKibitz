import { describe, test, expect } from 'vitest';
import { VictoryResolver } from './victory.js';
import { GameState, Player, TilePopulation } from './state.js';
import { tileKey } from './geometry.js';

describe('VictoryResolver', () => {
    test('the game continues when more than one player still has population', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 2, 2, 0)],
            [tileKey(1, 0), new TilePopulation(2, 2, 2, 0)]
        ]);
        const state = new GameState([new Player(1, 'P1'), new Player(2, 'P2')], population, 1);

        const result = new VictoryResolver().resolve(state);

        expect(result.gameOver).toBe(false);
        expect(result.winnerId).toBeNull();
    });

    test('the last player standing wins and a victory event is broadcast to everyone', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 2, 2, 0)],
            // P2 owns the tile in name only -- zero civilians, soldiers,
            // and babies means P2 has no actual population left anywhere.
            [tileKey(1, 0), new TilePopulation(2, 0, 0, 0)]
        ]);
        const state = new GameState([new Player(1, 'P1'), new Player(2, 'P2')], population, 1);

        const events = [];
        const result = new VictoryResolver().resolve(state, events);

        expect(result.gameOver).toBe(true);
        expect(result.winnerId).toBe(1);

        const victoryEvent = events.find(e => e.type === 'victory');
        expect(victoryEvent).toBeDefined();
        expect(victoryEvent.playerId).toBe(1);
        expect(victoryEvent.visibleTo).toEqual([1, 2]);
    });

    test('a player with population split across multiple tiles still counts as alive', () => {
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 0, 0)], // owned, but empty
            [tileKey(-1, 0), new TilePopulation(1, 0, 1, 0)], // still has a soldier here
            [tileKey(1, 0), new TilePopulation(2, 0, 0, 0)]  // P2 fully wiped out
        ]);
        const state = new GameState([new Player(1, 'P1'), new Player(2, 'P2')], population, 1);

        const result = new VictoryResolver().resolve(state);

        expect(result.gameOver).toBe(true);
        expect(result.winnerId).toBe(1);
    });
});