/*
 * engine.js
 *
 * GameEngine is the ONLY thing that knows a GameState and a GameRules
 * instance go together. It owns both, plus the log, and is the single
 * surface everything else (GameUI today; an AI harness or server
 * endpoint later) talks to.
 *
 * simulateTurn() ALWAYS validates internally before resolving, even
 * though GameUI also validates up front (so it can show a friendly
 * in-log error instead of catching an exception). This means any other
 * future caller can't accidentally corrupt game state by skipping
 * validation.
 */

import { HexBoard } from './geometry.js';
import { GameState, GameLog, Player } from './state.js';
import { GameRules, ConflictResolver } from './rules.js';

export class GameEngine {
    constructor() {
        this.hexBoard = new HexBoard(2);
        this.conflictResolver = new ConflictResolver();
        this.rules = new GameRules(this.hexBoard, this.conflictResolver);

        const players = [
            new Player(1, "Player 1", "#b91c1c", 0),  // Red
            new Player(2, "Player 2", "#1d4ed8", 0)   // Blue
        ];
        this.state = new GameState(players, new Map(), 0);
        this.log = new GameLog();

        this.rules.setupStartingTiles(this.state, this.log);
    }

    // Convenience accessors so callers (mainly GameUI) can read
    // this.engine.players / .population without reaching through
    // this.engine.state every time. These are read-only views onto
    // state -- the engine still owns the one authoritative GameState.
    get players() { return this.state.players; }
    get population() { return this.state.population; }

    getPlayerById(id) {
        return this.state.getPlayerById(id);
    }

    getVisibleTileKeys(player) {
        return this.rules.getVisibleTileKeys(this.state, player);
    }

    simulateTurn(ordersByPlayerId) {
        if (this.state.isGameOver) {
            throw new Error("Game is already over.");
        }

        const normalizedOrders = {};

        for (const player of this.state.players) {
            const orders = ordersByPlayerId[player.id] || [];

            if (!Array.isArray(orders)) {
                throw new Error(`Orders for ${player.name} must be an array.`);
            }

            normalizedOrders[player.id] = orders;
        }

        const validation = this.validateOrders(normalizedOrders);
        if (!validation.valid) {
            throw new Error(
                `simulateTurn() called with invalid orders:\n- ${validation.errors.join('\n- ')}`
            );
        }

        this.rules.resolveTurn(this.state, normalizedOrders, this.log);

        return this.getStateSnapshot();
    }

    getStateSnapshot() {
        return this.state.serialize();
    }

    validateOrders(ordersByPlayerId) {
        const errors = [];

        for (const player of this.state.players) {
            if (player.isEliminated) continue;

            const orders = ordersByPlayerId[player.id] || [];
            const committed = new Map();

            for (const order of orders) {
                if (order.playerId !== player.id) {
                    errors.push(`${player.name}: order contains the wrong player ID.`);
                    continue;
                }

                if (!this.rules.validateOrder(this.state, order, player.id)) {
                    errors.push(
                        `${player.name}: invalid ${order.type} from ${order.from} ` +
                        `to ${order.to} (${order.amount}).`
                    );
                    continue;
                }

                const key = `${order.from}:${order.type}`;
                committed.set(key, (committed.get(key) || 0) + order.amount);
            }

            for (const [commitKey, amount] of committed) {
                const [from, type] = commitKey.split(":");
                const pop = this.state.population.get(from);
                if (!pop) continue;

                const available = type === "moveSoldiers"
                    ? pop.soldiers
                    : pop.civilians;

                if (amount > available) {
                    errors.push(
                        `${player.name}: submitted ${amount} units from ${from}, ` +
                        `but only ${available} are available.`
                    );
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
