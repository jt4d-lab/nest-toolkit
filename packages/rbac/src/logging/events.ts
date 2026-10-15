import type { ScopeType } from '../matrix';

/**
 * Уровни логирования RBAC-событий.
 */
export type RBACLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Имя RBAC-события.
 *
 * Дискриминатор объединения `RBACEvent` — название метода `RBACLogger`, принимающего событие.
 */
export type RBACEventType =
    | 'accessGranted'
    | 'accessDenied'
    | 'scopeNotFound'
    | 'entityNotFound'
    | 'matrixInitialized'
    | 'matrixInstantiateFailed'
    | 'matrixInitFailed';

/**
 * Базовые поля событий доступа: результат резолвинга прав по матрице.
 */
export interface AccessEventBase {
    /** Имя матрицы. */
    matrix: string;
    /** Идентификатор профиля пользователя (`baseScope.profileId || 0`). */
    user: string | number;
    /** Полученные пользователем права. */
    grantedPermissions: string[];
    /** Запрошенные права. */
    requiredPermissions: string[];
    /** Режим проверки. */
    mode: 'some' | 'every';
}

/**
 * Доступ разрешён.
 */
export interface AccessGrantedEvent extends AccessEventBase {
    /** Скоуп запроса (только для list-матриц; у event-матриц ключ отсутствует). */
    scope?: Partial<ScopeType>;
    /** Идентификатор сущности (только для event-матриц; у list-матриц ключ отсутствует). */
    entity?: string | number;
}

/**
 * Доступ запрещён.
 */
export interface AccessDeniedEvent extends AccessEventBase {
    /** Скоуп запроса (только для list-матриц; у event-матриц ключ отсутствует). */
    scope?: Partial<ScopeType>;
    /** Идентификатор сущности (только для event-матриц; у list-матриц ключ отсутствует). */
    entity?: string | number;
}

/**
 * Скоуп не найден (list-матрицы).
 */
export interface ScopeNotFoundEvent {
    /** Имя матрицы. */
    matrix: string;
    /** Идентификатор профиля пользователя. */
    user: string | number;
    /** Запрошенный скоуп. */
    scope?: Partial<ScopeType>;
}

/**
 * Сущность не найдена (event-матрицы).
 */
export interface EntityNotFoundEvent {
    /** Имя матрицы. */
    matrix: string;
    /** Идентификатор профиля пользователя. */
    user: string | number;
    /** Идентификатор запрошенной сущности. */
    entity?: string | number;
}

/**
 * Матрица инициализирована.
 */
export interface MatrixInitializedEvent {
    /** Имя матрицы. */
    matrix: string;
}

/**
 * Не удалось создать экземпляр резолвера матрицы.
 */
export interface MatrixInstantiateFailedEvent {
    /** Имя матрицы. */
    matrix: string;
    /** Имя класса резолвера. */
    type: string;
    /** Ошибка. */
    error: unknown;
}

/**
 * Не удалось инициализировать матрицу.
 */
export interface MatrixInitFailedEvent {
    /** Имя матрицы. */
    matrix: string;
    /** Имя класса резолвера. */
    type: string;
    /** Ошибка. */
    error: unknown;
}

/**
 * RBAC-событие: структурный payload лог-записи.
 *
 * Поле `type` в payload отсутствует — дискриминатором является имя метода `RBACLogger`.
 */
export type RBACEvent =
    | AccessGrantedEvent
    | AccessDeniedEvent
    | ScopeNotFoundEvent
    | EntityNotFoundEvent
    | MatrixInitializedEvent
    | MatrixInstantiateFailedEvent
    | MatrixInitFailedEvent;
