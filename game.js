import { HexBoard, tileKey } from "./geometry.js";
import { GameState, Player, TilePopulation } from "./state.js";
import { ConflictResolver } from "./combat.js";
import { TurnResolver } from "./resolution.js";
import { GameEngine } from "./engine.js";

/**
 * Build the game from its independent simulation components.
 *
 * The UI receives only the resulting GameEngine. Visibility and all other
 * game rules remain behind the engine boundary.
 */
export function createGame({
    radius = 2,
    players = [
        new Player(1, "Player 1", "#b91c1c", 0),
        new Player(2, "Player 2", "#1d4ed8", 0)
    ],
    random = Math.random
} = {}) {
    const board = new HexBoard(radius);
    const population = new Map();

    const startingPositions = [
        { q: -2, r: 0 },
        { q: 2, r: 0 }
    ];

    players.forEach((player, index) => {
        const position = startingPositions[index];
        if (!position) return;

        population.set(
            tileKey(position.q, position.r),
            new TilePopulation(player.id, 2, 3, 1)
        );
    });

    const state = new GameState(players, population, 0);

    // Inject the RNG at construction time rather than reaching into the
    // resolver after the engine has been created.
    const resolver = new TurnResolver({
        combat: new ConflictResolver(random)
    });

    const engine = new GameEngine({
        state,
        board,
        resolver
    });

    return { board, engine };
}
