import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: import.meta.dirname,
    // esbuild не умеет emitDecoratorMetadata, а Nest DI на неё опирается — трансформируем через swc.
    plugins: [
        swc.vite({
            jsc: {
                parser: {
                    syntax: 'typescript',
                    decorators: true,
                },
                transform: {
                    decoratorMetadata: true,
                    legacyDecorator: true,
                    useDefineForClassFields: false,
                },
                target: 'es2022',
            },
        }),
    ],
    test: {
        name: '@jt4d/nest-rbac',
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
        setupFiles: ['src/test-setup.ts'],
        coverage: {
            reportsDirectory: './test-output/vitest/coverage',
            provider: 'v8',
        },
    },
});
