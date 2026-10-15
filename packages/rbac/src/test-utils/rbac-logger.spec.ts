import type {
    AccessDeniedEvent,
    AccessGrantedEvent,
    EntityNotFoundEvent,
    MatrixInitFailedEvent,
    MatrixInitializedEvent,
    MatrixInstantiateFailedEvent,
    RBACLogger,
    ScopeNotFoundEvent,
} from '../logging';
import { RBAC_LOGGER } from '../rbac.providers';

import { RBACTestingLoggerModule, TestingRBACLogger } from './rbac-logger';

const accessGrantedEvent: AccessGrantedEvent = {
    matrix: 'article',
    user: 1,
    scope: { orgId: 5, dept: 3 },
    grantedPermissions: ['read', 'edit'],
    requiredPermissions: ['read', 'post'],
    mode: 'some',
};

const accessDeniedEvent: AccessDeniedEvent = {
    matrix: 'article',
    user: 0,
    scope: { orgId: 5, dept: 3 },
    grantedPermissions: [],
    requiredPermissions: ['post'],
    mode: 'every',
};

const scopeNotFoundEvent: ScopeNotFoundEvent = {
    matrix: 'article',
    user: 1,
    scope: { orgId: 5 },
};

const entityNotFoundEvent: EntityNotFoundEvent = {
    matrix: 'author',
    user: 1,
    entity: 9,
};

const matrixInitializedEvent: MatrixInitializedEvent = {
    matrix: 'article',
};

const matrixInstantiateFailedEvent: MatrixInstantiateFailedEvent = {
    matrix: 'article',
    type: 'ArticleRBAC',
    error: new Error('boom'),
};

const matrixInitFailedEvent: MatrixInitFailedEvent = {
    matrix: 'article',
    type: 'ArticleRBAC',
    error: new Error('boom'),
};

describe('RBAC / TestingRBACLogger', () => {
    describe('рекордер', () => {
        it('записывает каждое событие как { event, ...payload }', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);
            logger.accessDenied(accessDeniedEvent);
            logger.scopeNotFound(scopeNotFoundEvent);
            logger.entityNotFound(entityNotFoundEvent);
            logger.matrixInitialized(matrixInitializedEvent);
            logger.matrixInstantiateFailed(matrixInstantiateFailedEvent);
            logger.matrixInitFailed(matrixInitFailedEvent);

            expect(logger.any().logs).toEqual([
                { event: 'accessGranted', ...accessGrantedEvent },
                { event: 'accessDenied', ...accessDeniedEvent },
                { event: 'scopeNotFound', ...scopeNotFoundEvent },
                { event: 'entityNotFound', ...entityNotFoundEvent },
                { event: 'matrixInitialized', ...matrixInitializedEvent },
                { event: 'matrixInstantiateFailed', ...matrixInstantiateFailedEvent },
                { event: 'matrixInitFailed', ...matrixInitFailedEvent },
            ]);
        });

        it('clear() очищает записанные события', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);
            logger.matrixInitialized(matrixInitializedEvent);
            logger.clear();

            expect(logger.any().logs).toEqual([]);
            logger.any().toBeNotLogged();
        });

        it('подходит под интерфейс RBACLogger', () => {
            const testing = new TestingRBACLogger();
            const logger: RBACLogger = testing;

            logger.matrixInitialized(matrixInitializedEvent);

            testing.matrixInitialized().toBeLoggedOnce();
        });
    });

    describe('матчер', () => {
        it('вход по событию фильтрует только его тип', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);
            logger.accessDenied(accessDeniedEvent);

            logger.accessGranted().toBeLoggedOnce();
            logger.accessDenied().toBeLoggedOnce();
            logger.scopeNotFound().toBeNotLogged();
            logger.entityNotFound().toBeNotLogged();
            logger.matrixInitialized().toBeNotLogged();
            logger.matrixInstantiateFailed().toBeNotLogged();
            logger.matrixInitFailed().toBeNotLogged();
        });

        it('any() видит события всех типов', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);
            logger.matrixInitialized(matrixInitializedEvent);

            logger.any().toBeLoggedTimes(2);
            expect(
                logger
                    .any()
                    .logs.map((record) => record.event)
                    .toSorted(),
            ).toEqual(['accessGranted', 'matrixInitialized']);
        });

        it('withDetails: частичное совпадение по подмножеству полей payload', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);
            logger.accessGranted({
                matrix: 'author',
                user: 1,
                entity: 2,
                grantedPermissions: ['read'],
                requiredPermissions: ['read', 'post'],
                mode: 'some',
            });

            logger.accessGranted().withDetails({ matrix: 'article' }).toBeLoggedOnce();
            logger.accessGranted().withDetails({ user: 1, mode: 'some' }).toBeLoggedTimes(2);
            logger.accessGranted().withDetails({ entity: 2 }).toBeLoggedOnce();
            logger
                .accessGranted()
                .withDetails({ scope: { orgId: 5, dept: 3 } })
                .toBeLoggedOnce();
            logger
                .accessGranted()
                .withDetails({ scope: { orgId: 5 } })
                .toBeNotLogged();
            logger.accessGranted().withDetails({ matrix: 'nope' }).toBeNotLogged();
        });

        it('withDetails конкатенирует подмножества', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);

            logger
                .accessGranted()
                .withDetails({ matrix: 'article' })
                .withDetails({ user: 1 })
                .toBeLoggedOnce();
        });

        it('strict: точное совпадение payload без лишних ключей', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);

            logger
                .accessGranted()
                .withDetails({ ...accessGrantedEvent })
                .strict()
                .toBeLoggedOnce();

            // отсутствует ключ
            logger
                .accessGranted()
                .withDetails({ matrix: 'article', user: 1 })
                .strict()
                .toBeNotLogged();

            // значение отличается
            logger
                .accessGranted()
                .withDetails({ ...accessGrantedEvent, user: 99 })
                .strict()
                .toBeNotLogged();

            // лишний ключ
            logger
                .accessGranted()
                .withDetails({ ...accessGrantedEvent, extra: true })
                .strict()
                .toBeNotLogged();
        });

        it('количества: toBeLogged / toBeNotLogged / toBeLoggedOnce / toBeLoggedTimes', () => {
            const logger = new TestingRBACLogger();

            logger.accessDenied(accessDeniedEvent);
            logger.accessDenied({ ...accessDeniedEvent, scope: { orgId: 7 } });
            logger.accessGranted(accessGrantedEvent);

            logger.accessDenied().toBeLoggedTimes(2);
            logger
                .accessDenied()
                .withDetails({ scope: { orgId: 7 } })
                .toBeLoggedOnce();
            logger.accessGranted().toBeLogged();
            logger.matrixInitialized().toBeNotLogged();

            expect(() => logger.accessDenied().toBeLoggedOnce()).toThrowError(/Expected 1 event/);
            expect(() => logger.accessGranted().toBeLoggedTimes(2)).toThrowError(/but 1 matched/);
            expect(() => logger.accessDenied().toBeNotLogged()).toThrowError(/Expected no events/);
        });

        it('fail-мессадж показывает ожидаемое и записанное', () => {
            const logger = new TestingRBACLogger();

            logger.accessGranted(accessGrantedEvent);

            const matcher = logger.accessGranted().withDetails({ matrix: 'other' });

            expect(() => matcher.toBeLogged()).toThrowError(
                /Expected at least 1 event of type "accessGranted" matching details \{"matrix":"other"\}/,
            );
            expect(() => matcher.toBeLogged()).toThrowError(/accessGranted \{.*"matrix":"article"/);
        });

        it('пустой рекордер: «no events were recorded»', () => {
            const logger = new TestingRBACLogger();

            expect(() => logger.accessGranted().toBeLogged()).toThrowError(
                /no events were recorded/,
            );
            expect(() => logger.any().toBeLoggedTimes(1)).toThrowError(/no events were recorded/);
        });
    });

    describe('RBACTestingLoggerModule', () => {
        it('forTesting: global-модуль с провайдерами и экспортами', () => {
            const dynamic = RBACTestingLoggerModule.forTesting();

            expect(dynamic.global).toBe(true);
            expect(dynamic.module).toBe(RBACTestingLoggerModule);
            expect(dynamic.providers).toEqual([
                TestingRBACLogger,
                { provide: RBAC_LOGGER, useExisting: TestingRBACLogger },
            ]);
            expect(dynamic.exports).toEqual([RBAC_LOGGER, TestingRBACLogger]);
        });
    });
});
