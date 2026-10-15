import { DynamicModule, Module } from '@nestjs/common';

import type {
    AccessDeniedEvent,
    AccessGrantedEvent,
    EntityNotFoundEvent,
    MatrixInitFailedEvent,
    MatrixInitializedEvent,
    MatrixInstantiateFailedEvent,
    RBACEvent,
    RBACEventType,
    RBACLogger,
    ScopeNotFoundEvent,
} from '../logging';
import { RBAC_LOGGER } from '../rbac.providers';

/**
 * Запись RBAC-события: дискриминатор `event` (имя метода логгера) и payload события.
 *
 * Дискриминатор не занимает ключ `type`: в payload событий
 * `matrixInstantiateFailed`/`matrixInitFailed` уже есть поле `type` — имя класса
 * резолвера.
 */
export interface RBACLogRecord {
    event: RBACEventType;
    [field: string]: unknown;
}

/**
 * Рекордер и матчер RBAC-событий для тестов.
 *
 * Метод события с аргументом записывает запись `{ event, ...payload }`
 * (интерфейс `RBACLogger`); без аргумента возвращает матчер по этому типу
 * события. `any()` — матчер по всем событиям.
 */
export class TestingRBACLogger implements RBACLogger {
    private readonly records: RBACLogRecord[] = [];

    accessGranted(): RBACTestingLoggerMatcher;
    accessGranted(event: AccessGrantedEvent): void;
    accessGranted(event?: AccessGrantedEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('accessGranted', event);
    }

    accessDenied(): RBACTestingLoggerMatcher;
    accessDenied(event: AccessDeniedEvent): void;
    accessDenied(event?: AccessDeniedEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('accessDenied', event);
    }

    scopeNotFound(): RBACTestingLoggerMatcher;
    scopeNotFound(event: ScopeNotFoundEvent): void;
    scopeNotFound(event?: ScopeNotFoundEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('scopeNotFound', event);
    }

    entityNotFound(): RBACTestingLoggerMatcher;
    entityNotFound(event: EntityNotFoundEvent): void;
    entityNotFound(event?: EntityNotFoundEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('entityNotFound', event);
    }

    matrixInitialized(): RBACTestingLoggerMatcher;
    matrixInitialized(event: MatrixInitializedEvent): void;
    matrixInitialized(event?: MatrixInitializedEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('matrixInitialized', event);
    }

    matrixInstantiateFailed(): RBACTestingLoggerMatcher;
    matrixInstantiateFailed(event: MatrixInstantiateFailedEvent): void;
    matrixInstantiateFailed(event?: MatrixInstantiateFailedEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('matrixInstantiateFailed', event);
    }

    matrixInitFailed(): RBACTestingLoggerMatcher;
    matrixInitFailed(event: MatrixInitFailedEvent): void;
    matrixInitFailed(event?: MatrixInitFailedEvent): RBACTestingLoggerMatcher | void {
        return this.matchOrRecord('matrixInitFailed', event);
    }

    /**
     * Очищает все записанные события.
     */
    clear(): void {
        this.records.length = 0;
    }

    /**
     * Матчер по всем записанным событиям независимо от типа.
     */
    any(): RBACTestingLoggerMatcher {
        return new RBACTestingLoggerMatcher(this.records);
    }

    private matchOrRecord(type: RBACEventType, event?: RBACEvent): RBACTestingLoggerMatcher | void {
        if (event === undefined) {
            return new RBACTestingLoggerMatcher(this.records, type);
        }

        this.records.push({ event: type, ...event });
    }
}

/**
 * Матчер по записанным RBAC-событиям.
 *
 * Фильтрация по типу события и полям payload: `withDetails(partial)` —
 * подмножество ключей (каждый сравнивается по глубокому равенству),
 * `strict()` — точное совпадение payload без лишних ключей.
 * Ассерты количества бросают ошибку с сообщением об ожидаемом и записанном.
 */
export class RBACTestingLoggerMatcher {
    constructor(
        private readonly records: RBACLogRecord[],
        private readonly type?: RBACEventType,
        private readonly details: Record<string, unknown> = {},
        private readonly exact = false,
    ) {}

    /**
     * Фильтрует по полям payload (подмножество ключей, глубокое равенство).
     */
    withDetails(partial: Record<string, unknown>): RBACTestingLoggerMatcher {
        return new RBACTestingLoggerMatcher(
            this.records,
            this.type,
            { ...this.details, ...partial },
            this.exact,
        );
    }

    /**
     * Строгий режим: payload должен совпадать полностью, без лишних ключей.
     */
    strict(): RBACTestingLoggerMatcher {
        return new RBACTestingLoggerMatcher(this.records, this.type, this.details, true);
    }

    /**
     * Записи, прошедшие текущий фильтр.
     */
    get logs(): RBACLogRecord[] {
        return this.records.filter((record) => this.matches(record));
    }

    /**
     * Ожидает хотя бы одно совпадение.
     */
    toBeLogged(): void {
        if (this.logs.length > 0) {
            return;
        }

        this.fail('at least 1 event');
    }

    /**
     * Ожидает, что совпадений нет.
     */
    toBeNotLogged(): void {
        this.toBeLoggedTimes(0);
    }

    /**
     * Ожидает ровно одно совпадение.
     */
    toBeLoggedOnce(): void {
        this.toBeLoggedTimes(1);
    }

    /**
     * Ожидает ровно `n` совпадений.
     */
    toBeLoggedTimes(n: number): void {
        if (this.logs.length === n) {
            return;
        }

        this.fail(countLabel(n));
    }

    private matches(record: RBACLogRecord): boolean {
        if (this.type !== undefined && record.event !== this.type) {
            return false;
        }

        const payload: Record<string, unknown> = { ...record };
        delete payload.event;

        if (this.exact) {
            return deepEquals(payload, this.details);
        }

        return Object.entries(this.details).every(([key, value]) => {
            return deepEquals(payload[key], value);
        });
    }

    private fail(expectedLabel: string): never {
        const matched = this.logs;
        const expected = `Expected ${expectedLabel}${this.describeFilter()} to be logged`;

        if (this.records.length === 0) {
            throw new Error(`${expected}, but no events were recorded.`);
        }

        const list = this.records.map((record) => `  - ${formatRecord(record)}`).join('\n');

        throw new Error(
            `${expected}, but ${matched.length} matched.\n` +
                `Recorded events (${this.records.length}):\n${list}`,
        );
    }

    private describeFilter(): string {
        const type = this.type === undefined ? '' : ` of type "${this.type}"`;
        const details =
            Object.keys(this.details).length === 0
                ? ''
                : ` matching details ${formatPayload(this.details)}`;
        const mode = this.exact ? ' (strict)' : '';

        return `${type}${details}${mode}`;
    }
}

/**
 * Тестовый модуль логирования RBAC-событий.
 *
 * `global: true` — единственный путь, которым логгер доходит до `RbacService`
 * из корня тестов (зеркало старого `LocalLoggerModule`).
 */
@Module({})
export class RBACTestingLoggerModule {
    static forTesting(): DynamicModule {
        return {
            global: true,
            module: RBACTestingLoggerModule,
            providers: [
                TestingRBACLogger,
                {
                    provide: RBAC_LOGGER,
                    useExisting: TestingRBACLogger,
                },
            ],
            exports: [RBAC_LOGGER, TestingRBACLogger],
        };
    }
}

/**
 * Глубокое равенство значений payload (строки, числа, булевы, массивы,
 * простые объекты, `Error`). Ключи со значением `undefined` игнорируются —
 * как в семантике `toEqual`.
 */
function deepEquals(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }

    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }

    if (a instanceof Error || b instanceof Error) {
        return (
            a instanceof Error && b instanceof Error && a.name === b.name && a.message === b.message
        );
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        return (
            Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((value, i) => deepEquals(value, b[i]))
        );
    }

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const aKeys = Object.keys(objA).filter((key) => objA[key] !== undefined);
    const bKeys = Object.keys(objB).filter((key) => objB[key] !== undefined);

    return (
        aKeys.length === bKeys.length &&
        aKeys.every((key) => Object.hasOwn(objB, key) && deepEquals(objA[key], objB[key]))
    );
}

function countLabel(count: number): string {
    if (count === 0) {
        return 'no events';
    }

    return count === 1 ? '1 event' : `${count} events`;
}

function formatRecord(record: RBACLogRecord): string {
    const payload: Record<string, unknown> = { ...record };
    delete payload.event;

    return `${record.event} ${formatPayload(payload)}`;
}

/**
 * JSON для fail-мессаджа; `Error`-значения — как `"Name: message"`.
 */
function formatPayload(payload: Record<string, unknown>): string {
    try {
        return JSON.stringify(payload, (_key: string, value: unknown) =>
            value instanceof Error ? `${value.name}: ${value.message}` : value,
        );
    } catch {
        return String(payload);
    }
}
