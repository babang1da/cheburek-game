import { GRID_ROWS, GRID_COLS, MIN_MATCH } from './constants';

export interface GridPosition {
    row: number;
    col: number;
}

export interface MatchResult {
    positions: GridPosition[];
    foodType: string;
}

export class MatchFinder {
    static findAllMatches(grid: (string | null)[][]): MatchResult[] {
        const matches: MatchResult[] = [];
        const visited: boolean[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(false));

        // Find horizontal matches
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS - 2; col++) {
                if (visited[row][col]) continue;
                const match = this.findHorizontalMatch(grid, row, col, visited);
                if (match) matches.push(match);
            }
        }

        // Find vertical matches
        const visitedV: boolean[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(false));
        for (let col = 0; col < GRID_COLS; col++) {
            for (let row = 0; row < GRID_ROWS - 2; row++) {
                if (visitedV[row][col]) continue;
                const match = this.findVerticalMatch(grid, row, col, visitedV);
                if (match) matches.push(match);
            }
        }

        return this.mergeOverlappingMatches(matches);
    }

    private static findHorizontalMatch(
        grid: (string | null)[][],
        row: number,
        col: number,
        visited: boolean[][]
    ): MatchResult | null {
        const type = grid[row][col];
        if (!type) return null;

        const positions: GridPosition[] = [{ row, col }];

        for (let c = col + 1; c < GRID_COLS && grid[row][c] === type; c++) {
            positions.push({ row, col: c });
        }

        if (positions.length >= MIN_MATCH) {
            positions.forEach(pos => visited[pos.row][pos.col] = true);
            return { positions, foodType: type };
        }

        return null;
    }

    private static findVerticalMatch(
        grid: (string | null)[][],
        row: number,
        col: number,
        visited: boolean[][]
    ): MatchResult | null {
        const type = grid[row][col];
        if (!type) return null;

        const positions: GridPosition[] = [{ row, col }];

        for (let r = row + 1; r < GRID_ROWS && grid[r][col] === type; r++) {
            positions.push({ row: r, col });
        }

        if (positions.length >= MIN_MATCH) {
            positions.forEach(pos => visited[pos.row][pos.col] = true);
            return { positions, foodType: type };
        }

        return null;
    }

    private static mergeOverlappingMatches(matches: MatchResult[]): MatchResult[] {
        if (matches.length <= 1) return matches;

        const merged: MatchResult[] = [];
        const used: boolean[] = new Array(matches.length).fill(false);

        for (let i = 0; i < matches.length; i++) {
            if (used[i]) continue;

            let currentPositions = [...matches[i].positions];
            const currentType = matches[i].foodType;
            used[i] = true;

            for (let j = i + 1; j < matches.length; j++) {
                if (used[j] || matches[j].foodType !== currentType) continue;

                const hasOverlap = matches[j].positions.some(pos =>
                    currentPositions.some(p => p.row === pos.row && p.col === pos.col)
                );

                if (hasOverlap) {
                    matches[j].positions.forEach(pos => {
                        if (!currentPositions.some(p => p.row === pos.row && p.col === pos.col)) {
                            currentPositions.push(pos);
                        }
                    });
                    used[j] = true;
                }
            }

            merged.push({ positions: currentPositions, foodType: currentType });
        }

        return merged;
    }

    static hasValidMoves(grid: (string | null)[][]): boolean {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                if (col < GRID_COLS - 1) {
                    if (this.wouldCreateMatch(grid, row, col, row, col + 1)) return true;
                }
                if (row < GRID_ROWS - 1) {
                    if (this.wouldCreateMatch(grid, row, col, row + 1, col)) return true;
                }
            }
        }
        return false;
    }

    private static wouldCreateMatch(
        grid: (string | null)[][],
        row1: number, col1: number,
        row2: number, col2: number
    ): boolean {
        const tempGrid = grid.map(row => [...row]);
        const temp = tempGrid[row1][col1];
        tempGrid[row1][col1] = tempGrid[row2][col2];
        tempGrid[row2][col2] = temp;

        return this.hasMatchAt(tempGrid, row1, col1) || this.hasMatchAt(tempGrid, row2, col2);
    }

    private static hasMatchAt(grid: (string | null)[][], row: number, col: number): boolean {
        const type = grid[row][col];
        if (!type) return false;

        let horizontalCount = 1;
        for (let c = col - 1; c >= 0 && grid[row][c] === type; c--) horizontalCount++;
        for (let c = col + 1; c < GRID_COLS && grid[row][c] === type; c++) horizontalCount++;
        if (horizontalCount >= MIN_MATCH) return true;

        let verticalCount = 1;
        for (let r = row - 1; r >= 0 && grid[r][col] === type; r--) verticalCount++;
        for (let r = row + 1; r < GRID_ROWS && grid[r][col] === type; r++) verticalCount++;
        if (verticalCount >= MIN_MATCH) return true;

        return false;
    }
}
