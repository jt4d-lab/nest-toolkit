# RBAC: настраиваемое логирование через события

## Overview

Пакет `@jt4d/nest-rbac` начинает логировать **RBAC-события** вместо сырых строк в Nest Logger.
Контракт = 7 событий (camelCase), принимаемых сервисом, реализующим `RBACLogger`. Проект передаёт
свой сервис в `RbacModule.forRoot({ logger })` (или через публичный токен `RBAC_LOGGER`); по
умолчанию используется публичный `DefaultRBACLogger`, который раскидывает события в стандартный
логгер Nest с настраиваемыми уровнями, prefix и отключением отдельных событий
(`levels: { accessGranted: false }`).

Выгода:

- проектная система логирования (pino, winston, свой формат, фильтрация) подключается одним
  сервисом, без наследования внутреннего класса `Logger`;
- payload событий структурный (scope-объект, массивы прав), а не склеенные строки;
- текущий визуальный вывод дефолтного логгера сохраняется 1:1.

## Context (from discovery)

- Монорепо Nx, пакет `packages/rbac` (`@jt4d/nest-rbac`, v0.0.0, NestJS 11, vitest через
  `@nx/vitest` — тестовый таргет генерируется автоматически).
- Текущее логирование:
    - `src/logger.ts` — `Logger extends NestLogger` (публичный экспорт), `setContext`;
    - `src/rbac.service.ts` — `RbacServiceCore` хардкодит `new Logger('RBAC')`, `RbacService`
      иньектит `@Optional() logger: Logger` (токен = сам класс), fallback `new Logger('RBAC')`;
    - `src/agent/list-agent-logs.ts`, `src/agent/entity-agent-logs.ts` — `logger.debug/warn(...)` с
      деталями
      `{matrix, scope (строка), user, grantedPermissions (строка), requiredPermissions, mode, reason?}`;
      константы сообщений `ACCESS_GRANTED/ACCESS_DENIED/SCOPE_NOT_FOUND/ ENTITY_NOT_FOUND` в
      `src/agent/types.ts`; `serializeScope` в `list-agent-logs.ts`;
    - `src/test-utils/logger.ts` — `TestingLogger` + `MockLogger extends Logger` +
      `LocalLoggerModule.forTesting()` (используются 5 спеками пакета).
- Точки логов инвентаризированы полностью: 4 события горячего пути + 3 холодного («Initializing
  matrices…» выкинут из контракта).
- Тесты: `nx test rbac`; линт `nx lint-check rbac`; typecheck `nx typecheck rbac`; CI — `yarn test`.
- `test-utils` не входит в `exports` package.json — можно перерабатывать без ограничений.
- Прецедент публичных токенов: в `src/rbac.providers.ts` константа `rbacBaseResolverToken` (значение
  `RBAC_BASE_RESOLVER`) и `rbacFeatureMatrices` (значение `RBAC_FEATURE_MATRICES`), экспортируются
  из `index.ts`. Новый токен `RBAC_LOGGER` следует тому же стилю значений.
- Скоупы DI Nest (эмпирически проверено на Nest 11.2.7 из репо): провайдеры `RbacModule` (скоуп
  forRoot/forFeature) **не видны** провайдерам импортированного `RbacModuleCore`
  (`RbacServiceCore`); провайдеры модуля приложения **не видны** из `RbacModule` (видимость течёт
  imported→importer); единственный путь, чтобы логгер приложения дошёл до `RbacService`, —
  **global**-модуль (поэтому текущий `LocalLoggerModule` — `global: true`).
- Базовая линия: `nx test rbac` — 110 passed | 3 skipped.

## Development Approach

- **testing approach**: Regular (код + тесты в одном таке, тесты — обязательная часть каждого task).
- Каждый task закрывается только при зелёном `nx test rbac`.
- Миграция контракта (task 3) — атомарная: переключение ядра, удаление старого логгера и миграция
  всех 5 спеков в одном таке, чтобы тест-сьют не оставался красным между задачами.
- Backward compatibility: пакет 0.0.0 — breaking допустимы (удаление экспорта `Logger`, смена
  сигнатуры конструктора публичного `RBACAgentManager`).

## Testing Strategy

- **Unit**: `DefaultRBACLogger` (fake-синк), `TestingRBACLogger` (рекордер + матчер) — в задачах
  1–2.
- **Модульные**: существующие спеки агентов и модуля — миграция на событийные ассерты (task 3);
  новый `logging.spec.ts` для обвязки fallback/forRoot/токен (task 4).
- **E2E**: в проекте нет UI-e2e; интеграционные спеки на supertest (`__tests__/module/`) и есть —
  покрываются в task 3.

## Progress Tracking

- `[x]` — сразу после завершения пункта.
- ➕ — новые найденные задачи; ⚠️ — блокеры/проблемы.
- При изменении scope — обновлять файл плана.

## Solution Overview

1. **Контракт**: `RBACEvent` — 7 событий (payload без `type`; дискриминатор = имя метода):
   `accessGranted`, `accessDenied`, `scopeNotFound`, `entityNotFound`, `matrixInitialized`,
   `matrixInstantiateFailed`, `matrixInitFailed`.
2. **`RBACLogger`** — интерфейс, метод на каждое событие.
3. **`DefaultRBACLogger`** — публичная дефолтная реализация:
   `constructor(options: RBACLoggerOptions, sink: RBACLogSink = new NestLogger('RBAC'))`. Опции:
   `prefix?`, `levels?: Partial<Record<RBACEventType, RBACLogLevel | false>>` (`false` = событие не
   логировать). Context живёт в синке (`new NestLogger('RBAC')`). Дефолтные уровни: granted → debug,
   denied/notFound → warn, initialized → info, failed → error. Сообщения — как сейчас
   (`Access granted`, `Matrix "${matrix}" initialized` и т.д.). Details: scope-объект → строка
   (`orgId: 5, dept: 3`), массивы прав → `', '`-строки — визуальный вывод не меняется.
4. **Обвязка**: публичный токен `RBAC_LOGGER = 'RBAC_LOGGER'` (в `rbac.providers.ts`).
   `forRoot({ baseResolver, logger?: RBACLogger })` — строго сервис; при наличии регистрирует
   `{ provide: RBAC_LOGGER, useValue: logger }` в скоупе `RbacModule`. `RbacService` (тот же скоуп,
   что и провайдеры forRoot) иньектит `@Optional() @Inject(RBAC_LOGGER)` с fallback
   `new DefaultRBACLogger()` и в конструкторе **прокидывает логгер в ядро**:
   `this.core.logger = this.logger` (публичное свойство `RbacServiceCore`, паттерн как у
   `baseResolver`). `RbacServiceCore` сама не иньектит: холодный путь идёт через
   `this.logger ?? new DefaultRBACLogger()`. Приоритет: опция forRoot > провайдер `RBAC_LOGGER` из
   **global**-модуля > дефолт (провайдеры не-global модулей приложения до `RbacModule` не доходят —
   см. Context). `RbacModule.init` — без изменений: `core.logger` установлен конструктором
   `RbacService` на инициализации модулей, до вызова `init()`.
5. **Тест-утилиты**: `TestingRBACLogger implements RBACLogger` (рекордер событий + матчер:
   `logger.accessGranted().withDetails({...}).toBeLoggedTimes(n)`, `strict()`, `any()`, `clear()`) и
   `RBACTestingLoggerModule.forTesting()` — `global: true`-модуль, регистрирующий
   `{ provide: RBAC_LOGGER, useExisting: TestingRBACLogger }` (зеркало старого `LocalLoggerModule`;
   global-модуль — единственный путь, которым логгер доходит до `RbacService` из корня тестов).
   `MockLogger`/`LocalLoggerModule`/старый `TestingLogger` удаляются.

## Technical Details

### События (`src/logging/events.ts`)

```ts
export type RBACLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type RBACEventType =
    | 'accessGranted'
    | 'accessDenied'
    | 'scopeNotFound'
    | 'entityNotFound'
    | 'matrixInitialized'
    | 'matrixInstantiateFailed'
    | 'matrixInitFailed';

// Базовое для событий доступа
// interface AccessEventBase {
//   matrix: string;
//   user: string | number;              // baseScope.profileId || 0
//   grantedPermissions: string[];
//   requiredPermissions: string[];
//   mode: 'some' | 'every';
// }
//
// AccessGrantedEvent / AccessDeniedEvent:
//   + scope?: Partial<ScopeType>;       // только у list-матриц (объект, не строка)
//   + entity?: string | number;         // только у матриц сущностей
//
// ScopeNotFoundEvent { matrix, user, scope? }
// EntityNotFoundEvent { matrix, user, entity? }
// MatrixInitializedEvent { matrix }
// MatrixInstantiateFailedEvent { matrix, type, error: unknown }
// MatrixInitFailedEvent { matrix, type, error: unknown }
//
// `type` — имя класса резолвера (в текущих сообщениях: "(ArticleMatrixResolver)").

export type RBACEvent =
    | AccessGrantedEvent
    | AccessDeniedEvent
    | ScopeNotFoundEvent
    | EntityNotFoundEvent
    | MatrixInitializedEvent
    | MatrixInstantiateFailedEvent
    | MatrixInitFailedEvent;
```

Нормализация в ядре: `permissions: string | string[]` → `string[]`;
`user = baseScope.profileId || 0`; `entity` — id (через существующий `getEntityId`). Ядро **всегда**
ставит ключ `scope` в list-событиях и ключ `entity` в entity-событиях (значение может быть
`undefined`) — это позволяет дефолтному логгеру воспроизвести текущий вывод, где ключи всегда
присутствуют. Поле `reason` в контракт **не входит** (продюсеров нет).

### `DefaultRBACLogger` (`src/logging/logger.ts`)

```ts
export interface RBACLogSink {
    debug(message: string, details?: object): void;
    info(message: string, details?: object): void;
    warn(message: string, details?: object): void;
    error(message: string, details?: object): void;
}

export interface RBACLoggerOptions {
    prefix?: string;
    levels?: Partial<Record<RBACEventType, RBACLogLevel | false>>;
}

export class DefaultRBACLogger implements RBACLogger {
    constructor(options: RBACLoggerOptions = {}, sink: RBACLogSink = new NestLogger('RBAC'));
    // 7 публичных методов → единый private emit(type, event)
    // emit: levels[type] === false → return;
    //       details = {...event} с нормализацией:
    //       scope → serializeScope(scope) (undefined → 'null');
    //       grantedPermissions → join(', ') || '(none)';
    //       requiredPermissions → join(', ');
    //       sink[level](prefix ? `${prefix} ${message}` : message, details);
}
```

`DEFAULT_LOG_LEVELS` и тексты сообщений — таблица из Solution Overview (1:1 текущие логи).
`serializeScope` переносится из `list-agent-logs.ts` в этот файл (семантика сохранена:
`null`/`undefined`-значения пропускаются, отсутствующий scope → `'null'`).

### Обвязка

- `rbac.providers.ts`: `export const RBAC_LOGGER = 'RBAC_LOGGER';`
- `rbac.module.ts`: `RbacRootModuleOptions { baseResolver, logger?: RBACLogger }`; `forRoot` при
  наличии `logger` добавляет `{ provide: RBAC_LOGGER, useValue: logger }`. `forFeature`/`forTesting`
  — без изменений по логгеру. `RbacModule.init` — без изменений (`core.logger` уже установлен на
  инициализации модулей, до вызова `init()`).
- `RbacServiceCore`: инъекций **нет**. Публичное свойство `logger?: RBACLogger` (ставит
  `RbacService`), холодный путь — через `this.logger ?? new DefaultRBACLogger()`;
  `initMatrices`/`instantiateMatrix`/`initMatrix` шлют
  `matrixInitialized`/`matrixInstantiateFailed`/`matrixInitFailed`; строка «Initializing matrices…»
  удаляется.
- `RbacService`: конструктор `(@Optional() @Inject(RBAC_LOGGER) logger?)`;
  `this.logger = logger ?? new DefaultRBACLogger()`; в конструкторе `this.core.logger = this.logger`
  (аналог `baseResolver`); **убрать** вызов `this.logger.setContext('RBAC')` (контекст теперь в
  синке). Передаёт логгер `RBACAgentManager`.
- `RBACAgentManager`: конструктор `(..., logger: RBACLogger)`; прокидывает в
  `EntityAgentLogs`/`ListAgentLogs`.
- Приоритет: опция forRoot > `RBAC_LOGGER` из global-модуля > дефолт. Инъекция `RBAC_LOGGER` —
  только в `RbacService`: `RbacServiceCore` не видит провайдеров скоупа `RbacModule` (детский
  скоуп), поэтому логгер в ядро передаётся прокидкой от `RbacService`.
- `ListAgentLogs`/`EntityAgentLogs`: конструктор `RBACLogger`; методы
  `accessGranted/accessDenied/notFound` строят событийный payload и зовут
  `logger.accessGranted({...})` и т.д.; `serializeScope` из них уходит.
- `agent/types.ts`: удалить константы `ACCESS_GRANTED`, `ACCESS_DENIED`, `SCOPE_NOT_FOUND`,
  `ENTITY_NOT_FOUND`.
- Удалить `src/logger.ts`; `index.ts`: убрать `export { Logger }`, добавить экспорт `RBACLogger`,
  типов событий/`RBACEvent`/`RBACEventType`/`RBACLogLevel`/ `RBACLoggerOptions`/`RBACLogSink`,
  `DefaultRBACLogger` и токена `RBAC_LOGGER`.

## What Goes Where

- **Implementation Steps** — код пакета `packages/rbac` + тесты + миграция спеков.
- **Post-Completion** — проверка в consuming-проекте и publish-поток.

## Implementation Steps

### Task 1: Модуль `src/logging` — события, `RBACLogger`, `DefaultRBACLogger`

**Files:**

- Create: `packages/rbac/src/logging/events.ts`
- Create: `packages/rbac/src/logging/logger.ts`
- Create: `packages/rbac/src/logging/index.ts`
- Create: `packages/rbac/src/logging/default-logger.spec.ts`

- [x] описать в `logging/events.ts` 7 типов событий, `RBACEvent`, `RBACEventType`, `RBACLogLevel`
      (по Technical Details)
- [x] описать в `logging/logger.ts` `RBACLogger` (7 методов), `RBACLoggerOptions`, `RBACLogSink`,
      `DEFAULT_LOG_LEVELS`, тексты сообщений
- [x] реализовать `DefaultRBACLogger`: конструктор `(options, sink = new NestLogger('RBAC'))`, 7
      методов → `emit`; `false` в levels — early return; prefix; normalization details (scope →
      `serializeScope`, undefined → `'null'`; granted → `join(', ') || '(none)'`; required →
      `join(', ')`); `serializeScope`
- [x] barrel `logging/index.ts` (экспорт событий, `RBACLogger`, опций, `DefaultRBACLogger`)
- [x] написать тесты `DefaultRBACLogger` (fake-синк): дефолтный уровень и текст сообщения для
      каждого из 7 событий
- [x] написать тесты: переопределение уровня через `levels`, отключение события `false`, prefix в
      сообщении
- [x] написать тесты normalization details: scope-объект → строка, `scope` undefined → `'null'`,
      `grantedPermissions` пустой массив → `'(none)'`, `requiredPermissions` → `join(', ')` (без
      `'(none)'`-fallback), `error` пробрасывается, отсутствие лишних полей
- [x] написать тест дефолтного синка: инстанс Nest Logger с context `RBAC` (spy на прототип
      `NestLogger`)
- [x] выполнить `nx test rbac` — зелёно (доходка: task не трогает ядро, весь суит зелёный)

### Task 2: Тест-утилита `TestingRBACLogger`

**Files:**

- Create: `packages/rbac/src/test-utils/rbac-logger.ts`
- Create: `packages/rbac/src/test-utils/rbac-logger.spec.ts`

- [x] реализовать `TestingRBACLogger implements RBACLogger`: запись записей `{ type, ...payload }`,
      `clear()`
- [x] реализовать матчер: точки входа по событию (`accessGranted()`, …, `any()`),
      `withDetails(partial)`, `strict()` (полное совпадение payload),
      `toBeLogged()`/`toBeNotLogged()`/`toBeLoggedOnce()`/`toBeLoggedTimes(n)` с понятным
      fail-мессаджем (что ожидалось / что записано)
- [x] реализовать `RBACTestingLoggerModule.forTesting()` — `global: true` модуль, providers
      `TestingRBACLogger` + `{ provide: RBAC_LOGGER, useExisting: TestingRBACLogger }`, exports
      `RBAC_LOGGER`, `TestingRBACLogger`
- [x] написать тесты рекордера и матчера: запись по каждому событию, частичный match, strict match,
      количество, empty-кейс («no events recorded»)
- [x] выполнить `nx test rbac` — зелёно

### Task 3: Атомарный свитч ядра на новый контракт + миграция спеков

**Files:**

- Modify: `packages/rbac/src/rbac.providers.ts`
- Modify: `packages/rbac/src/rbac.module.ts`
- Modify: `packages/rbac/src/rbac.service.ts`
- Modify: `packages/rbac/src/agent/manager.ts`
- Modify: `packages/rbac/src/agent/list-agent-logs.ts`
- Modify: `packages/rbac/src/agent/entity-agent-logs.ts`
- Modify: `packages/rbac/src/agent/types.ts`
- Delete: `packages/rbac/src/logger.ts`
- Delete: `packages/rbac/src/test-utils/logger.ts`
- Modify: `packages/rbac/src/index.ts`
- Modify: `packages/rbac/src/agent/list-agent.spec.ts`
- Modify: `packages/rbac/src/agent/entity-agent.spec.ts`
- Modify: `packages/rbac/src/__tests__/module/permissions.spec.ts`
- Modify: `packages/rbac/src/__tests__/module/request-level-cache.spec.ts`
- Modify: `packages/rbac/src/mock/createRbacMocker.spec.ts`

- [x] `rbac.providers.ts`: добавить `RBAC_LOGGER = 'RBAC_LOGGER'` (введено в task 2)
- [x] `rbac.module.ts`: `forRoot({ baseResolver, logger? })` — регистрировать провайдер
      `RBAC_LOGGER` при наличии опции
- [x] `RbacServiceCore`: публичное свойство `logger?: RBACLogger`, холодный путь через
      `?? new DefaultRBACLogger()`; шлёт матричные события (с `type` в failed), строка «Initializing
      matrices…» удаляется
- [x] `RbacService`: `@Optional() @Inject(RBAC_LOGGER)` + fallback `new DefaultRBACLogger()`; в
      конструкторе `this.core.logger = this.logger`; убрать `setContext('RBAC')`; прокинуть логгер в
      `RBACAgentManager`
- [x] `RBACAgentManager`, `ListAgentLogs`, `EntityAgentLogs`: `RBACLogger`; события
      `accessGranted/accessDenied/scopeNotFound/entityNotFound` со структурным payload; нормализация
      `permissions` в `string[]`; убрать `serializeScope` из `list-agent-logs.ts`
- [x] `agent/types.ts`: удалить константы
      `ACCESS_GRANTED/ACCESS_DENIED/SCOPE_NOT_FOUND/     ENTITY_NOT_FOUND`; удалить `src/logger.ts`
      и `src/test-utils/logger.ts`
- [x] `index.ts`: убрать `Logger`; добавить экспорт logging-модуля и `RBAC_LOGGER`
- [x] миграция `list-agent.spec.ts` и `entity-agent.spec.ts`: ассерты на события
      (`logger.accessGranted().withDetails({...})`, scope-объект, массивы прав)
- [x] миграция `permissions.spec.ts`, `request-level-cache.spec.ts`, `createRbacMocker.spec.ts`:
      заменить `LocalLoggerModule.forTesting()` на `RBACTestingLoggerModule.forTesting()`
      (global-модуль — единственный путь, которым логгер доходит до `RbacService` из корня тестов)
- [x] выполнить `nx test rbac`, `nx typecheck rbac`, `nx lint-check rbac` — зелёно

### Task 4: Модульный тест логирования-обвязки (fallback / forRoot / токен)

**Files:**

- Create: `packages/rbac/src/__tests__/module/logging.spec.ts`

- [x] тест: `forRoot` без `logger` — fallback на `DefaultRBACLogger` (спай на `NestLogger`:
      матричные события видны в стандартном логгере; в провайдер под токеном события не доходят)
- [x] тест: `forRoot({ logger })` — кастомный логгер получает `matrixInitialized` при инициализации
      матриц (холодный путь через `RbacServiceCore`)
- [x] тест: `RBAC_LOGGER` из **global** тест-модуля (без опции forRoot) — события приходят туда; при
      наличии и опции forRoot и global-токена побеждает опция forRoot
- [x] тест: `RBAC_LOGGER` из **не-global** модуля до `RbacService` **не** доходит (пиннинг семантики
      скоупов Nest — регресс-тест на обвязку)
- [x] тест: горячий путь — события доступа (`accessGranted/accessDenied`) доходят до кастомного
      логгера через `RbacService.createManager`
- [x] выполнить `nx test rbac` — зелёно

### Task 5: Проверка acceptance-критериев

- [x] ✅ требования Solution Overview 1–5 реализованы: контракт 7 событий и `RBACLogger`
      (`src/logging/events.ts`, `src/logging/logger.ts`); `DefaultRBACLogger` с `levels`/`prefix` и
      `false`-отключением событий; токен `RBAC_LOGGER` + `forRoot({ logger })`; прокидка
      `core.logger` из `RbacService` и fallback на `DefaultRBACLogger`; `TestingRBACLogger` +
      `RBACTestingLoggerModule.forTesting()` (`global: true`), старые `Logger`/`MockLogger`/
      `LocalLoggerModule`/`TestingLogger` удалены (grep по `src/` — совпадений нет)
- [x] ✅ публичный API собранного пакета (`nx build rbac --skip-nx-cache` после `rm -rf dist`):
      `Logger` отсутствует и в `dist/index.d.ts`, и в runtime-экспортах (`require('./dist')` —
      `has Logger: false`); `RBACLogger`, `RBACLoggerOptions`, `RBACLogSink`, `RBACEvent`,
      `RBACEventType`, `RBACLogLevel` и типы всех 7 событий есть в `dist/index.d.ts`;
      `DefaultRBACLogger` и `RBAC_LOGGER` есть в runtime-экспортах. ⚠️ дефолтный синк — приватный
      `NestLoggerSink` (обёртка, маппящая `info` → Nest `log`), а не сырой `new NestLogger('RBAC')`:
      у Nest Logger нет метода `info`, требуемого `RBACLogSink`; контекст `RBAC` сохранён
- [x] ✅ полный суит `yarn test` (`nx run-many -t test --skip-nx-cache`): 146 passed | 3 skipped, 11
      файлов (база — 110 passed | 3 skipped)
- [x] ✅ `nx lint-check rbac` — зелёно, 0 errors (67 warnings — pre-existing
      `@typescript-eslint/no-explicit-any`/`no-non-null-assertion`, ни одного в новых файлах
      `src/logging/`, `src/test-utils/`); `nx typecheck rbac` — зелёно; `nx format-check rbac` — All
      matched files use Prettier code style
- [x] ✅ результаты зафиксированы здесь: 4 пункта ✅, 1 ⚠️ (обёртка дефолтного синка, см. выше),
      блокеров нет

### Task 6: [Final] Документация и архивация плана

- [ ] README у пакета отсутствует — при необходимости добавить короткий раздел про логирование
      (решение по факту: если README не заводили, пункт закрывается пометкой)
- [ ] перенести план в `docs/plans/completed/20261015-rbac-logging.md`

## Post-Completion

_Требуют ручных действий или внешнего контура — без чекбоксов_

**Проверка в consuming-проектах:**

- подключить к тестовому приложению `new DefaultRBACLogger({ levels: { accessGranted: 'info' } })`
  и/или свой `RBACLogger`; убедиться, что события приходят и дефолтный вывод прежних логов
  совпадает.
- ручной провайдер `RBAC_LOGGER` регистрируется в **global**-модуле приложения, иначе до скоупа
  `RbacModule` он не доходит.
- проверить, что `app.useLogger(...)` не перехватывает дефолтный логгер (осознанное поведение —
  context живёт в синке).

**Публикация:**

- breaking-изменения (удаление экспорта `Logger`, сигнатура `RBACAgentManager`) — в changelog
  следующего релиза пакета `@jt4d/nest-rbac`.
- публикация — штатный флоу: тег `vX.Y.Z` → staged publish → approve (см. AGENTS.md).
