/*
 * render.js
 *
 * BoardRenderer only draws. It reads population/ownership data through
 * the GameEngine facade it's handed, but makes no rules decisions of
 * its own -- it doesn't validate moves, resolve combat, or know what a
 * "legal" tile click is. That all lives in rules.js / engine.js.
 */

export class BoardRenderer {
    constructor(canvas, tileSize = 65) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
        this.originX = canvas.width / 2;
        this.originY = canvas.height / 2;
        this.terrainColor = '#2e7d32';
    }

    axialToPixel(q, r) {
        const x = this.tileSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.tileSize * (3 / 2 * r);
        return { x: this.originX + x, y: this.originY + y };
    }

    getTileAtPixel(px, py, board) {
        const q = ((px - this.originX) * Math.sqrt(3) / 3 - (py - this.originY) / 3) / this.tileSize;
        const r = (py - this.originY) * 2 / 3 / this.tileSize;
        const rounded = this.roundHex(q, r);
        return board.hasTile(rounded.q, rounded.r) ? rounded : null;
    }

    roundHex(q, r) {
        const s = -q - r;
        let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
        const q_diff = Math.abs(rq - q);
        const r_diff = Math.abs(rr - r);
        const s_diff = Math.abs(rs - s);
        if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
        else if (r_diff > s_diff) rr = -rq - rs;
        return { q: rq, r: rr };
    }

    render(board, engine, visibleKeys, selectedKey, pendingOrders) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.renderTiles(board, engine, visibleKeys, selectedKey);
        this.renderOrders(pendingOrders);
        this.renderOverlay(board, engine, visibleKeys);
    }

    renderTiles(board, engine, visibleKeys, selectedKey) {
        for (const tile of board.tiles) {
            const key = `${tile.q},${tile.r}`;
            const { x, y } = this.axialToPixel(tile.q, tile.r);

            if (!visibleKeys.has(key)) {
                this.drawFog(x, y);
                continue;
            }

            const pop = engine.population.get(key);
            const fillColor = pop?.ownerId ? engine.getPlayerById(pop.ownerId)?.color || this.terrainColor : this.terrainColor;
            const isSelected = (key === selectedKey);

            this.drawHex(x, y, fillColor, isSelected);
        }
    }

    renderOrders(pendingOrders) {
        for (const order of pendingOrders) {
            const [fq, fr] = order.from.split(',').map(Number);
            const [tq, tr] = order.to.split(',').map(Number);
            const start = this.axialToPixel(fq, fr);
            const end = this.axialToPixel(tq, tr);

            const color = order.type === "moveSoldiers" ? '#f59e0b' : '#3b82f6';
            const icon = order.type === "moveSoldiers" ? '💂' : '🧑‍🌾';

            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 4;
            this.ctx.stroke();

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc((start.x + end.x) / 2, (start.y + end.y) / 2, 12, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${icon}${order.amount}`, (start.x + end.x) / 2, (start.y + end.y) / 2);
        }
    }

    renderOverlay(board, engine, visibleKeys) {
        for (const key of visibleKeys) {
            const pop = engine.population.get(key);
            if (!pop) continue;
            const [q, r] = key.split(',').map(Number);
            const { x, y } = this.axialToPixel(q, r);
            this.drawPopulation(x, y, pop);
        }
    }

    drawFog(x, y) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + (Math.PI / 6);
            const hx = x + this.tileSize * Math.cos(angle);
            const hy = y + this.tileSize * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(hx, hy);
            else this.ctx.lineTo(hx, hy);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = '#111827';
        this.ctx.fill();
    }

    drawPopulation(x, y, pop) {
        y -= this.tileSize / 2;
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'alphabetic';
        this.ctx.fillText(
            `🧑‍🌾:${pop.civilians}💂:${pop.soldiers}👶:${pop.babies}`,
            x, y + this.tileSize * 0.5);
    }

    drawHex(x, y, fillColor, isSelected = false) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + (Math.PI / 6);
            const hx = x + this.tileSize * Math.cos(angle);
            const hy = y + this.tileSize * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(hx, hy);
            else this.ctx.lineTo(hx, hy);
        }
        this.ctx.closePath();

        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        this.ctx.strokeStyle = isSelected ? '#fbbf24' : '#ffffff';
        this.ctx.lineWidth = isSelected ? 4 : 2;
        this.ctx.stroke();
    }
}
