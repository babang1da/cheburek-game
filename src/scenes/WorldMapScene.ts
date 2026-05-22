import Phaser from 'phaser';
import { LevelManager } from '../utils/LevelManager';
import { LEVELS } from '../utils/LevelManager';

export class WorldMapScene extends Phaser.Scene {
    private levelManager: LevelManager;

    constructor() {
        super('WorldMapScene');
        this.levelManager = new LevelManager();
    }

    preload() {
        // No external assets needed — using graphics
    }

    create() {
        // Background gradient
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x4a2a5e, 0x4a2a5e, 1);
        bg.fillRect(0, 0, 720, 1080);

        // Title
        this.add.text(360, 80, 'КАРТА МИРА', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#ff6b35',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(360, 140, 'SAMSA SWAP', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(0.5);

        // Create level nodes
        this.createLevelNodes();

        // Back button
        const backBtn = this.add.text(360, 1000, 'ВЕРНУТЬСЯ', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.scene.start('BootScene');
        });

        backBtn.on('pointerover', () => backBtn.setScale(1.1));
        backBtn.on('pointerout', () => backBtn.setScale(1));
    }

    private createLevelNodes() {
        const totalLevels = this.levelManager.getTotalLevels();
        const startY = 250;
        const nodeSpacing = 100;

        for (let i = 1; i <= totalLevels; i++) {
            const x = 360 + Math.sin(i * 0.8) * 200;
            const y = startY + (i - 1) * nodeSpacing;

            const isUnlocked = i <= this.levelManager.getMaxUnlockedLevel();
            const stars = this.levelManager.getStars(i);
            const config = LEVELS[i - 1]; // Get correct config for this level

            // Node circle
            const color = isUnlocked ? 0xff6b35 : 0x666666;
            const circle = this.add.circle(x, y, 35, color, 1)
                .setStrokeStyle(4, 0xffcc00);

            // Level number
            const levelText = this.add.text(x, y, i.toString(), {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Stars
            this.add.text(x, y + 50, this.getStarString(stars), {
                fontSize: '20px'
            }).setOrigin(0.5);

            // Level name
            this.add.text(x, y + 75, config.name, {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: isUnlocked ? '#ffffff' : '#666666'
            }).setOrigin(0.5);

            if (isUnlocked) {
                circle.setInteractive({ useHandCursor: true });
                levelText.setInteractive({ useHandCursor: true });

                circle.on('pointerdown', () => this.startLevel(i));
                levelText.on('pointerdown', () => this.startLevel(i));

                circle.on('pointerover', () => circle.setScale(1.2));
                circle.on('pointerout', () => circle.setScale(1));
            }

            // Draw path line from previous node
            if (i > 1) {
                const prevX = 360 + Math.sin((i - 1) * 0.8) * 200;
                const prevY = startY + (i - 2) * nodeSpacing;
                const path = this.add.graphics();
                path.lineStyle(6, 0x666666, 0.8);
                path.lineBetween(prevX, prevY, x, y);
            }
        }
    }

    private startLevel(level: number) {
        this.registry.set('selectedLevel', level);
        this.scene.start('GameScene');
    }

    private getStarString(stars: number): string {
        return '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    }
}
