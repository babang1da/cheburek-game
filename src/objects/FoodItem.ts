import Phaser from 'phaser';
import { CELL_SIZE, SWAP_DURATION, DROP_DURATION, DESTROY_DURATION } from '../utils/constants';

export class FoodItem extends Phaser.GameObjects.Sprite {
    public gridRow: number;
    public gridCol: number;
    public foodType: string;
    public isMoving: boolean = false;
    public isMatched: boolean = false;

    constructor(
        scene: Phaser.Scene,
        row: number,
        col: number,
        foodType: string,
        x: number,
        y: number
    ) {
        super(scene, x, y, foodType);

        this.gridRow = row;
        this.gridCol = col;
        this.foodType = foodType;

        // Scale to fit cell while preserving aspect ratio
        const maxSize = CELL_SIZE - 10; // Leave small padding
        const scaleX = maxSize / this.width;
        const scaleY = maxSize / this.height;
        const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit
        this.setScale(scale);

        // Ensure item is above grid
        this.setDepth(1);

        // Add shadow effect (Phaser 3.60+)
        if (this.postFX) {
            // x=6, y=6 (offset to bottom-right), decay=0.1, intensity=0.1 (extremely subtle)
            this.postFX.addShadow(-2, 2, 0.1, 1, 0x000000, 10, 0.1);
        }

        // Make interactive
        this.setInteractive();

        // Start random idle animation
        this.startIdleAnimation();

        scene.add.existing(this);
    }

    private startIdleAnimation() {
        // Random start delay between 2 and 10 seconds
        this.scene.time.addEvent({
            delay: Phaser.Math.Between(2000, 10000),
            callback: () => {
                if (!this.scene) return; // Check if still alive

                // Only jump animation
                this.animateJump();

                // Schedule next animation
                this.startIdleAnimation();
            }
        });
    }

    private animateJump() {
        if (this.isMoving || !this.scene) return;

        const startY = this.y;
        const startScaleX = this.scaleX;
        const startScaleY = this.scaleY;

        this.scene.tweens.add({
            targets: this,
            y: startY - 10,
            scaleY: startScaleY * 1.05,
            scaleX: startScaleX * 0.95,
            duration: 150,
            yoyo: true,
            ease: 'Quad.Out',
            onComplete: () => {
                this.y = startY; // Ensure return to exact position
                this.setScale(startScaleX, startScaleY); // Restore exact original scale
            }
        });
    }

    animateSwap(targetX: number, targetY: number): Promise<void> {
        return new Promise((resolve) => {
            this.isMoving = true;
            this.scene.tweens.add({
                targets: this,
                x: targetX,
                y: targetY,
                duration: SWAP_DURATION,
                ease: 'Power2',
                onComplete: () => {
                    this.isMoving = false;
                    resolve();
                }
            });
        });
    }

    animateDrop(targetY: number, distance: number): Promise<void> {
        return new Promise((resolve) => {
            this.isMoving = true;
            const duration = DROP_DURATION * distance;

            this.scene.tweens.add({
                targets: this,
                y: targetY,
                duration: duration,
                ease: 'Bounce.easeOut',
                onComplete: () => {
                    this.isMoving = false;
                    resolve();
                }
            });
        });
    }

    animateDestroy(): Promise<void> {
        return new Promise((resolve) => {
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: DESTROY_DURATION,
                ease: 'Power2',
                onComplete: () => {
                    this.destroy();
                    resolve();
                }
            });
        });
    }

    animateSelect(selected: boolean): void {
        const targetScale = selected ? this.scaleX * 1.1 : this.scaleX / 1.1;

        // Bring to top when selected
        this.setDepth(selected ? 2 : 1);

        this.scene.tweens.add({
            targets: this,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 100,
            ease: 'Power2'
        });
    }
}
