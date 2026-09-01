import { ORDER_TYPES, flattenOrders } from "./orders.js";
import { TilePopulation } from "./state.js";

/**
 * Movement phase.
 *
 * All departures are applied first from the start-of-turn state. Soldier
 * arrivals are kept separate from the destination state so that they can be
 * resolved simultaneously later.
 *
 * Reciprocal soldier moves (A -> B and B -> A) are detected explicitly.
 * Those armies meet on the edge instead of silently passing through one
 * another.
 */

export class MovementResolver {
    resolve(state, ordersByPlayerId, events = []) {
        const nextState = state.clone();
        const soldierArrivals = new Map();
        const civilianArrivals = [];

        const addArrival = (to, arrival) => {
            if (!soldierArrivals.has(to)) soldierArrivals.set(to, []);
            soldierArrivals.get(to).push(arrival);
        };

        const soldierOrders = flattenOrders(ordersByPlayerId)
            .filter(order => order.type === ORDER_TYPES.MOVE_SOLDIERS);

        // First pass: remove every moving unit from its source.
        // This makes movement simultaneous rather than order-dependent.
        for (const [playerIdString, orders] of Object.entries(ordersByPlayerId)) {
            const playerId = Number(playerIdString);
            const player = nextState.getPlayerById(playerId);

            for (const order of orders) {
                const source = nextState.population.get(order.from);
                if (!source) continue;

                if (order.type === ORDER_TYPES.MOVE_SOLDIERS) {
                    source.soldiers -= order.amount;

                    addArrival(order.to, {
                        playerId,
                        amount: order.amount,
                        from: order.from
                    });

                    events.push({
                        type: "movement",
                        playerId,
                        from: order.from,
                        to: order.to,
                        unitType: "soldiers",
                        amount: order.amount,
                        visibleTo: nextState.players.map(p => p.id)
                    });
                }

                if (order.type === ORDER_TYPES.MOVE_CIVILIANS) {
                    source.civilians -= order.amount;
                    civilianArrivals.push(order);
                }
            }
        }

        // Civilian moves don't participate in combat.
        for (const order of civilianArrivals) {
            const destination = nextState.population.get(order.to);
            if (!destination) {
                nextState.population.set(
                    order.to,
                    new TilePopulation(null, 0, 0, 0)
                );
            }

            nextState.population.get(order.to).civilians += order.amount;

            events.push({
                type: "civilianMovement",
                playerId: order.playerId,
                from: order.from,
                to: order.to,
                amount: order.amount,
                visibleTo: [order.playerId]
            });
        }

        const edgeBattles = this.findReciprocalBattles(soldierOrders);

        return {
            state: nextState,
            soldierArrivals,
            edgeBattles,
            events
        };
    }

    findReciprocalBattles(soldierOrders) {
        const byEdge = new Map();

        for (const order of soldierOrders) {
            const endpoints = [order.from, order.to].sort();
            const edgeKey = `${endpoints[0]}|${endpoints[1]}`;

            if (!byEdge.has(edgeKey)) byEdge.set(edgeKey, []);
            byEdge.get(edgeKey).push(order);
        }

        const battles = [];

        for (const orders of byEdge.values()) {
            const byDirection = new Map();

            for (const order of orders) {
                const key = `${order.from}->${order.to}`;
                byDirection.set(
                    key,
                    (byDirection.get(key) || 0) + order.amount
                );
            }

            if (byDirection.size !== 2) continue;

            const [first, second] = [...byDirection.keys()];
            const [firstFrom, firstTo] = first.split("->");
            const [secondFrom, secondTo] = second.split("->");

            if (firstFrom !== secondTo || firstTo !== secondFrom) continue;

            const firstOrder = orders.find(
                order => order.from === firstFrom && order.to === firstTo
            );
            const secondOrder = orders.find(
                order => order.from === secondFrom && order.to === secondTo
            );

            battles.push({
                a: {
                    playerId: firstOrder.playerId,
                    from: firstFrom,
                    to: firstTo,
                    amount: byDirection.get(first)
                },
                b: {
                    playerId: secondOrder.playerId,
                    from: secondFrom,
                    to: secondTo,
                    amount: byDirection.get(second)
                }
            });
        }

        return battles;
    }
}
