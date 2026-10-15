import { Logger as NestLogger } from '@nestjs/common';

import type {
    AccessDeniedEvent,
    AccessGrantedEvent,
    EntityNotFoundEvent,
    MatrixInitFailedEvent,
    MatrixInitializedEvent,
    MatrixInstantiateFailedEvent,
    ScopeNotFoundEvent,
} from './events';
import { DefaultRBACLogger } from './logger';
import type { RBACLogSink } from './logger';

interface SinkCall {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    details?: object;
}

function createFakeSink() {
    const calls: SinkCall[] = [];

    const record = (level: SinkCall['level']) => (message: string, details?: object) => {
        calls.push({ level, message, details });
    };

    const sink: RBACLogSink = {
        debug: record('debug'),
        info: record('info'),
        warn: record('warn'),
        error: record('error'),
    };

    return { calls, sink };
}

const matrixError = new Error('boom');

const listGrantedEvent: AccessGrantedEvent = {
    matrix: 'article',
    user: 1,
    scope: { orgId: 5, dept: 3 },
    grantedPermissions: ['read', 'edit'],
    requiredPermissions: ['read', 'post'],
    mode: 'some',
};

const listDeniedEvent: AccessDeniedEvent = {
    matrix: 'article',
    user: 0,
    scope: { orgId: 5, dept: 3 },
    grantedPermissions: [],
    requiredPermissions: ['post'],
    mode: 'every',
};

const entityGrantedEvent: AccessGrantedEvent = {
    matrix: 'author',
    user: 1,
    entity: 2,
    grantedPermissions: ['read'],
    requiredPermissions: ['read', 'post'],
    mode: 'some',
};

const scopeNotFoundEvent: ScopeNotFoundEvent = {
    matrix: 'article',
    user: 1,
    scope: { orgId: 5, dept: 3 },
};

const entityNotFoundEvent: EntityNotFoundEvent = {
    matrix: 'article',
    user: 1,
    entity: 9,
};

const matrixInitializedEvent: MatrixInitializedEvent = {
    matrix: 'article',
};

const matrixInstantiateFailedEvent: MatrixInstantiateFailedEvent = {
    matrix: 'article',
    type: 'ArticleRBAC',
    error: matrixError,
};

const matrixInitFailedEvent: MatrixInitFailedEvent = {
    matrix: 'article',
    type: 'ArticleRBAC',
    error: matrixError,
};

describe('RBAC / DefaultRBACLogger', () => {
    describe('уровни и тексты сообщений по умолчанию', () => {
        it('accessGranted: уровень debug, текст "Access granted"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessGranted(listGrantedEvent);

            expect(calls).toEqual([
                {
                    level: 'debug',
                    message: 'Access granted',
                    details: {
                        matrix: 'article',
                        scope: 'orgId: 5, dept: 3',
                        user: 1,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read, post',
                        mode: 'some',
                    },
                },
            ]);
        });

        it('accessDenied: уровень warn, текст "Access denied"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessDenied(listDeniedEvent);

            expect(calls).toEqual([
                {
                    level: 'warn',
                    message: 'Access denied',
                    details: {
                        matrix: 'article',
                        scope: 'orgId: 5, dept: 3',
                        user: 0,
                        grantedPermissions: '(none)',
                        requiredPermissions: 'post',
                        mode: 'every',
                    },
                },
            ]);
        });

        it('scopeNotFound: уровень warn, текст "Scope not found"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.scopeNotFound(scopeNotFoundEvent);

            expect(calls).toEqual([
                {
                    level: 'warn',
                    message: 'Scope not found',
                    details: {
                        matrix: 'article',
                        scope: 'orgId: 5, dept: 3',
                        user: 1,
                    },
                },
            ]);
        });

        it('entityNotFound: уровень warn, текст "Entity not found"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.entityNotFound(entityNotFoundEvent);

            expect(calls).toEqual([
                {
                    level: 'warn',
                    message: 'Entity not found',
                    details: {
                        matrix: 'article',
                        entity: 9,
                        user: 1,
                    },
                },
            ]);
        });

        it('matrixInitialized: уровень info, текст "Matrix "article" initialized"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.matrixInitialized(matrixInitializedEvent);

            expect(calls).toEqual([
                {
                    level: 'info',
                    message: 'Matrix "article" initialized',
                    details: {
                        matrix: 'article',
                    },
                },
            ]);
        });

        it('matrixInstantiateFailed: уровень error, текст про неудачное создание инстанса', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.matrixInstantiateFailed(matrixInstantiateFailedEvent);

            expect(calls).toEqual([
                {
                    level: 'error',
                    message: 'Failed to create an instance of the matrix "article" (ArticleRBAC)',
                    details: {
                        matrix: 'article',
                        type: 'ArticleRBAC',
                        error: matrixError,
                    },
                },
            ]);
        });

        it('matrixInitFailed: уровень error, текст про неудачную инициализацию', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.matrixInitFailed(matrixInitFailedEvent);

            expect(calls).toEqual([
                {
                    level: 'error',
                    message: 'Matrix "article" (ArticleRBAC) initialization failed',
                    details: {
                        matrix: 'article',
                        type: 'ArticleRBAC',
                        error: matrixError,
                    },
                },
            ]);
        });
    });

    describe('опция levels', () => {
        it('переопределяет уровень события', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({ levels: { accessGranted: 'info' } }, sink);

            logger.accessGranted(listGrantedEvent);

            expect(calls).toHaveLength(1);
            expect(calls[0]?.level).toBe('info');
        });

        it('false отключает событие', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({ levels: { accessDenied: false } }, sink);

            logger.accessDenied(listDeniedEvent);

            expect(calls).toHaveLength(0);
        });
    });

    describe('опция prefix', () => {
        it('добавляет prefix к началу сообщения', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({ prefix: 'APP' }, sink);

            logger.matrixInitialized(matrixInitializedEvent);

            expect(calls).toHaveLength(1);
            expect(calls[0]?.message).toBe('APP Matrix "article" initialized');
        });
    });

    describe('нормализация details', () => {
        it('scope-объект сериализуется в строку через ", "', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessGranted({
                ...listGrantedEvent,
                scope: { orgId: 5, dept: 3, sub: 7 },
            });

            expect(calls[0]?.details).toMatchObject({
                scope: 'orgId: 5, dept: 3, sub: 7',
            });
        });

        it('undefined-значения в scope пропускаются', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.scopeNotFound({
                ...scopeNotFoundEvent,
                scope: { orgId: 5, sub: undefined },
            });

            expect(calls[0]?.details).toMatchObject({
                scope: 'orgId: 5',
            });
        });

        it('scope undefined сериализуется в "null"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessGranted({ ...listGrantedEvent, scope: undefined });

            expect(calls[0]?.details).toMatchObject({
                scope: 'null',
            });
        });

        it('пустой scope-объект сериализуется в пустую строку', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessGranted({ ...listGrantedEvent, scope: {} });

            expect(calls[0]?.details).toMatchObject({
                scope: '',
            });
        });

        it('в событии доступа есть только ключ scope или только ключ entity', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessGranted(entityGrantedEvent);

            expect(calls[0]?.details).toEqual({
                matrix: 'author',
                entity: 2,
                user: 1,
                grantedPermissions: 'read',
                requiredPermissions: 'read, post',
                mode: 'some',
            });
        });

        it('пустой grantedPermissions сериализуется в "(none)"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessDenied({ ...listDeniedEvent, grantedPermissions: [] });

            expect(calls[0]?.details).toMatchObject({
                grantedPermissions: '(none)',
            });
        });

        it('requiredPermissions сериализуется через ", " без fallback "(none)"', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.accessGranted({ ...listGrantedEvent, requiredPermissions: [] });

            expect(calls[0]?.details).toMatchObject({
                requiredPermissions: '',
            });
        });

        it('ошибка матричных событий пробрасывается в details как есть', () => {
            const { calls, sink } = createFakeSink();
            const logger = new DefaultRBACLogger({}, sink);

            logger.matrixInitFailed(matrixInitFailedEvent);

            expect(calls[0]?.details).toMatchObject({
                error: matrixError,
            });
            expect((calls[0]?.details as Record<string, unknown>)?.error).toBe(matrixError);
        });
    });

    describe('дефолтный синк', () => {
        type NestLoggerMethod = 'debug' | 'log' | 'warn' | 'error';

        interface NestCall {
            method: NestLoggerMethod;
            context?: string;
            message: unknown;
            details?: unknown;
        }

        let captured: NestCall[] = [];

        beforeEach(() => {
            captured = [];

            const methods: NestLoggerMethod[] = ['debug', 'log', 'warn', 'error'];

            methods.forEach((method) => {
                vi.spyOn(NestLogger.prototype, method).mockImplementation(function (
                    this: unknown,
                    message: unknown,
                    ...optionalParams: unknown[]
                ) {
                    captured.push({
                        method,
                        context: (this as { context?: string }).context,
                        message,
                        details: optionalParams[0],
                    });
                });
            });
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('пишет события в Nest Logger с контекстом RBAC', () => {
            const logger = new DefaultRBACLogger();

            logger.accessGranted(listGrantedEvent);
            logger.accessDenied(listDeniedEvent);
            logger.scopeNotFound(scopeNotFoundEvent);
            logger.entityNotFound(entityNotFoundEvent);
            logger.matrixInitialized(matrixInitializedEvent);
            logger.matrixInstantiateFailed(matrixInstantiateFailedEvent);
            logger.matrixInitFailed(matrixInitFailedEvent);

            expect(captured).toEqual([
                {
                    method: 'debug',
                    context: 'RBAC',
                    message: 'Access granted',
                    details: {
                        matrix: 'article',
                        scope: 'orgId: 5, dept: 3',
                        user: 1,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read, post',
                        mode: 'some',
                    },
                },
                {
                    method: 'warn',
                    context: 'RBAC',
                    message: 'Access denied',
                    details: {
                        matrix: 'article',
                        scope: 'orgId: 5, dept: 3',
                        user: 0,
                        grantedPermissions: '(none)',
                        requiredPermissions: 'post',
                        mode: 'every',
                    },
                },
                {
                    method: 'warn',
                    context: 'RBAC',
                    message: 'Scope not found',
                    details: {
                        matrix: 'article',
                        scope: 'orgId: 5, dept: 3',
                        user: 1,
                    },
                },
                {
                    method: 'warn',
                    context: 'RBAC',
                    message: 'Entity not found',
                    details: {
                        matrix: 'article',
                        entity: 9,
                        user: 1,
                    },
                },
                {
                    method: 'log',
                    context: 'RBAC',
                    message: 'Matrix "article" initialized',
                    details: {
                        matrix: 'article',
                    },
                },
                {
                    method: 'error',
                    context: 'RBAC',
                    message: 'Failed to create an instance of the matrix "article" (ArticleRBAC)',
                    details: {
                        matrix: 'article',
                        type: 'ArticleRBAC',
                        error: matrixError,
                    },
                },
                {
                    method: 'error',
                    context: 'RBAC',
                    message: 'Matrix "article" (ArticleRBAC) initialization failed',
                    details: {
                        matrix: 'article',
                        type: 'ArticleRBAC',
                        error: matrixError,
                    },
                },
            ]);
        });
    });
});
