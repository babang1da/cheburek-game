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

        // Make interactive
        this.setInteractive();

        scene.add.existing(this);
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

        this.scene.tweens.add({
            targets: this,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 100,
            ease: 'Power2'
        });
    }
}
