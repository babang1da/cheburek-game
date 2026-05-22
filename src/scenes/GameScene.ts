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
    private gameOverPanel!: Phaser.GameObjects.Container;

    private soundBtn!: Phaser.GameObjects.Text;
    private hintTimer: Phaser.Time.TimerEvent | null = null;
    private hintItems: FoodItem[] = [];
    private fpsText!: Phaser.GameObjects.Text;

    private levelManager: LevelManager = new LevelManager();
    private progressBar!: Phaser.GameObjects.Graphics;
    private targetScore: number = 0;
    private lastProgressPct: number = -1;

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

        // Background image via Phaser (not CSS — avoids alpha compositing overhead)
        const bg = this.add.image(360, 540, 'background');
        bg.setDisplaySize(720, 1080);
        bg.setDepth(-1);

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

        this.fillBoard();

        // Check for deadlock
        await this.checkAndReshuffle();

        // Update UI
        this.updateUI();

        // Start single idle animation timer instead of 54 per-item timers
        this.startIdleTimer();
    }

    update() {
        if (this.fpsText) {
            this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
        }
    }

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

        // Title with level
        this.add.text(360, 45, 'SAMSA SWAP', {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#ff6b35',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Level
        this.add.text(360, 80, `Уровень ${config.level}: ${config.name}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // Progress bar background
        this.progressBar = this.add.graphics();
        this.drawProgressBar();

        // Score
        this.scoreText = this.add.text(50, 100, 'Счёт: 0', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });

        // Moves
        this.movesText = this.add.text(50, 140, `Ходы: ${INITIAL_MOVES}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });

        // Target
        this.add.text(500, 100, `Цель: ${config.targetScore}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        });

        // Best score
        this.add.text(400, 140, `Рекорд: ${this.bestScore}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#00ff88'
        });

        // Combo text (hidden initially)
        this.comboText = this.add.text(360, 950, '', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ff00ff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Sound toggle button
        this.soundBtn = this.add.text(670, 100, '🔊', {
            fontSize: '32px',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.soundBtn.on('pointerdown', () => {
            soundManager.setEnabled(!soundManager.isEnabled());
            this.soundBtn.setText(soundManager.isEnabled() ? '🔊' : '🔇');
        });

        // FPS counter (top-right corner)
        this.fpsText = this.add.text(710, 15, '', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#00ff88',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        }).setOrigin(1, 0).setDepth(200).setAlpha(0.7);

        // Game over panel (hidden initially)
        this.createGameOverPanel();
    }

    private createGameOverPanel() {
        this.gameOverPanel = this.add.container(360, 540);
        this.gameOverPanel.setDepth(100); // Ensure it's above everything

        const bg = this.add.rectangle(0, 0, 600, 400, 0x000000, 0.9).setStrokeStyle(4, 0xffcc00);
        const title = this.add.text(0, -100, 'ИГРА ОКОНЧЕНА', {
            fontSize: '42px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const scoreText = this.add.text(0, 0, '', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(0.5);

        const restartBtn = this.add.text(0, 100, 'ЗАНОВО', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#00ff88',
            fontStyle: 'bold',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        restartBtn.on('pointerdown', () => {
            this.scene.restart();
        });

        restartBtn.on('pointerover', () => {
            restartBtn.setScale(1.1);
        });

        restartBtn.on('pointerout', () => {
            restartBtn.setScale(1);
        });

        this.gameOverPanel.add([bg, title, scoreText, restartBtn]);
        this.gameOverPanel.setVisible(false);
        this.gameOverPanel.setData('scoreText', scoreText);
        this.gameOverPanel.setData('titleText', title);
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

        // Swipe/drag handler only (no click)
        item.on('dragstart', (_pointer: Phaser.Input.Pointer) => {
            if (!this.isProcessing && !item.isMoving) {
                this.selectedItem = item;
                item.isMoving = true; // Prevent idle animation during drag
                item.setDepth(10); // Bring to front while dragging
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
                    this.trySwap(item, targetItem);
                    this.selectedItem = null;
                    return;
                }
            }

            // Reset position if no valid swap
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

        await Promise.all([
            item1.animateSwap(x1, y1),
            item2.animateSwap(x2, y2)
        ]);

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
                item.setSpecialGlow(spawn.type);
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
        this.scoreText.setText(`Счёт: ${this.score}`);
        this.movesText.setText(`Ходы: ${this.movesRemaining}`);
        this.drawProgressBar();
    }

    private drawProgressBar() {
        const progress = Math.min(this.score / this.targetScore, 1);
        const progressPct = Math.floor(progress * 100);

        // Skip redraw if progress hasn't changed significantly (perf)
        if (progressPct === this.lastProgressPct) return;
        this.lastProgressPct = progressPct;

        const barX = 70;
        const barY = 170;
        const barW = 580;
        const barH = 12;

        this.progressBar.clear();
        // Background
        this.progressBar.fillStyle(0x333333, 0.8);
        this.progressBar.fillRoundedRect(barX, barY, barW, barH, 6);
        // Progress
        if (progress > 0) {
            const color = progress >= 1 ? 0x00ff88 : 0xff6b35;
            this.progressBar.fillStyle(color, 1);
            this.progressBar.fillRoundedRect(barX, barY, barW * progress, barH, 6);
        }
        // Border
        this.progressBar.lineStyle(2, 0xffffff, 0.3);
        this.progressBar.strokeRoundedRect(barX, barY, barW, barH, 6);
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
        const text = this.add.text(x, y - 20, `+${points}`, {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: text,
            y: y - 70,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    private emitParticles(x: number, y: number, foodType: string) {
        // Throttle: skip if too many particles active
        if (this.tweens.getTweens().length > 80) return;

        const colors: Record<string, number> = {
            manti: 0xffffff,
            belyash: 0xffcc00,
            cheburek: 0xff8844,
            samsa: 0xffaa33,
            pakhlava: 0xdaa520,
            borsok: 0xffd700,
        };
        const color = colors[foodType] || 0xffffff;

        for (let i = 0; i < 4; i++) {
            const particle = this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.8)
                .setDepth(49);

            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 50;

            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0,
                duration: 400,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
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
                item.clearTint();
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
            item1.setTint(0xffff88);
            this.hintItems.push(item1);
        }
        if (item2) {
            item2.setTint(0xffff88);
            this.hintItems.push(item2);
        }
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
        this.levelManager.nextLevel();
        if (this.levelManager.isLastLevel()) {
            this.showGameOver('ВСЕ УРОВНИ ПРОЙДЕНЫ! 🏆', true);
        } else {
            const nextConfig = this.levelManager.getConfig();
            this.showGameOver(`УРОВЕНЬ ${nextConfig.level - 1} ПРОЙДЕН!`, true);
        }
    }

    private gameLose() {
        soundManager.playLose();
        this.saveBestScore();
        this.showGameOver('ИГРА ОКОНЧЕНА', false);
    }

    private showGameOver(title: string, isWin: boolean) {
        const titleText = this.gameOverPanel.getData('titleText') as Phaser.GameObjects.Text;
        const scoreText = this.gameOverPanel.getData('scoreText') as Phaser.GameObjects.Text;

        titleText.setText(title);
        titleText.setColor(isWin ? '#00ff88' : '#ff6b35');
        scoreText.setText(`Финальный счёт: ${this.score}`);

        this.gameOverPanel.setVisible(true);
    }

    private saveBestScore() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('samsa_swap_best_score', this.bestScore.toString());
        }
    }
    private generateTextures() {
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
