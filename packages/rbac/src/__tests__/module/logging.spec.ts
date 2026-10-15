import { DynamicModule, Module, ModuleMetadata, Logger as NestLogger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DefaultRBACLogger, PermissionsResolver, RBACMatrix, RbacModule, RbacService } from '../..';
import { RBAC_LOGGER } from '../../rbac.providers';
import type { BaseResolver } from '../../rbac.providers';
import { RbacServiceCore } from '../../rbac.service';
import { RBACTestingLoggerModule, TestingRBACLogger } from '../../test-utils/rbac-logger';

import { ArticleRBAC } from './data/article.rbac';
import { ArticlesModule } from './data/articles.module';
import { BaseModule, BaseResolverMock } from './data/base.module';
import { OrgRBAC } from './data/org.rbac';
import { OrgsModule } from './data/orgs.module';

/**
 * Модуль с провайдером `RBAC_LOGGER`, недоступный скоупу `RbacModule`
 * (не `global`) — пиннинг семантики видимости скоупов Nest.
 */
@Module({})
class NonGlobalLoggerModule {
    static withLogger(logger: TestingRBACLogger): DynamicModule {
        return {
            module: NonGlobalLoggerModule,
            providers: [{ provide: RBAC_LOGGER, useValue: logger }],
            exports: [RBAC_LOGGER],
        };
    }
}

interface BrokenEntity {
    id: number;
    __permissions?: string[];
}

/**
 * Матрица, чей создатель прав падает — путь `matrixInitFailed`
 * (инстанцирование резолвера проходит, а построение координатора — нет).
 */
@RBACMatrix(
    {
        name: 'broken',
        getId: (entity: BrokenEntity) => entity.id,
    },
    () => {
        throw new Error('matrix boom');
    },
)
class BrokenRBAC implements PermissionsResolver<number, BrokenEntity> {
    async getEntities(): Promise<BrokenEntity[]> {
        return [];
    }
}

describe('RBAC module / logging', () => {
    let module: TestingModule | undefined;

    async function createModule(metadata: ModuleMetadata): Promise<TestingModule> {
        module = await Test.createTestingModule(metadata).compile();

        await module.get(RbacServiceCore).initMatrices(module);

        return module;
    }

    afterEach(async () => {
        vi.restoreAllMocks();

        await module?.close();
        module = undefined;
    });

    describe('forRoot без logger', () => {
        it('использует DefaultRBACLogger: матричные события видны в стандартном логгере', async () => {
            const logSpy = vi.spyOn(NestLogger.prototype, 'log');
            const tokenLogger = new TestingRBACLogger();

            await createModule({
                imports: [
                    ArticlesModule,
                    OrgsModule,
                    BaseModule,
                    RbacModule.forRoot({ baseResolver: BaseResolverMock }),
                    NonGlobalLoggerModule.withLogger(tokenLogger),
                ],
            });

            expect(logSpy).toHaveBeenCalledWith('Matrix "article" initialized', {
                matrix: 'article',
            });
            expect(logSpy).toHaveBeenCalledWith('Matrix "org" initialized', { matrix: 'org' });

            expect(module?.get(RbacServiceCore).logger).toBeInstanceOf(DefaultRBACLogger);
            expect(tokenLogger.matrixInitialized().logs).toHaveLength(0);
        });
    });

    describe('forRoot с logger', () => {
        it('кастомный логгер получает matrixInitialized при инициализации матриц', async () => {
            const custom = new TestingRBACLogger();

            await createModule({
                imports: [
                    ArticlesModule,
                    OrgsModule,
                    BaseModule,
                    RbacModule.forRoot({ baseResolver: BaseResolverMock, logger: custom }),
                ],
            });

            custom.matrixInitialized().withDetails({ matrix: 'article' }).toBeLoggedOnce();
            custom.matrixInitialized().withDetails({ matrix: 'org' }).toBeLoggedOnce();
            custom.matrixInitialized().toBeLoggedTimes(2);
            expect(module?.get(RbacServiceCore).logger).toBe(custom);
        });
    });

    describe('RBAC_LOGGER из global-модуля', () => {
        it('без опции forRoot события приходят в логгер из global-модуля', async () => {
            await createModule({
                imports: [
                    ArticlesModule,
                    OrgsModule,
                    BaseModule,
                    RbacModule.forRoot({ baseResolver: BaseResolverMock }),
                    RBACTestingLoggerModule.forTesting(),
                ],
            });

            expect(module?.get(RbacServiceCore).logger).toBe(module?.get(TestingRBACLogger));
            module?.get(TestingRBACLogger).matrixInitialized().toBeLoggedTimes(2);
        });

        it('при наличии и опции forRoot, и global-токена побеждает опция forRoot', async () => {
            const optionLogger = new TestingRBACLogger();

            await createModule({
                imports: [
                    ArticlesModule,
                    OrgsModule,
                    BaseModule,
                    RbacModule.forRoot({ baseResolver: BaseResolverMock, logger: optionLogger }),
                    RBACTestingLoggerModule.forTesting(),
                ],
            });

            optionLogger.matrixInitialized().toBeLoggedTimes(2);
            expect(module?.get(RbacServiceCore).logger).toBe(optionLogger);
            module?.get(TestingRBACLogger).matrixInitialized().toBeNotLogged();
        });
    });

    describe('RBAC_LOGGER из не-global модуля', () => {
        it('не доходит до RbacService: используется fallback DefaultRBACLogger', async () => {
            const logSpy = vi.spyOn(NestLogger.prototype, 'log');
            const tokenLogger = new TestingRBACLogger();

            await createModule({
                imports: [
                    ArticlesModule,
                    OrgsModule,
                    BaseModule,
                    RbacModule.forRoot({ baseResolver: BaseResolverMock }),
                    NonGlobalLoggerModule.withLogger(tokenLogger),
                ],
            });

            expect(module?.get(RbacServiceCore).logger).toBeInstanceOf(DefaultRBACLogger);
            expect(tokenLogger.matrixInitialized().logs).toHaveLength(0);
            expect(logSpy).toHaveBeenCalledWith('Matrix "article" initialized', {
                matrix: 'article',
            });
        });
    });

    describe('приоритет forRoot над feature-инстансом', () => {
        it('feature-инстанс, созданный после forRoot, не затирает опцию в общем ядре', () => {
            const core = new RbacServiceCore();
            const optionLogger = new TestingRBACLogger();
            const globalLogger = new TestingRBACLogger();

            // root-инстанс (forRoot с опцией) — первым, feature-инстанс (RBAC_LOGGER
            // из global-модуля, без baseResolver) — вторым: порядок конструирования
            // не должен влиять на итоговый логгер общего ядра
            new RbacService(optionLogger, core, new BaseResolverMock(), []);
            new RbacService(globalLogger, core, undefined as unknown as BaseResolver, []);

            expect(core.logger).toBe(optionLogger);
        });

        it('forRoot({ logger }) первым + forFeature: опция обслуживает холодный и горячий путь', async () => {
            const optionLogger = new TestingRBACLogger();

            const testModule = await Test.createTestingModule({
                imports: [
                    RbacModule.forRoot({ baseResolver: BaseResolverMock, logger: optionLogger }),
                    RbacModule.forFeature([ArticleRBAC, OrgRBAC]),
                    BaseModule,
                    RBACTestingLoggerModule.forTesting(),
                ],
                providers: [ArticleRBAC, OrgRBAC],
            }).compile();
            module = testModule;

            await testModule.get(RbacServiceCore).initMatrices(testModule);

            // холодный путь идёт через общее ядро
            optionLogger.matrixInitialized().withDetails({ matrix: 'article' }).toBeLoggedOnce();
            expect(testModule.get(RbacServiceCore).logger).toBe(optionLogger);
            testModule.get(TestingRBACLogger).any().toBeNotLogged();

            // горячий путь обслуживает feature-инстанс (у него есть availableMatrices),
            // но логгер берётся из общего ядра — то есть опция forRoot
            const featureService = testModule
                .get<RbacService, RbacService>(RbacService, { each: true })
                .find((service) => Boolean(service.availableMatrices));

            if (!featureService) {
                throw new Error('Feature RbacService (with availableMatrices) not found');
            }

            const manager = await featureService.createManager({
                loggedIn: true,
                scope: { profileId: 1 },
            });
            const entityAgent = manager.getEntityAgent(ArticleRBAC);

            await entityAgent.prepare(1);
            entityAgent.log.accessGranted('read', 1);

            optionLogger
                .accessGranted()
                .withDetails({
                    matrix: 'article',
                    entity: 1,
                    user: 1,
                    requiredPermissions: ['read'],
                })
                .toBeLoggedOnce();
            testModule.get(TestingRBACLogger).accessGranted().toBeNotLogged();
        });
    });

    describe('горячий путь', () => {
        it('события доступа доходят до кастомного логгера через RbacService.createManager', async () => {
            const testModule = await Test.createTestingModule({
                imports: [
                    RbacModule.forTesting([ArticleRBAC, OrgRBAC]),
                    BaseModule,
                    RBACTestingLoggerModule.forTesting(),
                ],
                providers: [ArticleRBAC, OrgRBAC],
            }).compile();
            module = testModule;

            await testModule.get(RbacServiceCore).initMatrices(testModule);

            const logger = testModule.get(TestingRBACLogger);
            const service = testModule.get(RbacService);
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 1 },
            });
            const entityAgent = manager.getEntityAgent(ArticleRBAC);

            await entityAgent.prepare(1);
            entityAgent.log.accessGranted('read', 1);
            await entityAgent.prepare(2);
            entityAgent.log.accessDenied('write', 2);

            logger
                .accessGranted()
                .withDetails({
                    matrix: 'article',
                    entity: 1,
                    user: 1,
                    requiredPermissions: ['read'],
                })
                .toBeLoggedOnce();
            logger
                .accessDenied()
                .withDetails({
                    matrix: 'article',
                    entity: 2,
                    user: 1,
                    requiredPermissions: ['write'],
                })
                .toBeLoggedOnce();
        });
    });

    describe('ошибки инициализации матриц', () => {
        it('matrixInstantiateFailed: неразрешимый резолвер выбрасывает и логирует событие', async () => {
            const testModule = await Test.createTestingModule({
                imports: [
                    RbacModule.forTesting([ArticleRBAC]),
                    RBACTestingLoggerModule.forTesting(),
                ],
            }).compile();
            module = testModule;

            const logger = testModule.get(TestingRBACLogger);

            await expect(
                testModule.get(RbacServiceCore).initMatrices(testModule),
            ).rejects.toThrow();

            logger
                .matrixInstantiateFailed()
                .withDetails({ matrix: 'article', type: 'ArticleRBAC' })
                .toBeLoggedOnce();
            expect(logger.matrixInitialized().logs).toHaveLength(0);
        });

        it('matrixInitFailed: падение создателя матрицы выбрасывает и логирует событие', async () => {
            const testModule = await Test.createTestingModule({
                imports: [
                    RbacModule.forTesting([BrokenRBAC]),
                    RBACTestingLoggerModule.forTesting(),
                ],
                providers: [BrokenRBAC],
            }).compile();
            module = testModule;

            const logger = testModule.get(TestingRBACLogger);

            await expect(testModule.get(RbacServiceCore).initMatrices(testModule)).rejects.toThrow(
                'matrix boom',
            );

            logger
                .matrixInitFailed()
                .withDetails({ matrix: 'broken', type: 'BrokenRBAC' })
                .toBeLoggedOnce();
        });
    });
});
