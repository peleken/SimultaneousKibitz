import { areNeighbors, parseTileKey } from "./geometry.js";
import { ORDER_TYPES, flattenOrders } from "./orders.js";

/**
 * Validation is deliberately separate from resolution.
 *
 * Important: validation examines the beginning-of-turn state. It does not
 * mutate state and does not attempt to decide the outcome of conflicts.
 */

export class OrderValidator {
    constructor(board) {
        this.board = board;
    }

    validate(state, ordersByPlayerId) {
        const errors = [];
        const orders = flattenOrders(ordersByPlayerId);

        for (const player of state.players) {
            const playerOrders = ordersByPlayerId[player.id] ?? [];
            const committed = new Map();

            for (const order of playerOrders) {
                const result = this.validateOrder(state, order, player.id);

                if (!result.valid) {
                    errors.push(`${player.name}: ${result.error}`);
                    continue;
                }

                const key = `${order.from}:${order.type}`;
                committed.set(key, (committed.get(key) || 0) + order.amount);
            }

            // A player may split an army/civilian population across multiple
            // destinations, but may not spend the same units twice.
            for (const [commitKey, amount] of committed) {
                const separator = commitKey.lastIndexOf(":");
                const from = commitKey.slice(0, separator);
                const type = commitKey.slice(separator + 1);
                const pop = state.population.get(from);
                if (!pop) continue;

                const available = type === ORDER_TYPES.MOVE_SOLDIERS
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

        // Catch orders attributed to unknown players.
        const knownPlayerIds = new Set(state.players.map(player => player.id));
        for (const order of orders) {
            if (!knownPlayerIds.has(order.playerId)) {
                errors.push(`Unknown player ID ${order.playerId} submitted an order.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    validateOrder(state, order, playerId) {
        if (!order || order.playerId !== playerId) {
            return { valid: false, error: "order contains the wrong player ID." };
        }

        if (!Number.isInteger(order.amount) || order.amount <= 0) {
            return { valid: false, error: "order amount must be a positive integer." };
        }

        const source = state.population.get(order.from);
        if (!source || source.ownerId !== playerId) {
            return { valid: false, error: `cannot move units from ${order.from}.` };
        }

        const from = parseTileKey(order.from);
        const to = parseTileKey(order.to);

        if (!this.board.hasTile(to.q, to.r) || !areNeighbors(from, to)) {
            return {
                valid: false,
                error: `${order.from} to ${order.to} is not an adjacent board tile.`
            };
        }

        if (order.type === ORDER_TYPES.MOVE_SOLDIERS) {
            if (source.soldiers < order.amount) {
                return {
                    valid: false,
                    error: `only ${source.soldiers} soldiers are available at ${order.from}.`
                };
            }

            return { valid: true };
        }

        if (order.type === ORDER_TYPES.MOVE_CIVILIANS) {
            const destination = state.population.get(order.to);

            // Civilian movement is intentionally restricted to a friendly
            // destination in the starting state.
            if (!destination || destination.ownerId !== playerId) {
                return {
                    valid: false,
                    error: `civilians may only move to a tile you own (${order.to}).`
                };
            }

            if (source.civilians < order.amount) {
                return {
                    valid: false,
                    error: `only ${source.civilians} civilians are available at ${order.from}.`
                };
            }

            return { valid: true };
        }

        return { valid: false, error: `unknown order type "${order.type}".` };
    }
}
