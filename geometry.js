/*
 * geometry.js
 *
 * Hex-grid geometry only: tile shape, board layout, adjacency.
 * No game rules, no ownership, no population data. This module
 * would be identical for a completely different game played on
 * the same hex grid.
 */

export function tileKey(q, r) {
    return `${q},${r}`;
}

export class Tile {
    constructor(q, r, s) {
        this.q = q;
        this.r = r;
        this.s = s;
    }
}

export class HexBoard {
    constructor(radius) {
        this.radius = radius;
        this.tiles = this.createHexBoard();
    }

    createHexBoard() {
        const radius = this.radius;
        const tiles = [];

        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) {
                tiles.push(new Tile(q, r, -q - r));
            }
        }
        return tiles;
    }

    getNeighbors(q, r) {
        const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
        return dirs
            .map(([dq, dr]) => ({ q: q + dq, r: r + dr }))
            .filter(({ q, r }) => this.hasTile(q, r));
    }

    hasTile(q, r) {
        return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) <= this.radius;
    }
}
