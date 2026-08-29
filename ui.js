/*
 * ui.js
 *
 * GameUI owns the DOM/canvas interaction and nothing else. It never
 * mutates game state directly -- every state change goes through
 * engine.simulateTurn(). It reads from the engine facade (engine.players,
 * engine.population, engine.state, engine.log, ...) but makes no rules
 * decisions of its own.
 */

import { BoardRenderer } from './render.js';
import { Order } from './rules.js';

export class GameUI {
    constructor(canvas, engine) {
        this.canvas = canvas;
        this.engine = engine;
        this.boardRenderer = new BoardRenderer(canvas);

        this.currentPlayerIndex = 0;
        this.currentPlayer = engine.players[0];
        this.ordersByPlayer = {};

        this.selectedKey = null;
        this.targetKey = null;
        this.selectedUnitType = "moveSoldiers";
        this.pendingOrders = [];

        this.bindControls();
        this.advanceToActivePlayer();
        this.render();
    }

    advanceToActivePlayer() {
        while (this.currentPlayer && this.currentPlayer.isEliminated && !this.engine.state.isGameOver) {
            this.currentPlayerIndex++;
            if (this.currentPlayerIndex >= this.engine.players.length) {
                this.currentPlayerIndex = 0;
            }
            this.currentPlayer = this.engine.players[this.currentPlayerIndex];
        }
    }

    bindControls() {
        const slider = document.getElementById('ratioSlider');
        const ratioValue = document.getElementById('ratioValue');

        slider.addEventListener('input', (e) => {
            if (this.currentPlayer) {
                this.currentPlayer.civilianRatio = Number(e.target.value) / 100;
                ratioValue.textContent = `${e.target.value}%`;
            }
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.engine.state.isGameOver || this.currentPlayer?.isEliminated) return;

            const rect = this.canvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;

            const tile = this.boardRenderer.getTileAtPixel(px, py, this.engine.hexBoard);
            if (tile) this.handleTileClick(tile.q, tile.r);
        });

        const btnSoldier = document.getElementById('toggleSoldierBtn');
        const btnCivilian = document.getElementById('toggleCivilianBtn');

        btnSoldier.addEventListener('click', () => {
            this.selectedUnitType = "moveSoldiers";
            btnSoldier.classList.add('active');
            btnCivilian.classList.remove('active');
            this.updateOrderInputLimits();
        });

        btnCivilian.addEventListener('click', () => {
            this.selectedUnitType = "moveCivilians";
            btnCivilian.classList.add('active');
            btnSoldier.classList.remove('active');
            this.updateOrderInputLimits();
        });

        document.getElementById('confirmOrderBtn').addEventListener('click', () => {
            const countInput = document.getElementById('unitCountInput');
            const amount = parseInt(countInput.value, 10);
            if (amount > 0 && this.selectedKey && this.targetKey) {
                const order = new Order(this.selectedUnitType, this.currentPlayer.id, this.selectedKey, this.targetKey, amount);
                this.pendingOrders.push(order);
                this.engine.log.add(
                    `${this.currentPlayer.name} orders ${amount} ${this.selectedUnitType === 'moveSoldiers' ? '💂' : '🧑‍🌾'} from ${this.selectedKey} to ${this.targetKey}`,
                    [this.currentPlayer.id],
                    "default"
                );
                this.updateLogDisplay();
                this.selectedKey = null;
                this.targetKey = null;
                this.hideOrderPanel();
                this.render();
            }
        });

        document.getElementById('cancelOrderBtn').addEventListener('click', () => {
            this.selectedKey = null;
            this.targetKey = null;
            this.hideOrderPanel();
            this.render();
        });

        document.getElementById('endTurnBtn').addEventListener('click', () => {
            if (!this.engine.state.isGameOver) {
                this.submitCurrentPlayerOrders();
            }
        });
    }

    getAvailableUnits(tileKey) {
        const pop = this.engine.population.get(tileKey);
        if (!pop) return { soldiers: 0, civilians: 0 };

        let committedSoldiers = 0;
        let committedCivilians = 0;

        for (const o of this.pendingOrders) {
            if (o.from === tileKey) {
                if (o.type === "moveSoldiers") committedSoldiers += o.amount;
                if (o.type === "moveCivilians") committedCivilians += o.amount;
            }
        }

        return {
            soldiers: Math.max(0, pop.soldiers - committedSoldiers),
            civilians: Math.max(0, pop.civilians - committedCivilians)
        };
    }

    submitCurrentPlayerOrders() {
        this.ordersByPlayer[this.currentPlayer.id] = this.pendingOrders;
        this.pendingOrders = [];
        this.selectedKey = null;
        this.targetKey = null;
        this.hideOrderPanel();

        let nextIndex = this.currentPlayerIndex + 1;
        while (nextIndex < this.engine.players.length && this.engine.players[nextIndex].isEliminated) {
            nextIndex++;
        }

        const isLastPlayer = nextIndex >= this.engine.players.length;

        if (!isLastPlayer) {
            this.currentPlayerIndex = nextIndex;
            this.currentPlayer = this.engine.players[this.currentPlayerIndex];
            document.getElementById('ratioSlider').value = this.currentPlayer.civilianRatio * 100;
            document.getElementById('ratioValue').textContent = `${this.currentPlayer.civilianRatio * 100}%`;
            this.render();
            return;
        }

        const validation = this.engine.validateOrders(this.ordersByPlayer);

        if (!validation.valid) {
            for (const error of validation.errors) {
                this.engine.log.add(`❌ ${error}`, [this.currentPlayer.id], "error");
            }
            this.updateLogDisplay();
            this.render();
            return;
        }

        try {
            this.engine.simulateTurn(this.ordersByPlayer);
        } catch (err) {
            this.engine.log.add(`❌ Turn resolution failed: ${err.message}`, [this.currentPlayer.id], "error");
            this.ordersByPlayer = {};
            this.currentPlayerIndex = 0;
            this.currentPlayer = this.engine.players[0];
            this.advanceToActivePlayer();
            this.updateLogDisplay();
            this.render();
            return;
        }

        this.ordersByPlayer = {};
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.engine.players[0];
        this.advanceToActivePlayer();

        if (this.currentPlayer) {
            document.getElementById('ratioSlider').value = this.currentPlayer.civilianRatio * 100;
            document.getElementById('ratioValue').textContent = `${this.currentPlayer.civilianRatio * 100}%`;
        }

        if (!this.engine.state.isGameOver) {
            this.engine.log.add("--- Round Complete ---", this.engine.players.map(p => p.id), "default");
        }

        this.updateLogDisplay();
        this.render();
    }

    handleTileClick(q, r) {
        const clickedKey = `${q},${r}`;
        const visible = this.engine.getVisibleTileKeys(this.currentPlayer);

        if (!visible.has(clickedKey)) return;

        const pop = this.engine.population.get(clickedKey);

        if (!this.selectedKey) {
            if (pop && pop.ownerId === this.currentPlayer.id) {
                const avail = this.getAvailableUnits(clickedKey);
                if (avail.soldiers > 0 || avail.civilians > 0) {
                    this.selectedKey = clickedKey;
                }
            }
        } else {
            const [sq, sr] = this.selectedKey.split(',').map(Number);
            const neighbors = this.engine.hexBoard.getNeighbors(sq, sr);
            const isNeighbor = neighbors.some(n => n.q === q && n.r === r);

            if (isNeighbor) {
                this.targetKey = clickedKey;
                this.showOrderPanel();
            } else {
                if (pop && pop.ownerId === this.currentPlayer.id) {
                    const avail = this.getAvailableUnits(clickedKey);
                    if (avail.soldiers > 0 || avail.civilians > 0) {
                        this.selectedKey = clickedKey;
                        this.hideOrderPanel();
                    }
                } else {
                    this.selectedKey = null;
                    this.hideOrderPanel();
                }
            }
        }
        this.render();
    }

    updateOrderInputLimits() {
        if (!this.selectedKey || !this.targetKey) return;

        const avail = this.getAvailableUnits(this.selectedKey);
        const targetPop = this.engine.population.get(this.targetKey);
        const isTargetOwnedByMe = targetPop && targetPop.ownerId === this.currentPlayer.id;

        const btnCivilian = document.getElementById('toggleCivilianBtn');
        const btnSoldier = document.getElementById('toggleSoldierBtn');

        if (!isTargetOwnedByMe) {
            btnCivilian.disabled = true;
            if (this.selectedUnitType === "moveCivilians") {
                this.selectedUnitType = "moveSoldiers";
                btnSoldier.classList.add('active');
                btnCivilian.classList.remove('active');
            }
        } else {
            btnCivilian.disabled = false;
        }

        const maxCount = this.selectedUnitType === "moveSoldiers" ? avail.soldiers : avail.civilians;
        const input = document.getElementById('unitCountInput');
        input.max = maxCount;
        input.value = maxCount > 0 ? 1 : 0;
    }

    showOrderPanel() {
        const panel = document.getElementById('orderPanel');
        const info = document.getElementById('orderInfo');
        info.textContent = `Move (${this.selectedKey}) ➔ (${this.targetKey})`;
        this.updateOrderInputLimits();
        panel.style.display = 'flex';
    }

    hideOrderPanel() {
        document.getElementById('orderPanel').style.display = 'none';
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turnIndicator');
        const endBtn = document.getElementById('endTurnBtn');

        if (this.engine.state.isGameOver) {
            const winner = this.engine.getPlayerById(this.engine.state.winnerId);
            indicator.textContent = winner ? `🏆 ${winner.name} Wins the Game!` : "🏁 Game Over - Draw!";
            indicator.style.borderColor = winner ? winner.color : "#ffffff";
            endBtn.disabled = true;
            endBtn.textContent = "Game Over";
            return;
        }

        indicator.textContent = `${this.currentPlayer.name}'s turn to give orders`;
        indicator.style.borderColor = this.currentPlayer.color;

        let nextIndex = this.currentPlayerIndex + 1;
        while (nextIndex < this.engine.players.length && this.engine.players[nextIndex].isEliminated) {
            nextIndex++;
        }

        const isLastPlayer = nextIndex >= this.engine.players.length;
        endBtn.disabled = false;
        endBtn.textContent = isLastPlayer
            ? 'Submit Orders & Resolve Round'
            : `Submit Orders (pass to ${this.engine.players[nextIndex].name})`;
    }

    updateLogDisplay() {
        const logContainer = document.getElementById('gameLog');
        const activeId = this.currentPlayer ? this.currentPlayer.id : null;
        const playerLog = activeId ? this.engine.log.getPlayerLog(activeId) : this.engine.log.entries;

        logContainer.innerHTML = playerLog.map(entry => {
            let className = '';
            switch (entry.type) {
                case 'attack': className = 'log-attack'; break;
                case 'defend': className = 'log-defend'; break;
                case 'victory': className = 'log-victory'; break;
                case 'defeat': className = 'log-defeat'; break;
                case 'growth': className = 'log-growth'; break;
                case 'error': className = 'log-error'; break;
            }
            return `<div class="gameLogEntry visible ${className}">${entry.message}</div>`;
        }).join('');
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    render() {
        this.updateTurnIndicator();
        this.updateLogDisplay();

        const visible = this.currentPlayer
            ? this.engine.getVisibleTileKeys(this.currentPlayer)
            : new Set(this.engine.population.keys());

        this.boardRenderer.render(this.engine.hexBoard, this.engine, visible, this.selectedKey, this.pendingOrders);

        if (this.currentPlayer) {
            const total = { civilians: 0, soldiers: 0, babies: 0 };
            for (const pop of this.engine.population.values()) {
                if (pop.ownerId !== this.currentPlayer.id) continue;
                total.civilians += pop.civilians;
                total.soldiers += pop.soldiers;
                total.babies += pop.babies;
            }

            document.getElementById('populationStatus').textContent =
                `Population — 🧑‍🌾 Civilians: ${total.civilians} | ` +
                ` 💂 Soldiers: ${total.soldiers} | ` +
                ` 👶 Babies: ${total.babies}`;
        } else {
            document.getElementById('populationStatus').textContent = "Game Complete";
        }
    }
}
