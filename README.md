# @jt4d/nest-toolkit

Монорепозиторий переиспользуемых модулей NestJS. Публикуемые пакеты живут в `packages/*`,
демонстрационное приложение — в `apps/playground`.

## Требования

- Node 24 (см. `.nvmrc`)
- Yarn 1.22 (`packageManager` в корневом `package.json`)

```bash
yarn install
```

## Команды

| Команда                       | Что делает                                                |
| ----------------------------- | --------------------------------------------------------- |
| `yarn build`                  | `nx run-many -t build` — сборка всех проектов             |
| `yarn test`                   | `nx run-many -t test` — Vitest во всех проектах           |
| `yarn lint`                   | Автофикс: eslint --fix, prettier --write, затем typecheck |
| `yarn lint:check`             | Проверка без правок: typecheck, eslint, prettier --check  |
| `yarn start`                  | Запуск `apps/playground` в watch-режиме                   |
| `yarn clean` / `yarn rebuild` | Очистка `dist`/`out-tsc` и пересборка                     |
| `yarn release`                | `nx release` для `packages/*` (без публикации)            |

Полезно поштучно: `yarn nx build common`, `yarn nx test playground`, `yarn nx graph`.

## Как добавить новый пакет

1. Создать `packages/<name>/` по образцу `packages/common`: `package.json`, `tsconfig.json`,
   `tsconfig.lib.json`, `tsconfig.spec.json`, `project.json`, `eslint.config.mjs`,
   `vitest.config.ts`, `src/index.ts`, `src/test-setup.ts`.
2. В `package.json` поле `exports` должно оставаться **плоским**:

    ```json
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "@jt4d/source": "./src/index.ts",
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        }
    }
    ```

    Условие `@jt4d/source` даёт внутри репозитория резолв в исходники, `types`/`default` — в `dist`
    для внешних потребителей. Вложенная форма `exports` ломает автоопределение таргета `build`
    плагином `@nx/js/typescript` — таргет просто исчезнет.

3. `yarn install` (создаёт симлинк в `node_modules/@jt4d/<name>`), затем `yarn nx sync` (расставит
   `references` в `tsconfig.json`).
4. Проверить: `yarn nx show project <name> --json` — в списке таргетов должны быть `build`,
   `typecheck`, `test`.

## Соглашения, о которых легко забыть

- `build`, `typecheck` и `test` **не объявляются** в `project.json` — их выводят плагины Nx. Явное
  объявление конфликтует с выведенным таргетом и уничтожает его `cache`/`inputs`/`syncGenerators`. В
  `project.json` руками описаны только `lint`, `lint-check`, `format`, `format-check`, `clean` (и
  `build`/`serve` для `apps/playground`, у которого нет `tsconfig.lib.json`).
- `emitDeclarationOnly: false` переопределяется **только** в `tsconfig.lib.json` пакета (и
  `tsconfig.app.json` приложения). В `tsconfig.base.json` его не трогать.
- `noEmit: true` нельзя класть в tsconfig-файлы — это отключает выведенный таргет `typecheck`.
- Из-за `isolatedModules` + `emitDecoratorMetadata` типы в декорированных сигнатурах (например,
  параметры конструктора с `@Inject`) нужно импортировать через `import type`.
- Тесты используют `unplugin-swc`: esbuild не умеет `emitDecoratorMetadata`, без которой не работает
  DI NestJS.
