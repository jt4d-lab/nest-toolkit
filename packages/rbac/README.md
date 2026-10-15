# @jt4d/nest-rbac

RBAC-модуль NestJS: матрицы разрешений, роли, агенты проверки прав на сущностях и списках.

## Подключение

```ts
// app.module.ts
import { Global, Injectable, Module } from '@nestjs/common';
import { RbacModule } from '@jt4d/nest-rbac';

@Injectable()
export class MyBaseResolver {
    getBaseScope() {
        return { loggedIn: true, scope: {} };
    }
    async getBaseRoles() {
        return [];
    }
}

// Резолверы резолвятся из DI, поэтому должны быть провайдерами, видимыми `RbacModule`:
// корневой резолвер — в `@Global()`-модуле.
@Global()
@Module({
    providers: [MyBaseResolver],
    exports: [MyBaseResolver],
})
export class BaseModule {}

@Module({
    imports: [
        BaseModule,
        RbacModule.forRoot({ baseResolver: MyBaseResolver }),
        RbacModule.forFeature([ArticleRBAC]),
    ],
    // Классы матриц из `forFeature([...])` — провайдеры модуля, импортирующего `forFeature`.
    providers: [ArticleRBAC],
})
export class AppModule {}
```

`forRoot({ baseResolver, logger? })` регистрирует корневой резолвер (и, опционально, логгер),
`forFeature([...])` подключает матрицы. `baseResolver` и классы матриц резолвятся из DI, поэтому
должны быть провайдерами: `baseResolver` — в `@Global()`-модуле (иначе `RbacModule` его не найдёт),
классы матриц — в модуле, импортирующем `forFeature` (в приложении с несколькими feature-модулями
`forFeature([Matrix])` кладут в модуль-владелец матрицы).

Матрицы инициализируются явно: Nest сам этого не делает, поэтому вызовите `RbacModule.init(app)` в
бутстрапе.

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { RbacModule } from '@jt4d/nest-rbac';

import { AppModule } from './app.module';

const app = await NestFactory.create(AppModule);

await app.get(RbacModule).init(app);

await app.listen(3000);
```

Без вызова `init` обращения к матрице (`getPermissionMatrix`, агенты) бросят
`Matrix "<name>" not found`.

## Логирование

Пакет логирует **события** вместо сырых строк. Свой логгер передаётся в `forRoot`:

```ts
import { DefaultRBACLogger, RbacModule } from '@jt4d/nest-rbac';

RbacModule.forRoot({
    baseResolver: MyBaseResolver,
    logger: new DefaultRBACLogger({
        prefix: 'APP',
        levels: { accessGranted: 'info', accessDenied: false },
    }),
});
```

`logger` — любой объект, реализующий интерфейс `RBACLogger` (метод на событие). По умолчанию
используется `DefaultRBACLogger`, который пишет события в стандартный `Logger` Nest с контекстом
`RBAC`.

### События

`RBACLogger` принимает 7 событий (дискриминатор — имя метода, payload — структурный объект):

| Событие                   | Уровень по умолчанию | Payload                                    |
| ------------------------- | -------------------- | ------------------------------------------ |
| `accessGranted`           | `debug`              | матрица, пользователь, права, scope/entity |
| `accessDenied`            | `warn`               | матрица, пользователь, права, scope/entity |
| `scopeNotFound`           | `warn`               | матрица, пользователь, scope               |
| `entityNotFound`          | `warn`               | матрица, пользователь, entity              |
| `matrixInitialized`       | `info`               | матрица                                    |
| `matrixInstantiateFailed` | `error`              | матрица, класс резолвера, ошибка           |
| `matrixInitFailed`        | `error`              | матрица, класс резолвера, ошибка           |

### `DefaultRBACLogger`

Опции:

- `prefix?: string` — префикс в начале каждого сообщения;
- `levels?: Partial<Record<RBACEventType, RBACLogLevel | false>>` — переопределение уровня события
  (`'debug' | 'info' | 'warn' | 'error'`) или `false`, чтобы событие не логировать.

Второй, необязательный аргумент конструктора — `RBACLogSink` (точка вывода; по умолчанию — `Logger`
Nest с контекстом `RBAC`). Синк можно подменить в тестах.

### Токен `RBAC_LOGGER`

Вместо опции `logger` свой логгер можно зарегистрировать под публичным токеном `RBAC_LOGGER`. Такой
провайдер должен быть в **`@Global()`**-модуле: провайдеры не-global модулей приложения не видны
`RbacService`, и логгер до него не дойдёт (так же устроен тестовый
`RBACTestingLoggerModule.forTesting()`).

Приоритет: опция `forRoot({ logger })` > `RBAC_LOGGER` из global-модуля > `DefaultRBACLogger`. Опция
`forRoot` авторитетна и обслуживает как инициализацию матриц (холодный путь), так и события доступа
(горячий путь), независимо от порядка подключения модулей.

### Тестирование (внутренние утилиты пакета)

`TestingRBACLogger` и `RBACTestingLoggerModule.forTesting()` (каталог `test-utils`) — внутренние
тест-утилиты пакета: они не входят в `exports` `package.json`, не собираются в `dist` и не
реэкспортируются из `index.ts`, поэтому потребителю пакета недоступны. В своих тестах подставьте
собственную реализацию `RBACLogger` (или свой синк `DefaultRBACLogger`) тем же способом, что и в
приложении: опцией `forRoot({ logger })` или global-модулем с провайдером `RBAC_LOGGER`.

Внутри репозитория `TestingRBACLogger` записывает события и даёт матчер:

```ts
logger.accessGranted().withDetails({ matrix: 'article', user: 1 }).toBeLoggedOnce();
logger.clear();
```

## Breaking changes

Относительно версий до событийного логирования:

- удалён публичный экспорт `Logger` (заменён на `RBACLogger`/`DefaultRBACLogger`);
- конструктор публичного `RBACAgentManager` получил обязательный 4-й параметр `logger: RBACLogger`.

Оба изменения учтены в `CHANGELOG.md`.
