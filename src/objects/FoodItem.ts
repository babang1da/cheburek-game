import Phaser from 'phaser';
import { CELL_SIZE, SWAP_DURATION, DROP_DURATION, DESTROY_DURATION } from '../utils/constants';

export class FoodItem extends Phaser.GameObjects.Sprite {
    public gridRow: number;
    public gridCol: number;
    public foodType: string;
    public isMoving: boolean = false;
    public isMatched: boolean = false;
    public isTweening: boolean = false;
    public specialType: 'none' | 'bomb' | 'rainbow' | 'row_clear' | 'col_clear' = 'none';
    public shadow: Phaser.GameObjects.Sprite | null = null;

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

        // No postFX effects — too expensive (54 extra render passes/frame)

        // Make interactive (default hitArea uses texture frame = rectangle, already optimized)
        this.setInteractive();

        scene.add.existing(this);
    }

    // Idle animation is now driven by a single scene-level timer in GameScene
    // (see GameScene.startIdleTimer). This method is called externally.
    animateIdleJump() {
        if (this.isMoving || this.isTweening) return;
        this.isTweening = true;

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
                this.y = startY;
                this.setScale(startScaleX, startScaleY);
                this.isTweening = false;
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

        // Kill any existing scale tweens to prevent tween pile-up
        // CRITICAL: also reset isTweening since idle tween's onComplete won't fire
        this.isTweening = false;
        this.scene.tweens.killTweensOf(this);

        this.scene.tweens.add({
            targets: this,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 100,
            ease: 'Power2'
        });
    }
}
