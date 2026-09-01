import { describe, it, expect } from 'vitest';
import { areNeighbors, HEX_DIRECTIONS, tileKey } from './geometry.js';

describe('geometry.js - areNeighbors', () => {
    const origin = { q: 0, r: 0 };

    it('identifies all 6 direct neighbors from object coordinates', () => {
        HEX_DIRECTIONS.forEach(([dq, dr]) => {
            const neighbor = { q: origin.q + dq, r: origin.r + dr };
            expect(areNeighbors(origin, neighbor)).toBe(true);
        });
    });

    it('identifies neighbors when passed as string keys', () => {
        HEX_DIRECTIONS.forEach(([dq, dr]) => {
            const keyA = tileKey(0, 0);
            const keyB = tileKey(dq, dr);
            expect(areNeighbors(keyA, keyB)).toBe(true);
        });
    });

    it('rejects non-adjacent tiles', () => {
        expect(areNeighbors({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false);
        expect(areNeighbors({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(false);
    });
});