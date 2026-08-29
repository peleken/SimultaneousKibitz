import { GameEngine } from './engine.js';
import { GameUI } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const engine = new GameEngine();
    const ui = new GameUI(canvas, engine);

    document.getElementById('showStateBtn').addEventListener('click', () => {
        document.getElementById('stateOutput').textContent =
            JSON.stringify(engine.getStateSnapshot(), null, 2);
    });

    document.getElementById('simulateEmptyBtn').addEventListener('click', () => {
        try {
            engine.simulateTurn({});
        } catch (err) {
            engine.log.add(`❌ Simulate empty turn failed: ${err.message}`, [], "error");
        }
        ui.render();
        document.getElementById('stateOutput').textContent =
            JSON.stringify(engine.getStateSnapshot(), null, 2);
    });
});
