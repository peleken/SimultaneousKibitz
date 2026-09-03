import { describe, test, expect, beforeEach } from 'vitest';
import { OrderValidator } from './validation.js';
import { GameState, Player, TilePopulation } from './state.js';
import { HexBoard, tileKey } from './geometry.js';
import { Order, ORDER_TYPES } from './orders.js';

describe('OrderValidator', () => {
    let board;
    let validator;
    let state;

    beforeEach(() => {
        board = new HexBoard(2);
        validator = new OrderValidator(board);

        const population = new Map([
            [tileKey(0, 0), new TilePopulation(1, 4, 5, 1)],  // P1: home tile
            [tileKey(1, 0), new TilePopulation(2, 4, 3, 1)],  // P2: adjacent to (0,0)
            [tileKey(-1, 0), new TilePopulation(1, 0, 2, 0)], // P1: another owned tile
            [tileKey(2, 0), new TilePopulation(null, 0, 0, 0)] // unowned, adjacent to (1,0) but NOT to (0,0)
        ]);

        state = new GameState(
            [new Player(1, 'P1'), new Player(2, 'P2')],
            population,
            1
        );
    });

    test('moving into an adjacent enemy tile is legal', () => {
        const order = new Order(ORDER_TYPES.MOVE_SOLDIERS, 1, tileKey(0, 0), tileKey(1, 0), 3);
        const result = validator.validateOrder(state, order, 1);
        expect(result.valid).toBe(true);
    });

    test('moving into a non-adjacent tile is illegal', () => {
        // (0,0) -> (2,0) are not neighbors (distance 2).
        const order = new Order(ORDER_TYPES.MOVE_SOLDIERS, 1, tileKey(0, 0), tileKey(2, 0), 3);
        const result = validator.validateOrder(state, order, 1);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/not an adjacent board tile/);
    });

    test('a single order cannot exceed the soldiers available at its source', () => {
        const order = new Order(ORDER_TYPES.MOVE_SOLDIERS, 1, tileKey(0, 0), tileKey(1, 0), 999);
        const result = validator.validateOrder(state, order, 1);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/only 5 soldiers are available/);
    });

    test('splitting an army across multiple orders cannot exceed what is available in total', () => {
        // (0,0) has 5 soldiers. Two individually-legal orders totalling 6
        // should be caught by validate()'s aggregate commit check, even
        // though validateOrder() would pass each one in isolation.
        const orders = {
            1: [
                new Order(ORDER_TYPES.MOVE_SOLDIERS, 1, tileKey(0, 0), tileKey(1, 0), 4),
                new Order(ORDER_TYPES.MOVE_SOLDIERS, 1, tileKey(0, 0), tileKey(-1, 0), 2)
            ],
            2: []
        };

        const result = validator.validate(state, orders);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/only 5 are available/);
    });

    test('multiple players can issue orders simultaneously and are validated independently', () => {
        const orders = {
            1: [new Order(ORDER_TYPES.MOVE_SOLDIERS, 1, tileKey(0, 0), tileKey(1, 0), 3)],
            2: [new Order(ORDER_TYPES.MOVE_SOLDIERS, 2, tileKey(1, 0), tileKey(2, 0), 999)]
        };

        const result = validator.validate(state, orders);

        // P2's order is invalid (exceeds available soldiers), but that
        // must not block or taint validation of P1's perfectly legal order.
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatch(/P2/);

        const p1Check = validator.validateOrder(
            state,
            orders[1][0],
            1
        );
        expect(p1Check.valid).toBe(true);
    });

    test('an eliminated player (owns no tiles) cannot issue an order', () => {
        // P2 has been wiped off the board entirely; every tile is now
        // either P1's or unowned. There is no code path here that checks
        // an "isEliminated" flag -- ownership itself is the source of
        // truth, so an eliminated player simply has no legal source tile
        // to move from.
        const eliminatedPopulation = new Map([
            [tileKey(0, 0), new TilePopulation(1, 4, 5, 1)],
            [tileKey(1, 0), new TilePopulation(1, 4, 3, 1)]
        ]);
        const eliminatedState = new GameState(
            [new Player(1, 'P1'), new Player(2, 'P2')],
            eliminatedPopulation,
            1
        );

        const order = new Order(ORDER_TYPES.MOVE_SOLDIERS, 2, tileKey(1, 0), tileKey(0, 0), 1);
        const result = validator.validateOrder(eliminatedState, order, 2);

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/cannot move units from/);
    });
});