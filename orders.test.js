import { describe, test, expect } from 'vitest';
import {
    Order,
    ORDER_TYPES,
    normalizeOrders,
    flattenOrders
} from './orders.js';


describe('Order', () => {

    test('creates a soldier move order with the expected fields', () => {
        const order = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '1,0',
            3
        );

        expect(order).toEqual({
            type: 'moveSoldiers',
            playerId: 1,
            from: '0,0',
            to: '1,0',
            amount: 3
        });
    });


    test('creates a civilian move order with the expected fields', () => {
        const order = new Order(
            ORDER_TYPES.MOVE_CIVILIANS,
            2,
            '1,0',
            '1,1',
            4
        );

        expect(order.type).toBe(ORDER_TYPES.MOVE_CIVILIANS);
        expect(order.playerId).toBe(2);
        expect(order.from).toBe('1,0');
        expect(order.to).toBe('1,1');
        expect(order.amount).toBe(4);
    });


    test('identifies soldier and civilian moves correctly', () => {
        const soldierOrder = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '1,0',
            2
        );

        const civilianOrder = new Order(
            ORDER_TYPES.MOVE_CIVILIANS,
            1,
            '0,0',
            '1,0',
            2
        );

        expect(soldierOrder.isSoldierMove()).toBe(true);
        expect(soldierOrder.isCivilianMove()).toBe(false);

        expect(civilianOrder.isCivilianMove()).toBe(true);
        expect(civilianOrder.isSoldierMove()).toBe(false);
    });


    test('orders are immutable', () => {
        const order = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '1,0',
            2
        );

        expect(Object.isFrozen(order)).toBe(true);
    });


    test('fromJSON converts amount to a number', () => {
        const order = Order.fromJSON({
            type: 'moveSoldiers',
            playerId: 1,
            from: '0,0',
            to: '1,0',
            amount: '3'
        });

        expect(order).toBeInstanceOf(Order);
        expect(order.amount).toBe(3);
        expect(typeof order.amount).toBe('number');
    });


    test('fromJSON preserves the other order fields', () => {
        const value = {
            type: 'moveCivilians',
            playerId: 2,
            from: '1,0',
            to: '1,1',
            amount: 4
        };

        const order = Order.fromJSON(value);

        expect(order.type).toBe(value.type);
        expect(order.playerId).toBe(value.playerId);
        expect(order.from).toBe(value.from);
        expect(order.to).toBe(value.to);
        expect(order.amount).toBe(value.amount);
    });

});


describe('normalizeOrders', () => {

    const players = [
        { id: 1, name: 'P1' },
        { id: 2, name: 'P2' }
    ];


    test('converts plain JSON orders into Order instances', () => {
        const orders = {
            1: [
                {
                    type: 'moveSoldiers',
                    playerId: 1,
                    from: '0,0',
                    to: '1,0',
                    amount: 3
                }
            ],
            2: []
        };

        const normalized = normalizeOrders(orders, players);

        expect(normalized[1][0]).toBeInstanceOf(Order);
        expect(normalized[1][0].isSoldierMove()).toBe(true);
        expect(normalized[1][0].amount).toBe(3);
    });


    test('leaves existing Order instances intact', () => {
        const order = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '1,0',
            3
        );

        const normalized = normalizeOrders(
            { 1: [order], 2: [] },
            players
        );

        expect(normalized[1][0]).toBe(order);
    });


    test('creates an empty order list for a player with no submitted orders', () => {
        const normalized = normalizeOrders(
            {
                1: [
                    new Order(
                        ORDER_TYPES.MOVE_SOLDIERS,
                        1,
                        '0,0',
                        '1,0',
                        3
                    )
                ]
            },
            players
        );

        expect(normalized[1]).toHaveLength(1);
        expect(normalized[2]).toEqual([]);
    });


    test('rejects a non-array order list', () => {
        expect(() =>
            normalizeOrders(
                {
                    1: {
                        type: 'moveSoldiers',
                        playerId: 1,
                        from: '0,0',
                        to: '1,0',
                        amount: 3
                    },
                    2: []
                },
                players
            )
        ).toThrow('Orders for P1 must be an array.');
    });


    test('normalizes multiple players independently', () => {
        const normalized = normalizeOrders(
            {
                1: [
                    {
                        type: 'moveSoldiers',
                        playerId: 1,
                        from: '0,0',
                        to: '1,0',
                        amount: 3
                    }
                ],
                2: [
                    {
                        type: 'moveCivilians',
                        playerId: 2,
                        from: '1,0',
                        to: '2,0',
                        amount: 1
                    }
                ]
            },
            players
        );

        expect(normalized[1][0].playerId).toBe(1);
        expect(normalized[2][0].playerId).toBe(2);

        expect(normalized[1][0]).toBeInstanceOf(Order);
        expect(normalized[2][0]).toBeInstanceOf(Order);
    });

});


describe('flattenOrders', () => {

    test('flattens orders from all players into one array', () => {
        const p1Order = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '1,0',
            3
        );

        const p2Order = new Order(
            ORDER_TYPES.MOVE_CIVILIANS,
            2,
            '1,0',
            '2,0',
            1
        );

        expect(
            flattenOrders({
                1: [p1Order],
                2: [p2Order]
            })
        ).toEqual([
            p1Order,
            p2Order
        ]);
    });


    test('returns an empty array when there are no orders', () => {
        expect(
            flattenOrders({
                1: [],
                2: []
            })
        ).toEqual([]);
    });


    test('preserves the order within each player list', () => {
        const first = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '1,0',
            1
        );

        const second = new Order(
            ORDER_TYPES.MOVE_SOLDIERS,
            1,
            '0,0',
            '-1,0',
            2
        );

        const third = new Order(
            ORDER_TYPES.MOVE_CIVILIANS,
            2,
            '1,0',
            '2,0',
            1
        );

        expect(
            flattenOrders({
                1: [first, second],
                2: [third]
            })
        ).toEqual([
            first,
            second,
            third
        ]);
    });

});
