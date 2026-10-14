import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        plugins: {
            'import-x': importPlugin,
            'unused-imports': unusedImports,
        },
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    enforceBuildableLibDependency: true,
                    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
                    depConstraints: [
                        {
                            sourceTag: 'type:app',
                            onlyDependOnLibsWithTags: ['type:lib'],
                        },
                        {
                            sourceTag: 'type:lib',
                            onlyDependOnLibsWithTags: ['type:lib'],
                        },
                    ],
                },
            ],
            '@typescript-eslint/no-empty-function': 'warn',
            '@typescript-eslint/no-inferrable-types': 'warn',
            'no-restricted-globals': 'warn',

            'import-x/order': [
                'error',
                {
                    pathGroups: [
                        {
                            pattern: '@jt4d/**',
                            group: 'internal',
                        },
                    ],
                    'newlines-between': 'always',
                    groups: ['builtin', 'external', 'internal', 'parent', ['sibling', 'index']],
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],
            'sort-imports': [
                'error',
                {
                    ignoreCase: true,
                    ignoreDeclarationSort: true,
                    ignoreMemberSort: false,
                    memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
                    allowSeparatedGroups: false,
                },
            ],
            'unused-imports/no-unused-imports': 'error',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'import-x/no-duplicates': 'error',
            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    'ts-ignore': 'allow-with-description',
                    'ts-nocheck': 'allow-with-description',
                    'ts-check': false,
                    'ts-expect-error': false,
                },
            ],
        },
    },
];
