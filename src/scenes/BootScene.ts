import Phaser from 'phaser';
import { FOOD_TYPES } from '../utils/constants';

export class BootScene extends Phaser.Scene {
    private floatingItems: Phaser.GameObjects.Sprite[] = [];

    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        FOOD_TYPES.forEach(type => {
            this.load.image(type, `assets/${type}.webp`);
        });
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Dark gradient background (simulated with rectangles)
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x0d1b3e, 0x0d1b3e, 1);
        bg.fillRect(0, 0, w, h);

        // Floating food items in background
        this.createFloatingItems();

        // Decorative particles
        this.createAmbientParticles();

        // Title with glow
        const title = this.add.text(w / 2, h * 0.22, 'SAMSA', {
            fontSize: '80px',
            fontFamily: 'Arial',
            color: '#ff6b35',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5).setAlpha(0).setDepth(1);

        const subtitle = this.add.text(w / 2, h * 0.32, 'SWAP', {
            fontSize: '52px',
            fontFamily: 'Arial',
            color: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0).setDepth(1);

        // Tagline
        this.add.text(w / 2, h * 0.40, 'Match-3 с восточной кухней', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#aaaaaa',
        }).setOrigin(0.5).setAlpha(0.7);

        // Best score
        const bestScore = parseInt(localStorage.getItem('samsa_swap_best_score') || '0', 10);
        if (bestScore > 0) {
            this.add.text(w / 2, h * 0.48, `🏆 Рекорд: ${bestScore}`, {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#00ff88',
                fontStyle: 'bold',
            }).setOrigin(0.5);
        }

        // Play button
        const btnBg = this.add.graphics().setDepth(1);
        const btnW = 240;
        const btnH = 70;
        const btnX = w / 2 - btnW / 2;
        const btnY = h * 0.60;

        btnBg.fillStyle(0xff6b35, 1);
        btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 20);
        btnBg.lineStyle(3, 0xffcc00, 1);
        btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 20);

        const btnText = this.add.text(w / 2, btnY + btnH / 2, '🎮 ИГРАТЬ', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1);

        // Make button interactive
        const btnZone = this.add.zone(w / 2, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });

        btnZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0xff8855, 1);
            btnBg.fillRoundedRect(btnX - 4, btnY - 4, btnW + 8, btnH + 8, 22);
            btnBg.lineStyle(3, 0xffcc00, 1);
            btnBg.strokeRoundedRect(btnX - 4, btnY - 4, btnW + 8, btnH + 8, 22);
            btnText.setScale(1.05);
        });

        btnZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0xff6b35, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 20);
            btnBg.lineStyle(3, 0xffcc00, 1);
            btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 20);
            btnText.setScale(1);
        });

        btnZone.on('pointerdown', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('WorldMapScene');
            });
        });

        // Animations
        // Title slide-in
        this.tweens.add({
            targets: title,
            alpha: 1,
            y: h * 0.22,
            duration: 800,
            ease: 'Back.easeOut',
            delay: 200,
        });

        this.tweens.add({
            targets: subtitle,
            alpha: 1,
            y: h * 0.32,
            duration: 800,
            ease: 'Back.easeOut',
            delay: 400,
        });

        // Button pulse
        this.tweens.add({
            targets: [btnBg, btnText],
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 1200,
        });

        // Footer
        this.add.text(w / 2, h * 0.92, '🍽️ Собери восточные блюда!', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#666666',
        }).setOrigin(0.5);
    }

    private createFloatingItems() {
        const w = this.scale.width;
        const h = this.scale.height;

        for (let i = 0; i < 8; i++) {
            const type = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
            const x = Phaser.Math.Between(50, w - 50);
            const y = Phaser.Math.Between(100, h - 100);
            const item = this.add.sprite(x, y, type);
            const scale = Phaser.Math.FloatBetween(0.3, 0.5);
            item.setScale(scale);
            item.setAlpha(0.15 + Math.random() * 0.1);
            item.setDepth(0);

            // Gentle floating
            this.tweens.add({
                targets: item,
                y: y + Phaser.Math.Between(-30, 30),
                x: x + Phaser.Math.Between(-20, 20),
                angle: Phaser.Math.Between(-15, 15),
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Math.random() * 2000,
            });

            this.floatingItems.push(item);
        }
    }

    private createAmbientParticles() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Small golden dots floating up
        const particles = this.add.graphics();
        const dots: { x: number; y: number; speed: number; alpha: number; size: number }[] = [];

        for (let i = 0; i < 30; i++) {
            dots.push({
                x: Math.random() * w,
                y: Math.random() * h,
                speed: 0.3 + Math.random() * 0.7,
                alpha: 0.2 + Math.random() * 0.4,
                size: 1 + Math.random() * 3,
            });
        }

        this.time.addEvent({
            delay: 33, // ~30fps
            loop: true,
            callback: () => {
                particles.clear();
                dots.forEach(dot => {
                    dot.y -= dot.speed;
                    if (dot.y < -10) {
                        dot.y = h + 10;
                        dot.x = Math.random() * w;
                    }
                    particles.fillStyle(0xffcc00, dot.alpha);
                    particles.fillCircle(dot.x, dot.y, dot.size);
                });
            },
        });
    }
}
