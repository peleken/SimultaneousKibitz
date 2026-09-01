/**
 * Orders are immutable declarations of intent.
 */

export const ORDER_TYPES = Object.freeze({
    MOVE_SOLDIERS: "moveSoldiers",
    MOVE_CIVILIANS: "moveCivilians"
});

export class Order {
    constructor(type, playerId, from, to, amount) {
        this.type = type;
        this.playerId = playerId;
        this.from = from;
        this.to = to;
        this.amount = amount;
        Object.freeze(this);
    }

    isSoldierMove() {
        return this.type === ORDER_TYPES.MOVE_SOLDIERS;
    }

    isCivilianMove() {
        return this.type === ORDER_TYPES.MOVE_CIVILIANS;
    }

    static fromJSON(value) {
        return new Order(
            value.type,
            value.playerId,
            value.from,
            value.to,
            Number(value.amount)
        );
    }
}

export function normalizeOrders(ordersByPlayerId, players) {
    const normalized = {};

    for (const player of players) {
        const orders = ordersByPlayerId?.[player.id] ?? [];

        if (!Array.isArray(orders)) {
            throw new Error(`Orders for ${player.name} must be an array.`);
        }

        normalized[player.id] = orders.map(order =>
            order instanceof Order ? order : Order.fromJSON(order)
        );
    }

    return normalized;
}

export function flattenOrders(ordersByPlayerId) {
    return Object.values(ordersByPlayerId).flat();
}
