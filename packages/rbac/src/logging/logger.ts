import { Logger as NestLogger } from '@nestjs/common';

import type {
    AccessDeniedEvent,
    AccessGrantedEvent,
    EntityNotFoundEvent,
    MatrixInitFailedEvent,
    MatrixInitializedEvent,
    MatrixInstantiateFailedEvent,
    RBACEventType,
    RBACLogLevel,
    ScopeNotFoundEvent,
} from './events';

/**
 * Логгер RBAC-событий.
 *
 * Метод на каждое событие `RBACEventType`; payload передаётся без поля `type`
 * (дискриминатором является имя метода).
 */
export interface RBACLogger {
    accessGranted(event: AccessGrantedEvent): void;
    accessDenied(event: AccessDeniedEvent): void;
    scopeNotFound(event: ScopeNotFoundEvent): void;
    entityNotFound(event: EntityNotFoundEvent): void;
    matrixInitialized(event: MatrixInitializedEvent): void;
    matrixInstantiateFailed(event: MatrixInstantiateFailedEvent): void;
    matrixInitFailed(event: MatrixInitFailedEvent): void;
}

/**
 * Точка вывода логов: куда `DefaultRBACLogger` раскидывает сообщения событий.
 */
export interface RBACLogSink {
    debug(message: string, details?: object): void;
    info(message: string, details?: object): void;
    warn(message: string, details?: object): void;
    error(message: string, details?: object): void;
}

/**
 * Опции `DefaultRBACLogger`.
 */
export interface RBACLoggerOptions {
    /** Префикс, добавляемый к началу каждого сообщения. */
    prefix?: string;
    /**
     * Переопределение уровня логирования события.
     *
     * `false` — событие не логировать.
     */
    levels?: Partial<Record<RBACEventType, RBACLogLevel | false>>;
}

const DEFAULT_LOG_LEVELS: Record<RBACEventType, RBACLogLevel> = {
    accessGranted: 'debug',
    accessDenied: 'warn',
    scopeNotFound: 'warn',
    entityNotFound: 'warn',
    matrixInitialized: 'info',
    matrixInstantiateFailed: 'error',
    matrixInitFailed: 'error',
};

/**
 * Синк поверх Nest Logger: уровень `info` события уходит в `log` Nest Logger.
 *
 * Контекст `RBAC` живёт в синке, поэтому логгеру не нужен отдельный `setContext`.
 */
class NestLoggerSink implements RBACLogSink {
    private readonly logger = new NestLogger('RBAC');

    debug(message: string, details?: object): void {
        this.logger.debug(message, details);
    }

    info(message: string, details?: object): void {
        this.logger.log(message, details);
    }

    warn(message: string, details?: object): void {
        this.logger.warn(message, details);
    }

    error(message: string, details?: object): void {
        this.logger.error(message, details);
    }
}

/**
 * Дефолтный логгер RBAC-событий.
 *
 * Пишет события в синк (по умолчанию — Nest Logger с контекстом `RBAC`) на
 * настраиваемых уровнях. Детали события нормализуются в формат текущих логов:
 * scope-объект — в строку, массивы прав — в строки через `', '`.
 */
export class DefaultRBACLogger implements RBACLogger {
    private readonly levels: Partial<Record<RBACEventType, RBACLogLevel | false>>;
    private readonly prefix?: string;
    private readonly sink: RBACLogSink;

    constructor(options: RBACLoggerOptions = {}, sink: RBACLogSink = new NestLoggerSink()) {
        this.levels = { ...DEFAULT_LOG_LEVELS, ...options.levels };
        this.prefix = options.prefix;
        this.sink = sink;
    }

    accessGranted(event: AccessGrantedEvent): void {
        this.emit('accessGranted', 'Access granted', normalizeAccessEventDetails(event));
    }

    accessDenied(event: AccessDeniedEvent): void {
        this.emit('accessDenied', 'Access denied', normalizeAccessEventDetails(event));
    }

    scopeNotFound(event: ScopeNotFoundEvent): void {
        this.emit('scopeNotFound', 'Scope not found', {
            matrix: event.matrix,
            scope: serializeScope(event.scope),
            user: event.user,
        });
    }

    entityNotFound(event: EntityNotFoundEvent): void {
        this.emit('entityNotFound', 'Entity not found', {
            matrix: event.matrix,
            entity: event.entity,
            user: event.user,
        });
    }

    matrixInitialized(event: MatrixInitializedEvent): void {
        this.emit('matrixInitialized', `Matrix "${event.matrix}" initialized`, {
            matrix: event.matrix,
        });
    }

    matrixInstantiateFailed(event: MatrixInstantiateFailedEvent): void {
        this.emit(
            'matrixInstantiateFailed',
            `Failed to create an instance of the matrix "${event.matrix}" (${event.type})`,
            {
                matrix: event.matrix,
                type: event.type,
                error: event.error,
            },
        );
    }

    matrixInitFailed(event: MatrixInitFailedEvent): void {
        this.emit(
            'matrixInitFailed',
            `Matrix "${event.matrix}" (${event.type}) initialization failed`,
            {
                matrix: event.matrix,
                type: event.type,
                error: event.error,
            },
        );
    }

    private emit(type: RBACEventType, message: string, details: object): void {
        const level = this.levels[type] ?? DEFAULT_LOG_LEVELS[type];

        if (level === false) {
            return;
        }

        this.sink[level](this.prefix ? `${this.prefix} ${message}` : message, details);
    }
}

/**
 * Нормализация payload события доступа в детали лог-записи в стиле текущих логов:
 * scope-объект — в строку (отсутствует — `'null'`), массивы прав — в строки.
 *
 * Ключи `scope` и `entity` попадают в детали только если ядро поставило их в payload
 * (у list-событий — `scope`, у event-событий — `entity`).
 */
function normalizeAccessEventDetails(event: AccessGrantedEvent | AccessDeniedEvent): object {
    const details: Record<string, unknown> = {
        matrix: event.matrix,
    };

    if ('scope' in event) {
        details.scope = serializeScope(event.scope);
    }

    if ('entity' in event) {
        details.entity = event.entity;
    }

    details.user = event.user;
    details.grantedPermissions = event.grantedPermissions.join(', ') || '(none)';
    details.requiredPermissions = event.requiredPermissions.join(', ');
    details.mode = event.mode;

    return details;
}

/**
 * Сериализация scope в строку в формате текущих логов (`orgId: 5, dept: 3`).
 *
 * `null`/`undefined`-значения пропускаются; отсутствующий scope — строка `'null'`.
 */
function serializeScope(scope?: null | Record<string, string | number | undefined | null>): string {
    if (!scope) {
        return 'null';
    }

    return Object.entries(scope)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
}
