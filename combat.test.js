import { describe, test, expect } from 'vitest';
import { ConflictResolver } from './combat.js';

// Deterministic mock RNG returning a fixed sequence, wrapping around.
function createMockRng(values) {
    let index = 0;
    return () => values[index++ % values.length];
}

describe('ConflictResolver', () => {
    test('combat produces the expected winner (deterministic seeded combat)', () => {
        // rollDie() = floor(random() * 6) + 1
        // 0.99 -> 6, 0.0 -> 1
        const resolver = new ConflictResolver(createMockRng([0.99, 0.0]));

        const result = resolver.resolve([
            { playerId: 1, amount: 3, isDefender: false },
            { playerId: 2, amount: 1, isDefender: false }
        ]);

        // Round 1: P1 rolls 6 (wins round), P2 rolls 1 (lowest, takes the
        // casualty). P2 only had 1 soldier, so P2 is eliminated in one round.
        expect(result.winnerId).toBe(1);
        expect(result.survivingSoldiers).toBe(3);
        expect(result.rounds).toHaveLength(1);
    });

    // These tie-break tests call breakHighTie() directly rather than going
    // through a full multi-round resolve(). "Winning the round" and "who
    // takes the casualty" are decided by two separate, independently
    // random draws (see the "round winner isn't casualty-proof" test
    // below) -- so asserting an overall combat winner would actually be
    // testing casualty-selection randomness, not the tie-break rule.
    test('breakHighTie: defender wins when exactly one defender is tied for the high roll', () => {
        const resolver = new ConflictResolver();

        const winner = resolver.breakHighTie([
            { playerId: 1, amount: 5, isDefender: false },
            { playerId: 2, amount: 5, isDefender: true }
        ]);

        expect(winner.playerId).toBe(2);
    });

    test('breakHighTie: larger army wins when no single defender is tied', () => {
        const resolver = new ConflictResolver();

        const winner = resolver.breakHighTie([
            { playerId: 1, amount: 2, isDefender: false },
            { playerId: 2, amount: 6, isDefender: false }
        ]);

        expect(winner.playerId).toBe(2);
    });

    test('breakHighTie: falls back to random choice among equal, defenderless armies', () => {
        // randomChoice picks index = floor(random() * items.length).
        // With a constant 0.99 and 2 tied items, that's always index 1.
        const resolver = new ConflictResolver(createMockRng([0.99]));

        const winner = resolver.breakHighTie([
            { playerId: 1, amount: 4, isDefender: false },
            { playerId: 2, amount: 4, isDefender: false }
        ]);

        expect(winner.playerId).toBe(2);
    });

    test('winning a round does not protect an army from being the casualty', () => {
        // With every army always rolling identically, everyone ties for
        // both highest AND lowest each round -- so the "round winner"
        // (decided by breakHighTie) and the "casualty" (decided by a
        // separate randomChoice over the same tied group) are independent
        // draws. Here the defender (P2) wins every round's tie-break, but
        // the constant RNG also always selects P2 as the casualty, so P2
        // is worn down and loses despite "winning" every round.
        const resolver = new ConflictResolver(createMockRng([0.5]));

        const result = resolver.resolve([
            { playerId: 1, amount: 5, isDefender: false },
            { playerId: 2, amount: 5, isDefender: true }
        ]);

        expect(result.winnerId).toBe(1);
        expect(result.survivingSoldiers).toBe(5);
    });

    test('a lone army wins uncontested with no rounds fought', () => {
        const resolver = new ConflictResolver(createMockRng([0.5]));

        const result = resolver.resolve([
            { playerId: 1, amount: 7, isDefender: true }
        ]);

        expect(result.winnerId).toBe(1);
        expect(result.survivingSoldiers).toBe(7);
        expect(result.rounds).toHaveLength(0);
    });

    test('resolves a three-way battle down to a single winner', () => {
        // Cycle rolls so P1 always rolls highest and P3 always rolls lowest;
        // P3 (amount 1) should be eliminated first, then P2 worn down.
        const resolver = new ConflictResolver(createMockRng([0.9, 0.5, 0.0]));

        const result = resolver.resolve([
            { playerId: 1, amount: 3, isDefender: false },
            { playerId: 2, amount: 3, isDefender: false },
            { playerId: 3, amount: 1, isDefender: false }
        ]);

        expect(result.winnerId).toBe(1);
        expect(result.survivingSoldiers).toBeGreaterThan(0);
    });
});