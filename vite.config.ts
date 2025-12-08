import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
    const isProd = command === 'build';
    return {
        base: isProd ? '/cheburek-game/' : '/',
    };
});
