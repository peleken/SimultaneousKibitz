/**
 * Pure hex-grid geometry.
 * No game state or game-rule knowledge belongs here.
 */

export const HEX_DIRECTIONS = [
    [1, 0], [1, -1], [0, -1],
    [-1, 0], [-1, 1], [0, 1]
];

export function tileKey(q, r) {
    return `${q},${r}`;
}

export function parseTileKey(key) {
    const [q, r] = key.split(",").map(Number);
    return { q, r };
}

export function cubeS(q, r) {
    return -q - r;
}

export function isValidHex(q, r, radius) {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(cubeS(q, r))) <= radius;
}

export function neighbors(q, r, radius = Infinity) {
    return HEX_DIRECTIONS
        .map(([dq, dr]) => ({ q: q + dq, r: r + dr }))
        .filter(({ q: nq, r: nr }) => isValidHex(nq, nr, radius));
}

export function areNeighbors(a, b) {
    // Coerce string keys ("q,r") to objects if necessary
    const pA = typeof a === "string" ? parseTileKey(a) : a;
    const pB = typeof b === "string" ? parseTileKey(b) : b;

    const dq = pA.q - pB.q;
    const dr = pA.r - pB.r;
    
    // Correct axial distance formula
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1;
}

export class HexBoard {
    constructor(radius = 2) {
        this.radius = radius;
        this.tiles = [];

        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);

            for (let r = r1; r <= r2; r++) {
                this.tiles.push({ q, r, s: cubeS(q, r) });
            }
        }
    }

    hasTile(q, r) {
        return isValidHex(q, r, this.radius);
    }

    getNeighbors(q, r) {
        return neighbors(q, r, this.radius);
    }
}
