import { describe, it, expect } from 'vitest';
import { GameEngine } from './engine.js';
import { HexBoard, tileKey } from './geometry.js';
import { GameState, Player, TilePopulation } from './state.js';

describe('GameEngine', () => {
    it('getVisibleTileKeys includes owned tiles and their neighbors', () => {
        // Create a hex board with radius 2
        const board = new HexBoard(2);

        // Create a population map with two tiles:
        // - (0,0) owned by Player 1 with 5 soldiers
        // - (1,0) owned by Player 2 with 3 soldiers
        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 0, 5, 0)], // Player 1 owns (0,0)
            [tileKey(1, 0), new TilePopulation(2, 0, 3, 0)], // Player 2 owns (1,0)
        ]);

        // Create a game state with two players
        const state = new GameState(
            [new Player(1, "P1"), new Player(2, "P2")],
            population,
            1
        );

        // Create a GameEngine instance
        const engine = new GameEngine({ state, board });

        // Get the visible tiles for Player 1
        const player1 = state.getPlayerById(1);
        const visibleTiles = engine.getVisibleTileKeys(player1);

        // Calculate the expected visible tiles:
        // - The owned tile (0,0)
        // - All neighbors of (0,0)
        const expectedVisibleTiles = new Set([
            tileKey(0, 0), // Owned tile
            ...board.getNeighbors(0, 0).map(n => tileKey(n.q, n.r)), // Neighbors of (0,0)
        ]);

        // Assert that the visible tiles match the expected set
        expect(visibleTiles).toEqual(expectedVisibleTiles);
    });
});