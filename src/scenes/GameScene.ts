import Phaser from 'phaser';
import { FoodItem } from '../objects/FoodItem';
import { MatchFinder, type MatchResult } from '../utils/MatchFinder';
import { soundManager } from '../utils/SoundManager';
import { LevelManager } from '../utils/LevelManager';
import {
    GRID_ROWS,
    GRID_COLS,
    CELL_SIZE,
    GRID_OFFSET_X,
    GRID_OFFSET_Y,
    FOOD_TYPES,
    FOOD_COUNT,
    INITIAL_MOVES,
    POINTS_PER_GEM,
    SHUFFLE_ATTEMPTS,
    HINT_DELAY
} from '../utils/constants';

export class GameScene extends Phaser.Scene {
    private grid: (FoodItem | null)[][] = [];
    private selectedItem: FoodItem | null = null;
    private isProcessing: boolean = false;
    private comboLevel: number = 0;

    private score: number = 0;
    private movesRemaining: number = INITIAL_MOVES;
    private bestScore: number = 0;

    private scoreText!: Phaser.GameObjects.Text;
    private movesText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private coinsText!: Phaser.GameObjects.Text;
    private gameOverPanel!: Phaser.GameObjects.Container;

    private soundBtn!: Phaser.GameObjects.Text;
    private hintTimer: Phaser.Time.TimerEvent | null = null;
    private hintItems: (FoodItem | Phaser.GameObjects.Text)[] = [];
    private fpsText!: Phaser.GameObjects.Text;

    private levelManager: LevelManager = new LevelManager();
    private progressBar!: Phaser.GameObjects.Graphics;
    private targetScore: number = 0;
    private lastProgressPct: number = -1;
    
    // Boosters
    private boosterLightBall: number = 1;
    private boosterBomb: number = 1;
    private boosterDisco: number = 1;
    private activeBooster: string | null = null;

    // Booster button text references for UI updates
    private boosterLightBallText!: Phaser.GameObjects.Text;
    private boosterBombText!: Phaser.GameObjects.Text;
    private boosterDiscoText!: Phaser.GameObjects.Text;

    // Original booster button styles for visual feedback restoration
    private boosterOrigColors: Record<string, string> = {};

    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load all food sprites
        FOOD_TYPES.forEach(type => {
            this.load.image(type, `assets/${type}.webp`);
        });
        this.load.image('background', 'assets/background.webp');
    }

    async create() {
        // Generate textures for items that might be missing assets
        this.generateTextures();

        // Check if a level was selected from World Map
        const selectedLevel = this.registry.get('selectedLevel');
        if (selectedLevel && typeof selectedLevel === 'number') {
            this.levelManager.setLevel(selectedLevel);
            this.registry.remove('selectedLevel'); // Clean up
        }

        // Dynamic gradient background (no image overhead)
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x4a2a5e, 0x4a2a5e, 1);
        bg.fillRect(0, 0, 720, 1080);
        bg.setDepth(-1);

        // Add decorative shapes on background instead of boring dots
        this.drawDecorativeBackground();

        // Load best score
        this.bestScore = parseInt(localStorage.getItem('samsa_swap_best_score') || '0', 10);

        // Create UI
        this.createUI();

        // Initialize grid
        this.initGrid();

        // Draw grid background cells
        const graphics = this.add.graphics();
        graphics.fillStyle(0x000000, 0.3); // Semi-transparent black

        // Calculate responsive grid params (re-using logic or just using current constants since we are in FIT mode)
        // Since we are using FIT mode with 720x1080 design resolution:
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                // Add half cell size to align with items
                const x = GRID_OFFSET_X + col * CELL_SIZE;
                const y = GRID_OFFSET_Y + row * CELL_SIZE;

                // Draw rounded rect for each cell
                // x, y is center, so we need top-left for fillRoundedRect
                const size = CELL_SIZE - 8; // Slightly smaller than cell
                graphics.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12);
            }
        }
        graphics.setDepth(0);

        // Draw decorative frame around the grid
        this.drawGridFrame();

        this.fillBoard();

        // Check for deadlock
        await this.checkAndReshuffle();

        // Update UI
        this.updateUI();

        // Start single idle animation timer instead of 54 per-item timers
        this.startIdleTimer();

        // FPS counter update timer (every 500ms, not every frame!)
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                if (this.fpsText) {
                    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
                }
            }
        });
    }

    update() {
        // Sync shadow positions with items (cheap operation)
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const item = this.grid[row][col];
                if (item && item.shadow) {
                    item.shadow.x = item.x;
                    item.shadow.y = item.y + 4;
                    item.shadow.setDepth(item.depth - 1);
                }
            }
        }
    }

    // Removed update() — FPS text now updated via timer every 500ms

    private startIdleTimer() {
        this.time.addEvent({
            delay: 2500,
            loop: true,
            callback: () => {
                // Animate 5-8 random items — keeps the lively feel
                const count = Phaser.Math.Between(5, 8);
                for (let i = 0; i < count; i++) {
                    const row = Phaser.Math.Between(0, GRID_ROWS - 1);
                    const col = Phaser.Math.Between(0, GRID_COLS - 1);
                    const item = this.grid[row][col];
                    if (item) {
                        item.animateIdleJump();
                    }
                }
            }
        });
    }

    private createUI() {
        const config = this.levelManager.getConfig();
        this.targetScore = config.targetScore;
        this.movesRemaining = config.moves;

        // Title with level - top center
        const title = this.add.text(360, -50, 'SAMSA SWAP', {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#ff6b35',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.tweens.add({ targets: title, y: 23, duration: 800, ease: 'Back.easeOut' });

        // Level - under title
        const levelText = this.add.text(360, 55, `Уровень ${config.level}: ${config.name}`, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffcc00',
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: levelText, alpha: 1, duration: 600, delay: 300 });

        // Score - top left
        this.scoreText = this.add.text(-100, 8, 'Счёт: 0', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });
        this.tweens.add({ targets: this.scoreText, x: 20, duration: 600, ease: 'Power2', delay: 100 });

        // Moves - under score
        this.movesText = this.add.text(-100, 32, `Ходы: ${INITIAL_MOVES}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });
        this.tweens.add({ targets: this.movesText, x: 20, duration: 600, ease: 'Power2', delay: 200 });

        // Target - top right
        const targetText = this.add.text(800, 8, `Цель: ${config.targetScore}`, {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(1, 0);
        this.tweens.add({ targets: targetText, x: 700, duration: 600, ease: 'Power2', delay: 300 });

        // Best score - under target
        const bestText = this.add.text(800, 32, `Рекорд: ${this.bestScore}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#00ff88'
        }).setOrigin(1, 0);
        this.tweens.add({ targets: bestText, x: 700, duration: 600, ease: 'Power2', delay: 400 });

        // Coins - under best
        const coins = this.levelManager.getCoins();
        this.coinsText = this.add.text(800, 56, `🪙 ${coins}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(1, 0).setAlpha(0);
        this.tweens.add({ targets: this.coinsText, x: 700, duration: 600, ease: 'Power2', delay: 500 });

        // Sound toggle button - top right corner
        this.soundBtn = this.add.text(700, 30, '🔊', {
            fontSize: '28px',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Add pulse animation to sound button
        this.tweens.add({
            targets: this.soundBtn,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 1200,
        });

        this.soundBtn.on('pointerdown', () => {
            soundManager.setEnabled(!soundManager.isEnabled());
            this.soundBtn.setText(soundManager.isEnabled() ? '🔊' : '🔇');
        });

        this.soundBtn.on('pointerover', () => this.soundBtn.setScale(1.2));
        this.soundBtn.on('pointerout', () => this.soundBtn.setScale(1));

        // Progress bar - centered below title/level
        this.progressBar = this.add.graphics();
        this.drawProgressBar();
        
        // Star markers on progress bar — store references for animation
        const barX = 50, barY = 90, barW = 620;
        const starPositions = [0.33, 0.66, 1.0];
        starPositions.forEach((pct, idx) => {
            const starX = barX + barW * pct;
            const star = this.add.text(starX, barY - 5, '☆', {
                fontSize: '16px',
                color: '#ffcc00'
            }).setOrigin(0.5).setAlpha(0).setDepth(2).setData('starIdx', idx).setData('activated', false);
            this.tweens.add({ targets: star, alpha: 1, duration: 600, delay: 500 + idx * 100 });
        });

        // Combo text - center screen, floating above grid (between UI and grid)
        this.comboText = this.add.text(360, 200, '', {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#ff00ff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setVisible(false).setDepth(50);

        // Boosters panel - bottom of screen
        this.createBoostersPanel();

        // Game over panel (hidden initially)
        this.createGameOverPanel();
    }

    private createGameOverPanel() {
        this.gameOverPanel = this.add.container(360, 540);
        this.gameOverPanel.setDepth(100); // Ensure it's above everything

        const bg = this.add.rectangle(0, 0, 600, 400, 0x000000, 0.85).setStrokeStyle(4, 0xffcc00);
        const title = this.add.text(0, -130, 'ИГРА ОКОНЧЕНА', {
            fontSize: '42px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const scoreText = this.add.text(0, -20, '', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(0.5);

        // Graphical restart button (rounded rect)
        const restartBg = this.add.graphics();
        const restartBgW = 170;
        const restartBgH = 54;
        const restartBgX = -120;
        const restartBgY = 100;
        restartBg.fillStyle(0x00aa55, 1);
        restartBg.fillRoundedRect(restartBgX, restartBgY, restartBgW, restartBgH, 16);
        restartBg.lineStyle(2, 0x00ff88, 1);
        restartBg.strokeRoundedRect(restartBgX, restartBgY, restartBgW, restartBgH, 16);

        const restartBtn = this.add.text(restartBgX + restartBgW / 2, restartBgY + restartBgH / 2, '↺ ЗАНОВО', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => {
            this.scene.restart();
        });

        restartBtn.on('pointerover', () => {
            restartBg.clear();
            restartBg.fillStyle(0x00cc66, 1);
            restartBg.fillRoundedRect(restartBgX - 4, restartBgY - 4, restartBgW + 8, restartBgH + 8, 18);
            restartBg.lineStyle(3, 0x00ff88, 1);
            restartBg.strokeRoundedRect(restartBgX - 4, restartBgY - 4, restartBgW + 8, restartBgH + 8, 18);
            restartBtn.setScale(1.05);
        });

        restartBtn.on('pointerout', () => {
            restartBg.clear();
            restartBg.fillStyle(0x00aa55, 1);
            restartBg.fillRoundedRect(restartBgX, restartBgY, restartBgW, restartBgH, 16);
            restartBg.lineStyle(2, 0x00ff88, 1);
            restartBg.strokeRoundedRect(restartBgX, restartBgY, restartBgW, restartBgH, 16);
            restartBtn.setScale(1);
        });

        // Graphical map button
        const mapBg2 = this.add.graphics();
        const mapBg2W = 170;
        const mapBg2H = 54;
        const mapBg2X = 120 - mapBg2W / 2;
        const mapBg2Y = 100;
        mapBg2.fillStyle(0x555555, 1);
        mapBg2.fillRoundedRect(mapBg2X, mapBg2Y, mapBg2W, mapBg2H, 16);
        mapBg2.lineStyle(2, 0xffcc00, 1);
        mapBg2.strokeRoundedRect(mapBg2X, mapBg2Y, mapBg2W, mapBg2H, 16);

        const mapBtn = this.add.text(mapBg2X + mapBg2W / 2, mapBg2Y + mapBg2H / 2, '🗺 КАРТА', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        mapBtn.on('pointerdown', () => {
            this.scene.start('WorldMapScene');
        });

        mapBtn.on('pointerover', () => {
            mapBg2.clear();
            mapBg2.fillStyle(0x777777, 1);
            mapBg2.fillRoundedRect(mapBg2X - 4, mapBg2Y - 4, mapBg2W + 8, mapBg2H + 8, 18);
            mapBg2.lineStyle(3, 0xffcc00, 1);
            mapBg2.strokeRoundedRect(mapBg2X - 4, mapBg2Y - 4, mapBg2W + 8, mapBg2H + 8, 18);
            mapBtn.setScale(1.05);
        });

        mapBtn.on('pointerout', () => {
            mapBg2.clear();
            mapBg2.fillStyle(0x555555, 1);
            mapBg2.fillRoundedRect(mapBg2X, mapBg2Y, mapBg2W, mapBg2H, 16);
            mapBg2.lineStyle(2, 0xffcc00, 1);
            mapBg2.strokeRoundedRect(mapBg2X, mapBg2Y, mapBg2W, mapBg2H, 16);
            mapBtn.setScale(1);
        });

        // Coin reward text (hidden initially)
        const coinText = this.add.text(0, 50, '', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(0.5).setVisible(false);

        this.gameOverPanel.add([bg, title, scoreText, coinText, restartBg, restartBtn, mapBg2, mapBtn]);
        this.gameOverPanel.setVisible(false);
        this.gameOverPanel.setData('scoreText', scoreText);
        this.gameOverPanel.setData('titleText', title);
        this.gameOverPanel.setData('coinText', coinText);
    }

    private createBoostersPanel() {
        const panelY = 1020;
        const spacing = 120;
        const startX = 360 - spacing;

        const boosterCost = 50; // Coins to buy one booster

        // Background panel for boosters
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x222222, 0.85);
        panelBg.fillRoundedRect(30, panelY - 22, 660, 55, 12);
        panelBg.lineStyle(2, 0xffcc00, 0.3);
        panelBg.strokeRoundedRect(30, panelY - 22, 660, 55, 12);
        panelBg.setDepth(0);

        // "Бустеры:" label
        this.add.text(50, panelY, 'Бустеры:', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#aaaaaa',
        }).setOrigin(0, 0.5).setDepth(1);

        // Booster: Light Ball
        this.boosterLightBallText = this.add.text(startX, panelY, `⚡ ${this.boosterLightBall}`, {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1);

        this.boosterLightBallText.on('pointerdown', () => {
            if (this.boosterLightBall > 0) {
                this.boosterLightBall--;
                this.activateBooster('lightball');
                this.updateBoosterTexts();
            } else {
                this.purchaseBooster('lightball', boosterCost);
            }
        });

        // Booster: Bomb
        this.boosterBombText = this.add.text(startX + spacing, panelY, `💣 ${this.boosterBomb}`, {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1);

        this.boosterBombText.on('pointerdown', () => {
            if (this.boosterBomb > 0) {
                this.boosterBomb--;
                this.activateBooster('bomb');
                this.updateBoosterTexts();
            } else {
                this.purchaseBooster('bomb', boosterCost);
            }
        });

        // Booster: Disco Ball
        this.boosterDiscoText = this.add.text(startX + spacing * 2, panelY, `🌈 ${this.boosterDisco}`, {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1);

        this.boosterDiscoText.on('pointerdown', () => {
            if (this.boosterDisco > 0) {
                this.boosterDisco--;
                this.activateBooster('disco');
                this.updateBoosterTexts();
            } else {
                this.purchaseBooster('disco', boosterCost);
            }
        });

        // Store original styles for visual feedback restoration
        this.boosterOrigColors['lightball'] = '#ffffff';
        this.boosterOrigColors['bomb'] = '#ffffff';
        this.boosterOrigColors['disco'] = '#ffffff';
    }

    private activateBooster(type: 'lightball' | 'bomb' | 'disco') {
        // Set active booster - next swap will trigger the effect
        this.activeBooster = type;
        soundManager.playClick();

        // Visual feedback: highlight the active booster button
        const btn = this.getBoosterText(type);
        if (btn) {
            this.boosterOrigColors[type] = btn.style.color as string;
            btn.setColor('#ffff00');
            this.tweens.add({
                targets: btn,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 200,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }

        console.log(`Active booster: ${type} - next swap will trigger effect`);
    }

    private async applyBoosterEffect(type: string, item: FoodItem) {
        const row = item.gridRow;
        const col = item.gridCol;
        
        // Play booster activation sound
        soundManager.playDestroy();
        
        if (type === 'bomb') {
            // Shockwave effect at bomb center
            this.createShockwave(item.x, item.y);
            soundManager.playShockwave();
            
            // Destroy 3x3 area
            for (let r = Math.max(0, row - 1); r <= Math.min(GRID_ROWS - 1, row + 1); r++) {
                for (let c = Math.max(0, col - 1); c <= Math.min(GRID_COLS - 1, col + 1); c++) {
                    const target = this.grid[r][c];
                    if (target) this.destroyItem(target);
                }
            }
        } else if (type === 'lightball') {
            // Destroy all of same type
            const targetType = item.foodType;
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    const target = this.grid[r][c];
                    if (target && target.foodType === targetType) this.destroyItem(target);
                }
            }
        } else if (type === 'disco') {
            // Change all of one type to another
            const targetType = item.foodType;
            const newType = FOOD_TYPES[(FOOD_TYPES.indexOf(targetType) + 1) % FOOD_COUNT];
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    const target = this.grid[r][c];
                    if (target && target.foodType === targetType) {
                        target.setTexture(newType);
                        target.foodType = newType;
                    }
                }
            }
        }
        
        await this.dropItems();
        await this.fillEmptySpaces();
        soundManager.playDestroy();

        // Reset booster button visual
        this.resetBoosterStyles();
    }

    private getBoosterText(type: string): Phaser.GameObjects.Text | null {
        switch (type) {
            case 'lightball': return this.boosterLightBallText;
            case 'bomb': return this.boosterBombText;
            case 'disco': return this.boosterDiscoText;
            default: return null;
        }
    }

    private updateBoosterTexts() {
        this.boosterLightBallText.setText(`⚡ ${this.boosterLightBall}`);
        this.boosterBombText.setText(`💣 ${this.boosterBomb}`);
        this.boosterDiscoText.setText(`🌈 ${this.boosterDisco}`);
    }

    private resetBoosterStyles() {
        const resetBtn = (btn: Phaser.GameObjects.Text, origColor: string) => {
            if (btn) {
                btn.setColor(origColor);
                btn.setScale(1);
            }
        };
        resetBtn(this.boosterLightBallText, this.boosterOrigColors['lightball'] || '#ffffff');
        resetBtn(this.boosterBombText, this.boosterOrigColors['bomb'] || '#ffffff');
        resetBtn(this.boosterDiscoText, this.boosterOrigColors['disco'] || '#ffffff');
    }

    private purchaseBooster(type: 'lightball' | 'bomb' | 'disco', cost: number) {
        if (this.levelManager.spendCoins(cost)) {
            // Grant booster
            switch (type) {
                case 'lightball': this.boosterLightBall++; break;
                case 'bomb': this.boosterBomb++; break;
                case 'disco': this.boosterDisco++; break;
            }
            this.updateBoosterTexts();
            this.updateCoinsDisplay();
            soundManager.playClick();

            // Show purchase feedback text
            const btn = this.getBoosterText(type);
            if (btn) {
                const feedback = this.add.text(btn.x, btn.y - 30, '+1', {
                    fontSize: '24px',
                    fontFamily: 'Arial',
                    color: '#00ff88',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3,
                }).setOrigin(0.5).setDepth(100);

                this.tweens.add({
                    targets: feedback,
                    y: feedback.y - 30,
                    alpha: 0,
                    duration: 800,
                    ease: 'Power2',
                    onComplete: () => feedback.destroy()
                });
            }
        } else {
            // Not enough coins — show feedback
            const btn = this.getBoosterText(type);
            if (btn) {
                const feedback = this.add.text(btn.x, btn.y - 30, 'Нет монет', {
                    fontSize: '18px',
                    fontFamily: 'Arial',
                    color: '#ff4444',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3,
                }).setOrigin(0.5).setDepth(100);

                this.tweens.add({
                    targets: feedback,
                    y: feedback.y - 30,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Power2',
                    onComplete: () => feedback.destroy()
                });
            }
        }
    }

    private destroyItem(item: FoodItem) {
        item.destroy();
        this.grid[item.gridRow][item.gridCol] = null;
    }

    private initGrid() {
        this.grid = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            this.grid[row] = [];
            for (let col = 0; col < GRID_COLS; col++) {
                this.grid[row][col] = null;
            }
        }
    }

    private fillBoard() {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                this.createFoodItem(row, col);
            }
        }
    }

    private createFoodItem(row: number, col: number): FoodItem {
        const foodType = this.getRandomFoodType(row, col);
        // Add half cell size to center the item in the cell
        const x = GRID_OFFSET_X + col * CELL_SIZE;
        const y = GRID_OFFSET_Y + row * CELL_SIZE;

        const item = new FoodItem(this, row, col, foodType, x, y);

        this.grid[row][col] = item;

        // Create optimized shadow (pre-rendered texture, cheap Sprite)
        const shadow = this.add.sprite(x, y + 4, 'item_shadow');
        shadow.setOrigin(0.5, 0.5);
        shadow.setAlpha(0.6);
        shadow.setDepth(item.depth - 1); // Render below item
        item.shadow = shadow;

        // Cleanup shadow when item is destroyed
        item.once('destroy', () => {
            if (item.shadow) {
                item.shadow.destroy();
                item.shadow = null;
            }
        });

        // Swipe/drag handler only (no click)
        item.on('dragstart', (_pointer: Phaser.Input.Pointer) => {
            if (!this.isProcessing && !item.isMoving) {
                this.selectedItem = item;
                item.isMoving = true; // Prevent idle animation during drag
                item.setDepth(10); // Bring to front while dragging
                this.highlightSelected(item);
                this.clearHint();
                this.resetHintTimer();
            }
        });

        item.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (this.isProcessing || !this.selectedItem) return;

            // Direct position update — fast, no tween overhead
            item.x = dragX;
            item.y = dragY;
        });

        item.on('dragend', (pointer: Phaser.Input.Pointer) => {
            const startX = GRID_OFFSET_X + item.gridCol * CELL_SIZE;
            const startY = GRID_OFFSET_Y + item.gridRow * CELL_SIZE;

            if (!this.selectedItem || this.isProcessing) {
                this.clearHighlight(item);
                item.x = startX;
                item.y = startY;
                item.isMoving = false;
                item.setDepth(1);
                return;
            }

            // Calculate swipe direction
            const deltaX = pointer.x - startX;
            const deltaY = pointer.y - startY;

            let targetRow = item.gridRow;
            let targetCol = item.gridCol;

            // Determine direction based on largest delta
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (Math.abs(deltaX) > CELL_SIZE / 3) {
                    targetCol = deltaX > 0 ? item.gridCol + 1 : item.gridCol - 1;
                }
            } else {
                // Vertical swipe
                if (Math.abs(deltaY) > CELL_SIZE / 3) {
                    targetRow = deltaY > 0 ? item.gridRow + 1 : item.gridRow - 1;
                }
            }

            // Check if target is valid and adjacent
            if (targetRow >= 0 && targetRow < GRID_ROWS && targetCol >= 0 && targetCol < GRID_COLS) {
                const targetItem = this.grid[targetRow][targetCol];
                if (targetItem && this.areAdjacent(item, targetItem)) {
                    item.isMoving = false;
                    item.setDepth(1);
                    this.clearHighlight(item);
                    this.trySwap(item, targetItem);
                    this.selectedItem = null;
                    return;
                }
            }

            // Reset position if no valid swap
            this.clearHighlight(item);
            item.isMoving = false;
            item.setDepth(1);
            this.selectedItem = null;
            this.tweens.add({
                targets: item,
                x: startX,
                y: startY,
                duration: 150,
                ease: 'Power2'
            });
        });

        // Enable dragging
        this.input.setDraggable(item);

        return item;
    }

    private getRandomFoodType(row: number, col: number): string {
        const availableTypes: string[] = [];

        for (const type of FOOD_TYPES) {
            if (!this.wouldCreateMatch(row, col, type)) {
                availableTypes.push(type);
            }
        }

        if (availableTypes.length === 0) {
            return FOOD_TYPES[Math.floor(Math.random() * FOOD_COUNT)];
        }

        return availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }

    private wouldCreateMatch(row: number, col: number, foodType: string): boolean {
        if (col >= 2) {
            const left1 = this.grid[row][col - 1];
            const left2 = this.grid[row][col - 2];
            if (left1 && left2 && left1.foodType === foodType && left2.foodType === foodType) {
                return true;
            }
        }

        if (row >= 2) {
            const up1 = this.grid[row - 1][col];
            const up2 = this.grid[row - 2][col];
            if (up1 && up2 && up1.foodType === foodType && up2.foodType === foodType) {
                return true;
            }
        }

        return false;
    }

    private areAdjacent(item1: FoodItem, item2: FoodItem): boolean {
        const rowDiff = Math.abs(item1.gridRow - item2.gridRow);
        const colDiff = Math.abs(item1.gridCol - item2.gridCol);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    private async trySwap(item1: FoodItem, item2: FoodItem) {
        this.isProcessing = true;

        // Check for active booster
        if (this.activeBooster) {
            await this.applyBoosterEffect(this.activeBooster, item1);
            this.activeBooster = null;
            this.isProcessing = false;
            return;
        }

        const row1 = item1.gridRow, col1 = item1.gridCol;
        const row2 = item2.gridRow, col2 = item2.gridCol;

        this.grid[row1][col1] = item2;
        this.grid[row2][col2] = item1;

        item1.gridRow = row2;
        item1.gridCol = col2;
        item2.gridRow = row1;
        item2.gridCol = col1;

        const x1 = GRID_OFFSET_X + col2 * CELL_SIZE;
        const y1 = GRID_OFFSET_Y + row2 * CELL_SIZE;
        const x2 = GRID_OFFSET_X + col1 * CELL_SIZE;
        const y2 = GRID_OFFSET_Y + row1 * CELL_SIZE;

        // Create swap trails
        this.createSwapTrail(item1);
        this.createSwapTrail(item2);

        await Promise.all([
            item1.animateSwap(x1, y1),
            item2.animateSwap(x2, y2)
        ]);

        // Clean up trails after animation
        this.clearSwapTrail(item1);
        this.clearSwapTrail(item2);

        const matches = this.findMatches();

        if (matches.length > 0) {
            soundManager.playSwap();
            this.movesRemaining--;
            this.resetHintTimer();
            this.updateUI();
            this.comboLevel = 0;
            await this.processMatches(matches);
        } else {
            this.grid[row1][col1] = item1;
            this.grid[row2][col2] = item2;
            item1.gridRow = row1;
            item1.gridCol = col1;
            item2.gridRow = row2;
            item2.gridCol = col2;

            await Promise.all([
                item1.animateSwap(x2, y2),
                item2.animateSwap(x1, y1)
            ]);
        }

        this.isProcessing = false;
    }

    private findMatches(): MatchResult[] {
        const grid: (string | null)[][] = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            grid[row] = [];
            for (let col = 0; col < GRID_COLS; col++) {
                const item = this.grid[row][col];
                grid[row][col] = item ? item.foodType : null;
            }
        }
        return MatchFinder.findAllMatches(grid);
    }

    private async processMatches(matches: MatchResult[]) {
        this.comboLevel++;

        let totalPoints = 0;
        matches.forEach(match => {
            totalPoints += match.positions.length * POINTS_PER_GEM * this.comboLevel;
        });

        this.score += totalPoints;
        this.updateUI();
        this.showCombo();

        // Sound effects
        const maxMatchLen = Math.max(...matches.map(m => m.positions.length));
        soundManager.playMatch(maxMatchLen);
        if (this.comboLevel > 1) {
            soundManager.playCombo(this.comboLevel);
        }

        // Screen shake on big combos
        if (this.comboLevel >= 3) {
            this.cameras.main.shake(200, 0.005 * this.comboLevel);
        }

        const toDestroy: FoodItem[] = [];
        const specialSpawns: { row: number; col: number; type: 'bomb' | 'rainbow' | 'row_clear' | 'col_clear'; foodType: string }[] = [];

        // Activate special tile effects
        matches.forEach(match => {
            match.positions.forEach(pos => {
                const item = this.grid[pos.row][pos.col];
                if (item && item.specialType !== 'none' && !item.isMatched) {
                    item.isMatched = true;
                    toDestroy.push(item);
                    this.grid[pos.row][pos.col] = null;
                    this.activateSpecial(item, pos.row, pos.col, matches, toDestroy);
                }
            });
        });

        matches.forEach(match => {
            // Determine if this match should create a special tile
            const len = match.positions.length;
            let specialType: 'bomb' | 'rainbow' | 'row_clear' | 'col_clear' | null = null;

            if (len >= 5) {
                specialType = 'rainbow';
                // Chain lightning effect for 5+ matches
                const matchCenter = {
                    x: GRID_OFFSET_X + match.positions[Math.floor(len / 2)].col * CELL_SIZE,
                    y: GRID_OFFSET_Y + match.positions[Math.floor(len / 2)].row * CELL_SIZE,
                };
                const lightningTargets = match.positions.map(pos => ({
                    x: GRID_OFFSET_X + pos.col * CELL_SIZE,
                    y: GRID_OFFSET_Y + pos.row * CELL_SIZE,
                }));
                this.createChainLightning(matchCenter.x, matchCenter.y, lightningTargets);
                soundManager.playLightning();
            } else if (len === 4) {
                specialType = 'bomb';
            }

            match.positions.forEach((pos, idx) => {
                const item = this.grid[pos.row][pos.col];
                if (item && !item.isMatched) {
                    // If this is a special-creating match and this is the center position, mark it
                    if (specialType && idx === Math.floor(len / 2)) {
                        specialSpawns.push({
                            row: pos.row,
                            col: pos.col,
                            type: specialType,
                            foodType: item.foodType,
                        });
                        // Don't destroy this item — it becomes special
                        return;
                    }

                    item.isMatched = true;
                    toDestroy.push(item);
                    this.grid[pos.row][pos.col] = null;

                    // Score popup at match position
                    const points = POINTS_PER_GEM * this.comboLevel;
                    this.showScorePopup(
                        GRID_OFFSET_X + pos.col * CELL_SIZE,
                        GRID_OFFSET_Y + pos.row * CELL_SIZE,
                        points
                    );

                    // Simple particle burst
                    this.emitParticles(
                        GRID_OFFSET_X + pos.col * CELL_SIZE,
                        GRID_OFFSET_Y + pos.row * CELL_SIZE,
                        item.foodType
                    );
                }
            });
        });

        // Apply special tile effects
        for (const spawn of specialSpawns) {
            const item = this.grid[spawn.row][spawn.col];
            if (item) {
                item.specialType = spawn.type;
                item.setSpecialVisual();
            }
        }

        await Promise.all(toDestroy.map(item => item.animateDestroy()));

        await this.dropItems();
        await this.fillEmptySpaces();

        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
            await this.processMatches(newMatches);
        } else {
            await this.checkAndReshuffle();
            this.checkGameState();
        }
    }

    private activateSpecial(item: FoodItem, row: number, col: number, _matches: MatchResult[], toDestroy: FoodItem[]) {
        switch (item.specialType) {
            case 'bomb':
                // Shockwave effect
                this.createShockwave(item.x, item.y);
                soundManager.playShockwave();
                // Destroy 3×3 area around the bomb
                for (let r = row - 1; r <= row + 1; r++) {
                    for (let c = col - 1; c <= col + 1; c++) {
                        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                            const target = this.grid[r][c];
                            if (target && !target.isMatched) {
                                target.isMatched = true;
                                toDestroy.push(target);
                                this.grid[r][c] = null;
                                this.showScorePopup(
                                    GRID_OFFSET_X + c * CELL_SIZE,
                                    GRID_OFFSET_Y + r * CELL_SIZE,
                                    POINTS_PER_GEM * this.comboLevel
                                );
                            }
                        }
                    }
                }
                this.cameras.main.shake(150, 0.008);
                break;

            case 'rainbow':
                // Destroy all items of a random type (excluding other specials)
                const allTypes = new Set<string>();
                for (let r = 0; r < GRID_ROWS; r++) {
                    for (let c = 0; c < GRID_COLS; c++) {
                        const t = this.grid[r][c];
                        if (t && t.specialType === 'none' && !t.isMatched) {
                            allTypes.add(t.foodType);
                        }
                    }
                }
                if (allTypes.size > 0) {
                    const typesArr = Array.from(allTypes);
                    const chosenType = typesArr[Math.floor(Math.random() * typesArr.length)];
                    for (let r = 0; r < GRID_ROWS; r++) {
                        for (let c = 0; c < GRID_COLS; c++) {
                            const t = this.grid[r][c];
                            if (t && t.foodType === chosenType && !t.isMatched) {
                                t.isMatched = true;
                                toDestroy.push(t);
                                this.grid[r][c] = null;
                                this.showScorePopup(
                                    GRID_OFFSET_X + c * CELL_SIZE,
                                    GRID_OFFSET_Y + r * CELL_SIZE,
                                    POINTS_PER_GEM * this.comboLevel
                                );
                            }
                        }
                    }
                }
                this.cameras.main.flash(300, 255, 255, 255, false);
                break;

            case 'row_clear':
                // Destroy entire row
                for (let c = 0; c < GRID_COLS; c++) {
                    const t = this.grid[row][c];
                    if (t && !t.isMatched) {
                        t.isMatched = true;
                        toDestroy.push(t);
                        this.grid[row][c] = null;
                        this.showScorePopup(
                            GRID_OFFSET_X + c * CELL_SIZE,
                            GRID_OFFSET_Y + row * CELL_SIZE,
                            POINTS_PER_GEM * this.comboLevel
                        );
                    }
                }
                break;

            case 'col_clear':
                // Destroy entire column
                for (let r = 0; r < GRID_ROWS; r++) {
                    const t = this.grid[r][col];
                    if (t && !t.isMatched) {
                        t.isMatched = true;
                        toDestroy.push(t);
                        this.grid[r][col] = null;
                        this.showScorePopup(
                            GRID_OFFSET_X + col * CELL_SIZE,
                            GRID_OFFSET_Y + r * CELL_SIZE,
                            POINTS_PER_GEM * this.comboLevel
                        );
                    }
                }
                break;
        }
    }

    private async checkAndReshuffle() {
        const typeGrid = this.buildTypeGrid();
        if (!MatchFinder.hasValidMoves(typeGrid)) {
            await this.reshuffleBoard();
        }
    }

    private async reshuffleBoard() {
        // Collect all items
        const items: FoodItem[] = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const item = this.grid[row][col];
                if (item) items.push(item);
            }
        }

        for (let attempt = 0; attempt < SHUFFLE_ATTEMPTS; attempt++) {
            // Fisher-Yates shuffle of food types
            const types = items.map(i => i.foodType);
            for (let i = types.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [types[i], types[j]] = [types[j], types[i]];
            }

            // Build temp grid
            const tempGrid: (string | null)[][] = [];
            for (let row = 0; row < GRID_ROWS; row++) {
                tempGrid[row] = [];
                for (let col = 0; col < GRID_COLS; col++) {
                    tempGrid[row][col] = null;
                }
            }
            items.forEach((item, idx) => {
                tempGrid[item.gridRow][item.gridCol] = types[idx];
            });

            // Check no initial matches and has valid moves
            const initialMatches = MatchFinder.findAllMatches(tempGrid);
            if (initialMatches.length === 0 && MatchFinder.hasValidMoves(tempGrid)) {
                // Apply new types
                items.forEach((item, idx) => {
                    if (item.foodType !== types[idx]) {
                        item.foodType = types[idx];
                        item.setTexture(types[idx]);
                        // Recalculate scale for new texture
                        const maxSize = CELL_SIZE - 10;
                        const scale = Math.min(maxSize / item.width, maxSize / item.height);
                        item.setScale(scale);
                    }
                });
                // Flash animation
                await Promise.all(items.map(item => {
                    return new Promise<void>(resolve => {
                        this.tweens.add({
                            targets: item,
                            alpha: 0.3,
                            duration: 150,
                            yoyo: true,
                            onComplete: () => resolve()
                        });
                    });
                }));
                return;
            }
        }
        // If no valid arrangement found after attempts, just keep current state
    }

    private buildTypeGrid(): (string | null)[][] {
        const grid: (string | null)[][] = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            grid[row] = [];
            for (let col = 0; col < GRID_COLS; col++) {
                const item = this.grid[row][col];
                grid[row][col] = item ? item.foodType : null;
            }
        }
        return grid;
    }

    private async dropItems() {
        const dropPromises: Promise<void>[] = [];

        for (let col = 0; col < GRID_COLS; col++) {
            let emptyRow = GRID_ROWS - 1;

            for (let row = GRID_ROWS - 1; row >= 0; row--) {
                const item = this.grid[row][col];

                if (item !== null) {
                    if (row !== emptyRow) {
                        this.grid[emptyRow][col] = item;
                        this.grid[row][col] = null;
                        item.gridRow = emptyRow;
                        const targetY = GRID_OFFSET_Y + emptyRow * CELL_SIZE;
                        dropPromises.push(item.animateDrop(targetY, emptyRow - row));
                    }
                    emptyRow--;
                }
            }
        }

        await Promise.all(dropPromises);
    }

    private async fillEmptySpaces() {
        const promises: Promise<void>[] = [];

        for (let col = 0; col < GRID_COLS; col++) {
            for (let row = GRID_ROWS - 1; row >= 0; row--) {
                if (this.grid[row][col] === null) {
                    const item = this.createFoodItem(row, col);

                    // Animation setup
                    const targetY = item.y;
                    item.y = GRID_OFFSET_Y - CELL_SIZE * 2;
                    item.setAlpha(0);

                    this.tweens.add({
                        targets: item,
                        alpha: 1,
                        duration: 200
                    });

                    // We use row + 2 as distance approximation for speed
                    promises.push(item.animateDrop(targetY, row + 2));
                }
            }
        }

        await Promise.all(promises);
    }

    private updateUI() {
        // Animate score with scale pop
        this.scoreText.setText(`Счёт: ${this.score}`);
        this.tweens.killTweensOf(this.scoreText);
        this.scoreText.setScale(1.1);
        this.tweens.add({
            targets: this.scoreText,
            scale: 1,
            duration: 150,
            ease: 'Sine.easeOut'
        });

        // Floating score bubble near top bar
        this.createScoreBubble(POINTS_PER_GEM);

        // Flash moves red when decreasing
        this.movesText.setText(`Ходы: ${this.movesRemaining}`);
        this.tweens.killTweensOf(this.movesText);
        this.movesText.setTint(0xff0000);
        this.tweens.add({
            targets: this.movesText,
            duration: 200,
            onComplete: () => {
                if (this.movesText && this.movesText.active) {
                    this.movesText.clearTint();
                }
            }
        });

        this.drawProgressBar();
    }

    private updateCoinsDisplay() {
        const coins = this.levelManager.getCoins();
        this.coinsText.setText(`🪙 ${coins}`);
        // Animate coins with scale pop
        this.tweens.killTweensOf(this.coinsText);
        this.coinsText.setScale(1.2);
        this.tweens.add({
            targets: this.coinsText,
            scale: 1,
            duration: 200,
            ease: 'Sine.easeOut'
        });
    }

    private drawProgressBar() {
        const progress = Math.min(this.score / this.targetScore, 1);
        const progressPct = Math.floor(progress * 100);

        // Skip redraw if progress hasn't changed significantly (perf)
        if (progressPct === this.lastProgressPct) return;
        this.lastProgressPct = progressPct;

        const barX = 50;
        const barY = 88;
        const barW = 620;
        const barH = 14;

        this.progressBar.clear();
        
        // Dark semi-transparent background
        this.progressBar.fillStyle(0x000000, 0.5);
        this.progressBar.fillRoundedRect(barX, barY, barW, barH, 7);
        
        // Border
        this.progressBar.lineStyle(1, 0xffffff, 0.2);
        this.progressBar.strokeRoundedRect(barX, barY, barW, barH, 7);

        // Progress fill with gradient (yellow→green)
        if (progress > 0) {
            const fillW = barW * progress;
            // Only use gradient if wide enough (>= 20px)
            if (fillW >= 20) {
                const colorLeft = progress >= 0.66 ? 0x44ff44 : (progress >= 0.33 ? 0xaadd00 : 0xffcc00);
                const colorRight = 0x44ff44;
                this.progressBar.fillGradientStyle(colorLeft, colorRight, colorLeft, colorRight, 1);
            } else {
                this.progressBar.fillStyle(0xffcc00, 1);
            }
            this.progressBar.fillRoundedRect(barX, barY, fillW, barH, 7);
            
            // Glow effect when at 100%
            if (progress >= 1) {
                this.progressBar.fillStyle(0x00ff88, 0.3);
                this.progressBar.fillRoundedRect(barX - 3, barY - 3, barW + 6, barH + 6, 10);
            }
        }

        // Update star markers — activate stars when milestones reached
        const threshholds = [0.33, 0.66, 1.0];
        this.children.list.forEach(child => {
            if (child instanceof Phaser.GameObjects.Text && child.getData('starIdx') !== undefined) {
                const idx = child.getData('starIdx') as number;
                const threshold = threshholds[idx];
                const activated = child.getData('activated') as boolean;
                if (progress >= threshold && !activated) {
                    child.setData('activated', true);
                    child.setText('⭐');
                    // Animate star — scale 0 → 1.2 → 1
                    child.setScale(0);
                    this.tweens.killTweensOf(child);
                    this.tweens.add({
                        targets: child,
                        scale: 1.2,
                        duration: 200,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            this.tweens.add({
                                targets: child,
                                scale: 1,
                                duration: 100,
                                ease: 'Sine.easeOut'
                            });
                        }
                    });
                }
            }
        });
    }

    private showCombo() {
        if (this.comboLevel > 1) {
            this.comboText.setText(`КОМБО x${this.comboLevel}!`);
            this.comboText.setVisible(true);

            this.time.delayedCall(1000, () => {
                this.comboText.setVisible(false);
            });
        }
    }

    private showScorePopup(x: number, y: number, points: number) {
        const isCombo = this.comboLevel >= 2;
        const text = this.add.text(x, y - 20, `+${points}`, {
            fontSize: isCombo ? '28px' : '22px',
            fontFamily: 'Arial',
            color: isCombo ? '#ff00ff' : '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: text,
            y: y - 70,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    // Highlight methods for selected item
    private highlightSelected(item: FoodItem) {
        this.tweens.killTweensOf(item);
        // Use glow sprite under item instead of tint
        const existingGlow = (item as any).__glowSprite as Phaser.GameObjects.Sprite | undefined;
        if (existingGlow && existingGlow.active) {
            existingGlow.destroy();
        }
        const glow = this.createGlowSprite(item);
        if (glow) {
            (item as any).__glowSprite = glow;
        }
        this.tweens.add({
            targets: item,
            scaleX: item.scaleX * 1.12,
            scaleY: item.scaleY * 1.12,
            duration: 150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private clearHighlight(item: FoodItem) {
        this.tweens.killTweensOf(item);
        // Clean up glow sprite
        const existingGlow = (item as any).__glowSprite as Phaser.GameObjects.Sprite | undefined;
        if (existingGlow && existingGlow.active) {
            existingGlow.destroy();
            (item as any).__glowSprite = undefined;
        }
        if (item.specialType === 'none') {
            item.clearTint();
        } else {
            // Re-apply special visual since clearTint was called during killTweensOf
            item.specialType = item.specialType; // no-op setter
            item.setSpecialVisual();
        }
        // Reset scale back to normal
        const maxSize = CELL_SIZE - 10;
        const normalScale = Math.min(maxSize / item.width, maxSize / item.height);
        item.setScale(normalScale);
    }

    private emitParticles(x: number, y: number, foodType: string) {
        // Optimized: limit active particles to 10 (pool-like behavior)
        const activeParticles = this.children.getChildren().filter(c => c.active && c.name === 'particle').length;
        if (activeParticles >= 10) return;

        const colors: Record<string, number> = {
            manti: 0xffffff,
            belyash: 0xffcc00,
            cheburek: 0xff8844,
            samsa: 0xffaa33,
            pakhlava: 0xdaa520,
            borsok: 0xffd700,
        };
        const color = colors[foodType] || 0xffffff;

        // Royal Match style: mix of sparkles and stars
        for (let i = 0; i < 3; i++) {
            // Main particle
            const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), color, 0.8)
                .setDepth(49)
                .setName('particle');

            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 30;

            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });

            // Sparkle particle (star-like, brighter)
            if (i === 0) {
                const sparkle = this.add.star(x, y, 4, 2, 5, 0xffffff, 0.9)
                    .setDepth(50)
                    .setName('particle')
                    .setScale(0);

                this.tweens.add({
                    targets: sparkle,
                    scale: 1,
                    alpha: 0,
                    duration: 400,
                    ease: 'Back.easeOut',
                    onComplete: () => sparkle.destroy()
                });
            }
        }
    }

    // Hint system
    private resetHintTimer() {
        this.clearHint();
        if (this.hintTimer) {
            this.hintTimer.remove(false);
            this.hintTimer = null;
        }
        this.hintTimer = this.time.delayedCall(HINT_DELAY, () => {
            this.showHint();
        });
    }

    private clearHint() {
        this.hintItems.forEach(item => {
            if (item && item.scene) {
                this.tweens.killTweensOf(item);
                if (item instanceof FoodItem) {
                    item.isTweening = false;
                    if (item.specialType === 'none') {
                        item.clearTint();
                    } else {
                        item.setSpecialVisual();
                    }
                    // Reset scale
                    const maxSize = CELL_SIZE - 10;
                    const normalScale = Math.min(maxSize / item.width, maxSize / item.height);
                    item.setScale(normalScale);
                } else if (item instanceof Phaser.GameObjects.Text) {
                    // Arrow text — destroy it
                    item.destroy();
                }
            }
        });
        this.hintItems = [];
    }

    private showHint() {
        const typeGrid = this.buildTypeGrid();
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                // Try right swap
                if (col < GRID_COLS - 1) {
                    const tempGrid = typeGrid.map(r => [...r]);
                    const t = tempGrid[row][col];
                    tempGrid[row][col] = tempGrid[row][col + 1];
                    tempGrid[row][col + 1] = t;
                    const m = MatchFinder.findAllMatches(tempGrid);
                    if (m.length > 0) {
                        this.highlightHintPair(row, col, row, col + 1);
                        return;
                    }
                }
                // Try down swap
                if (row < GRID_ROWS - 1) {
                    const tempGrid = typeGrid.map(r => [...r]);
                    const t = tempGrid[row][col];
                    tempGrid[row][col] = tempGrid[row + 1][col];
                    tempGrid[row + 1][col] = t;
                    const m = MatchFinder.findAllMatches(tempGrid);
                    if (m.length > 0) {
                        this.highlightHintPair(row, col, row + 1, col);
                        return;
                    }
                }
            }
        }
    }

    private highlightHintPair(r1: number, c1: number, r2: number, c2: number) {
        const item1 = this.grid[r1][c1];
        const item2 = this.grid[r2][c2];
        if (item1) {
            this.tweens.killTweensOf(item1);
            item1.isTweening = false;
            this.tweens.add({
                targets: item1,
                scaleX: item1.scaleX * 1.15,
                scaleY: item1.scaleY * 1.15,
                duration: 300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.hintItems.push(item1);
        }
        if (item2) {
            this.tweens.killTweensOf(item2);
            item2.isTweening = false;
            this.tweens.add({
                targets: item2,
                scaleX: item2.scaleX * 1.15,
                scaleY: item2.scaleY * 1.15,
                duration: 300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.hintItems.push(item2);
        }

        // Add arrow between the two items
        if (item1 && item2) {
            const midX = (item1.x + item2.x) / 2;
            const midY = (item1.y + item2.y) / 2;
            const arrow = this.add.text(midX, midY - 40, '↔', {
                fontSize: '28px',
                fontFamily: 'Arial',
                color: '#ffff00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(55).setAlpha(0);

            this.tweens.add({
                targets: arrow,
                alpha: 1,
                y: midY - 50,
                duration: 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.hintItems.push(arrow as any);
        }

        // Play hint sound
        soundManager.playClick();
    }

    private checkGameState() {
        if (this.score >= this.targetScore) {
            this.clearHint();
            this.gameWin();
        } else if (this.movesRemaining <= 0) {
            this.clearHint();
            this.gameLose();
        } else {
            this.resetHintTimer();
        }
    }

    private gameWin() {
        soundManager.playWin();
        this.saveBestScore();
        
        // Calculate and save stars
        const stars = this.levelManager.calculateStars(this.score, this.targetScore);
        const currentLevel = this.levelManager.getLevel();
        this.levelManager.setStars(currentLevel, stars);
        
        // Award coins (100 per star)
        const coinsEarned = this.levelManager.earnLevelCoins(stars);
        
        this.levelManager.nextLevel();
        
        // Show coins earned in game over panel
        const coinText = this.gameOverPanel.getData('coinText') as Phaser.GameObjects.Text;
        if (coinText) {
            coinText.setText(`🪙 +${coinsEarned} монет`);
            coinText.setVisible(true);
        }
        
        if (this.levelManager.isLastLevel()) {
            this.showGameOver('ВСЕ УРОВНИ ПРОЙДЕНЫ! 🏆', true);
        } else {
            const nextConfig = this.levelManager.getConfig();
            this.showGameOver(`УРОВЕНЬ ${nextConfig.level - 1} ПРОЙДЕН!`, true);
        }
        
        // Navigate to World Map after delay
        this.time.delayedCall(2500, () => {
            this.scene.start('WorldMapScene');
        });
    }

    private gameLose() {
        soundManager.playLose();
        this.saveBestScore();
        this.showGameOver('ИГРА ОКОНЧЕНА', false);
        
        // Navigate to World Map after delay
        this.time.delayedCall(2500, () => {
            this.scene.start('WorldMapScene');
        });
    }

    private showGameOver(title: string, isWin: boolean) {
        const titleText = this.gameOverPanel.getData('titleText') as Phaser.GameObjects.Text;
        const scoreText = this.gameOverPanel.getData('scoreText') as Phaser.GameObjects.Text;

        if (isWin) {
            titleText.setText(`🎉 ${title} 🎉`);
            titleText.setColor('#00ff88');
        } else {
            titleText.setText(`💔 ${title}`);
            titleText.setColor('#ff4444');
        }
        scoreText.setText(`Финальный счёт: ${this.score}`);

        // Royal Match style: animate panel in with scale bounce
        this.gameOverPanel.setAlpha(1);
        this.gameOverPanel.setVisible(true);
        this.gameOverPanel.setScale(0.5);
        this.tweens.add({
            targets: this.gameOverPanel,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Show stars for win
        if (isWin) {
            this.showStars();
        }
    }

    private showStars() {
        // Calculate stars: 1 = reached target, 2 = 1.5x target, 3 = 2x target
        const ratio = this.score / this.targetScore;
        const starCount = ratio >= 2 ? 3 : ratio >= 1.5 ? 2 : 1;

        // Star positions
        const starPositions = [-80, 0, 80];
        const starEmojis = ['⭐', '⭐', '⭐'];

        starPositions.forEach((x, idx) => {
            if (idx < starCount) {
                const star = this.add.text(360 + x, 480, starEmojis[idx], {
                    fontSize: '48px'
                }).setOrigin(0.5).setScale(0).setDepth(101);

                this.tweens.add({
                    targets: star,
                    scale: 1,
                    duration: 400,
                    delay: 300 + idx * 200,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        // Fireworks instead of simple confetti
                        this.emitFireworks();
                        soundManager.playMatch(3); // Celebration sound
                    }
                });
            }
        });
    }

    private saveBestScore() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('samsa_swap_best_score', this.bestScore.toString());
        }
    }

    // ── VFX METHODS ──────────────────────────────────────────────

    /** Shockwave: expanding circle at bomb explosion point */
    private createShockwave(x: number, y: number) {
        const shockwave = this.add.circle(x, y, 10, 0xff6b35, 0.8)
            .setStrokeStyle(4, 0xffffff, 1)
            .setDepth(49);

        this.tweens.add({
            targets: shockwave,
            scaleX: 8,
            scaleY: 8,
            alpha: 0,
            duration: 400,
            ease: 'Sine.easeOut',
            onComplete: () => shockwave.destroy()
        });
    }

    /** Chain lightning: zigzag lines from origin to every destroyed position */
    private createChainLightning(originX: number, originY: number, targets: { x: number; y: number }[]) {
        const lightning = this.add.graphics();
        lightning.setDepth(50);
        lightning.setAlpha(0.8);

        // Draw zigzag from origin to each target
        targets.forEach(t => {
            const steps = 6;

            lightning.lineStyle(2, 0xffff00, 0.8);
            lightning.beginPath();
            lightning.moveTo(originX, originY);

            for (let i = 1; i <= steps; i++) {
                const tween = i / steps;
                const baseX = originX + (t.x - originX) * tween;
                const baseY = originY + (t.y - originY) * tween;
                // Add zigzag offset (perpendicular jitter)
                const perpX = -(t.y - originY);
                const perpY = (t.x - originX);
                const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
                const jitter = (Math.random() - 0.5) * 20 * (1 - tween);
                lightning.lineTo(
                    baseX + (perpX / perpLen) * jitter,
                    baseY + (perpY / perpLen) * jitter
                );
            }
            lightning.lineTo(t.x, t.y);
            lightning.strokePath();
        });

        // Fade out and remove
        this.tweens.add({
            targets: lightning,
            alpha: 0,
            duration: 300,
            delay: 50,
            ease: 'Power2',
            onComplete: () => lightning.destroy()
        });
    }

    /** Trail circles behind swapping items */
    private createSwapTrail(item: FoodItem) {
        if (this.activeBooster) return; // Don't create trail if booster processing

        const trailColors: Record<string, number> = {
            manti: 0xffffff,
            belyash: 0xffcc00,
            cheburek: 0xff8844,
            samsa: 0xffaa33,
            pakhlava: 0xdaa520,
            borsok: 0xffd700,
        };
        const color = trailColors[item.foodType] || 0xffffff;
        const alphas = [0.4, 0.3, 0.2, 0.1];
        const sizes = [20, 16, 12, 8];

        const trailParticles: Phaser.GameObjects.Arc[] = [];
        alphas.forEach((alpha, i) => {
            const circle = this.add.circle(item.x, item.y, sizes[i], color, alpha)
                .setDepth(item.depth - 0.5)
                .setName('trail');
            trailParticles.push(circle);
        });

        // Store trails on the item for cleanup
        (item as any).__trails = trailParticles;
    }

    /** Clean up swap trails */
    private clearSwapTrail(item: FoodItem) {
        const trails: Phaser.GameObjects.Arc[] | undefined = (item as any).__trails;
        if (trails) {
            trails.forEach(t => {
                this.tweens.killTweensOf(t);
                t.destroy();
            });
            (item as any).__trails = undefined;
        }
    }

    /** Fireworks: multiple bursts in random screen positions */
    private emitFireworks() {
        const numBursts = Phaser.Math.Between(3, 5);
        const colors = [0xff0000, 0xffff00, 0x00ff00, 0x0088ff, 0xff69b4];

        for (let b = 0; b < numBursts; b++) {
            const bx = Phaser.Math.Between(100, 620);
            const by = Phaser.Math.Between(200, 700);
            const color = colors[b % colors.length];

            this.time.delayedCall(b * 400, () => {
                const numParticles = Phaser.Math.Between(8, 12);
                for (let i = 0; i < numParticles; i++) {
                    const isStar = i % 3 === 0;
                    let particle: Phaser.GameObjects.Arc | Phaser.GameObjects.Star;

                    if (isStar) {
                        particle = this.add.star(bx, by, 5, 2, 5, color, 0.9)
                            .setDepth(102)
                            .setName('particle')
                            .setScale(0);
                    } else {
                        particle = this.add.circle(bx, by, Phaser.Math.Between(2, 5), color, 0.9)
                            .setDepth(102)
                            .setName('particle');
                    }

                    const angle = (Math.PI * 2 / numParticles) * i + (Math.random() - 0.5) * 0.5;
                    const speed = 40 + Math.random() * 60;

                    // Gravity tween: arc up then fall
                    this.tweens.add({
                        targets: particle,
                        x: bx + Math.cos(angle) * speed,
                        y: by + Math.sin(angle) * speed + 80, // gravity pull down
                        alpha: 0,
                        scale: isStar ? 1.5 : 0,
                        duration: 700 + Math.random() * 300,
                        ease: 'Power2',
                        onComplete: () => particle.destroy()
                    });
                }
                soundManager.playFirework();
            });
        }
    }

    /** Create a glow sprite under a food item */
    private createGlowSprite(item: FoodItem): Phaser.GameObjects.Sprite | null {
        if (!this.textures.exists('food_glow')) return null;

        const glow = this.add.sprite(item.x, item.y, 'food_glow')
            .setDepth(item.depth - 0.5)
            .setAlpha(0.5);

        // For special items, tint the glow
        if (item.specialType !== 'none') {
            switch (item.specialType) {
                case 'bomb': glow.setTint(0xff4444); break;
                case 'rainbow': glow.setTint(0xff00ff); break;
                case 'row_clear': glow.setTint(0x00ff00); break;
                case 'col_clear': glow.setTint(0x0088ff); break;
            }
        }

        // Sync glow position with item
        const sync = () => {
            if (glow.active && item.active) {
                glow.setPosition(item.x, item.y);
                glow.setDepth(item.depth - 0.5);
            } else {
                this.events.off('update', sync);
            }
        };
        this.events.on('update', sync);

        return glow;
    }

    /** Draw a decorative rounded-rect frame around the grid */
    private drawGridFrame() {
        const frame = this.add.graphics();
        const padding = 12;
        const x = GRID_OFFSET_X - CELL_SIZE / 2 - padding;
        const y = GRID_OFFSET_Y - CELL_SIZE / 2 - padding;
        const w = GRID_COLS * CELL_SIZE + padding * 2;
        const h = GRID_ROWS * CELL_SIZE + padding * 2;

        frame.lineStyle(4, 0x4a2a5e, 0.3);
        frame.strokeRoundedRect(x, y, w, h, 16);
        frame.setDepth(0);
    }

    /** Add decorative semi-transparent circles to background for depth */
    private drawDecorativeBackground() {
        // Remove the boring dot pattern and add decorative shapes
        // Remove existing pattern (we'll just add shapes on top)
        const deco = this.add.graphics();
        deco.setDepth(-1);

        const colors = [0x4a2a5e, 0xff6b35, 0x8b5cf6, 0x6d28d9];
        for (let i = 0; i < 15; i++) {
            const cx = Phaser.Math.Between(0, 720);
            const cy = Phaser.Math.Between(0, 1080);
            const radius = Phaser.Math.Between(10, 50);
            const color = colors[i % colors.length];
            const alpha = Phaser.Math.FloatBetween(0.05, 0.1);

            deco.fillStyle(color, alpha);
            deco.fillCircle(cx, cy, radius);
        }
    }

    /** Floating score bubble near the top bar */
    private createScoreBubble(points: number) {
        const bubbleX = this.scoreText.x + 80; // Near score display
        const bubbleY = this.scoreText.y;

        const bg = this.add.circle(bubbleX, bubbleY, 24, 0x000000, 0.6)
            .setDepth(55)
            .setScale(0);

        const label = this.add.text(bubbleX, bubbleY, `+${points}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffcc00',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(56).setScale(0);

        // Animate in with bounce, float up, fade out
        this.tweens.add({
            targets: [bg, label],
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: [bg, label],
                    y: bubbleY - 40,
                    alpha: 0,
                    duration: 600,
                    delay: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        bg.destroy();
                        label.destroy();
                    }
                });
            }
        });
    }

    // ── END VFX METHODS ──────────────────────────────────────────

    private generateTextures() {
        // Generate shadow texture (rendered once, used as cheap Sprite)
        const shadowGfx = this.make.graphics({ x: 0, y: 0 });
        shadowGfx.fillStyle(0x000000, 0.25);
        shadowGfx.fillEllipse(CELL_SIZE / 2, CELL_SIZE / 2 + 4, CELL_SIZE - 16, 18);
        shadowGfx.generateTexture('item_shadow', CELL_SIZE, CELL_SIZE);
        shadowGfx.destroy();

        // Generate glow texture for selected/special items: soft radial glow 64x64
        if (!this.textures.exists('food_glow')) {
            const glowSize = 64;
            const glowGfx = this.make.graphics({ x: 0, y: 0 });
            // Radial-like soft glow: multiple concentric circles with decreasing alpha
            for (let r = glowSize / 2; r >= 2; r -= 4) {
                const alpha = 0.3 * (1 - r / (glowSize / 2));
                glowGfx.fillStyle(0xffffff, alpha);
                glowGfx.fillCircle(glowSize / 2, glowSize / 2, r);
            }
            glowGfx.generateTexture('food_glow', glowSize, glowSize);
            glowGfx.destroy();
        }

        const graphics = this.make.graphics({ x: 0, y: 0 });

        // Helper to draw kawaii face
        const drawFace = (ctx: Phaser.GameObjects.Graphics, x: number, y: number) => {
            ctx.fillStyle(0x3e2723); // Dark brown eyes
            ctx.fillCircle(x - 20, y - 10, 8);
            ctx.fillCircle(x + 20, y - 10, 8);

            // Smile
            ctx.lineStyle(3, 0x3e2723);
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 180, false);
            ctx.strokePath();

            // Blush
            ctx.fillStyle(0xff69b4, 0.5);
            ctx.fillCircle(x - 25, y, 6);
            ctx.fillCircle(x + 25, y, 6);
        };

        // 1. BORSOK (Golden/Yellow Pillow)
        if (!this.textures.exists('borsok')) {
            graphics.clear();
            graphics.fillStyle(0xFFD700); // Gold
            graphics.fillRoundedRect(10, 10, 108, 108, 20); // Squared pillow
            // Highlight
            graphics.fillStyle(0xFFFFFF, 0.3);
            graphics.fillCircle(64, 50, 20);
            drawFace(graphics, 64, 70);

            graphics.generateTexture('borsok', 128, 128);
        }

        // 2. PAKHLAVA (Golden Rhombus) - Fallback if image missing
        if (!this.textures.exists('pakhlava')) {
            graphics.clear();
            graphics.fillStyle(0xDAA520); // GoldenRod
            // Draw diamond
            graphics.beginPath();
            graphics.moveTo(64, 10);
            graphics.lineTo(118, 64);
            graphics.lineTo(64, 118);
            graphics.lineTo(10, 64);
            graphics.closePath();
            graphics.fillPath();

            // Detail
            graphics.lineStyle(3, 0xB8860B);
            graphics.strokePath();

            drawFace(graphics, 64, 64);
            graphics.generateTexture('pakhlava', 128, 128);
        }

        // 3. LEPESHKA (Round bread) - if added later
        if (!this.textures.exists('lepeshka')) {
            graphics.clear();
            graphics.fillStyle(0xF4A460); // SandyBrown
            graphics.fillCircle(64, 64, 54);
            graphics.lineStyle(4, 0x8B4513);
            graphics.strokeCircle(64, 64, 54);
            drawFace(graphics, 64, 64);
            graphics.generateTexture('lepeshka', 128, 128);
        }

        // CRITICAL: destroy temp graphics to free GPU memory
        graphics.destroy();
    }
}
