import Phaser from 'phaser';
import { LevelManager } from '../utils/LevelManager';
import { LEVELS } from '../utils/LevelManager';

interface LevelNode {
    circle: Phaser.GameObjects.Arc;
    levelText: Phaser.GameObjects.Text;
    starText: Phaser.GameObjects.Text;
    nameText: Phaser.GameObjects.Text;
    config: typeof LEVELS[0];
    level: number;
    isUnlocked: boolean;
}

export class WorldMapScene extends Phaser.Scene {
    private levelManager: LevelManager;
    private levelNodes: LevelNode[] = [];
    private selectedNode: LevelNode | null = null;

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
        this.add.text(360, 60, 'КАРТА МИРА', {
            fontSize: '42px',
            fontFamily: 'Arial',
            color: '#ff6b35',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(360, 110, 'SAMSA SWAP', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(0.5);

        // Create level nodes
        this.createLevelNodes();

        // Animate current level node
        this.animateCurrentLevel();

        // Back button
        const backBtn = this.add.text(360, 1020, 'ВЕРНУТЬСЯ', {
            fontSize: '24px',
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
        const startY = 220;
        const nodeSpacing = 75;

        // First pass: calculate all node positions
        const nodePositions: { x: number; y: number }[] = [];
        for (let i = 1; i <= totalLevels; i++) {
            const x = 360 + Math.sin(i * 0.8) * 200;
            const y = startY + (i - 1) * nodeSpacing;
            nodePositions.push({ x, y });
        }

        // Draw all path lines BEFORE circles (so lines go behind)
        for (let i = 1; i < totalLevels; i++) {
            const prev = nodePositions[i - 1];
            const curr = nodePositions[i];
            const path = this.add.graphics();
            path.lineStyle(6, 0x666666, 0.8);
            path.lineBetween(prev.x, prev.y, curr.x, curr.y);
        }

        // Second pass: create all level nodes (circles drawn AFTER lines)
        for (let i = 1; i <= totalLevels; i++) {
            const { x, y } = nodePositions[i - 1];

            const isUnlocked = i <= this.levelManager.getMaxUnlockedLevel();
            const stars = this.levelManager.getStars(i);
            const config = LEVELS[i - 1];

            // Node circle
            const color = isUnlocked ? 0xff6b35 : 0x666666;
            const circle = this.add.circle(x, y, 30, color, 1)
                .setStrokeStyle(4, 0xffcc00);

            // Level number
            const levelText = this.add.text(x, y, i.toString(), {
                fontSize: '22px',
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Stars
            const starText = this.add.text(x, y + 42, this.getStarString(stars), {
                fontSize: '16px'
            }).setOrigin(0.5);

            // Level name
            const nameText = this.add.text(x, y + 65, config.name, {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: isUnlocked ? '#ffffff' : '#666666'
            }).setOrigin(0.5);

            const node: LevelNode = {
                circle,
                levelText,
                starText,
                nameText,
                config,
                level: i,
                isUnlocked
            };

            this.levelNodes.push(node);

            if (isUnlocked) {
                circle.setInteractive({ useHandCursor: true });
                levelText.setInteractive({ useHandCursor: true });

                const clickHandler = () => this.selectLevel(node);
                circle.on('pointerdown', clickHandler);
                levelText.on('pointerdown', clickHandler);

                circle.on('pointerover', () => {
                    if (node !== this.selectedNode) {
                        circle.setScale(1.2);
                    }
                });
                circle.on('pointerout', () => {
                    if (node !== this.selectedNode) {
                        circle.setScale(1);
                    }
                });
            }
        }
    }

    private selectLevel(node: LevelNode) {
        // Deselect previous
        if (this.selectedNode) {
            this.tweens.killTweensOf(this.selectedNode.circle);
            this.selectedNode.circle.setScale(1);
        }

        this.selectedNode = node;

        // Highlight selected
        node.circle.setScale(1.3);

        // Show level info and play button
        this.showLevelPreview(node);
    }

    private showLevelPreview(node: LevelNode) {
        // Brief preview - just start the level for now
        this.registry.set('selectedLevel', node.level);
        this.scene.start('GameScene');
    }

    private animateCurrentLevel() {
        const currentLevel = this.levelManager.getLevel();
        const currentNode = this.levelNodes[currentLevel - 1];

        if (currentNode && currentNode.isUnlocked) {
            // Pulsing animation for current level
            this.tweens.add({
                targets: currentNode.circle,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    private getStarString(stars: number): string {
        return '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    }
}