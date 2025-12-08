// Game Constants
// Game Constants
export const GRID_COLS = 6;
export const GRID_ROWS = 9;
export const CELL_SIZE = 108;
// Offsets now point to the CENTER of the first cell (0,0)
// Screen 720. Grid 6*108=648. Margin (720-648)/2 = 36. Offset = 36 + 54 = 90.
export const GRID_OFFSET_X = 90;
// Screen 1080. Grid 9*108=972. Space left 108. Top Margin (UI) ~80. Offset = 80 + 54 = 134.
export const GRID_OFFSET_Y = 134;

export const FOOD_TYPES = ['manti', 'belyash', 'cheburek', 'samsa', 'pakhlava', 'borsok'];
export const FOOD_COUNT = FOOD_TYPES.length;

export const MIN_MATCH = 3;
export const SWAP_DURATION = 150;
export const DROP_DURATION = 100;
export const DESTROY_DURATION = 150;

export const INITIAL_MOVES = 30;
export const TARGET_SCORE = 1000;
export const POINTS_PER_GEM = 10;
