import { DynamicModule, Module, Logger as NestLogger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DefaultRBACLogger, RbacModule, RbacService } from '../..';
import { RBAC_LOGGER } from '../../rbac.providers';
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

async function createModule(imports: DynamicModule[]): Promise<TestingModule> {
    const module = await Test.createTestingModule({ imports }).compile();

    await module.get<RbacModule>(RbacModule).init(module);

    return module;
}

describe('RBAC module / logging', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('forRoot без logger', () => {
        it('использует DefaultRBACLogger: матричные события видны в стандартном логгере', async () => {
            const logSpy = vi.spyOn(NestLogger.prototype, 'log');
            const tokenLogger = new TestingRBACLogger();

            const module = await createModule([
                ArticlesModule,
                OrgsModule,
                BaseModule,
                RbacModule.forRoot({ baseResolver: BaseResolverMock }),
                NonGlobalLoggerModule.withLogger(tokenLogger),
            ]);

            expect(logSpy).toHaveBeenCalledWith('Matrix "article" initialized', {
                matrix: 'article',
            });
            expect(logSpy).toHaveBeenCalledWith('Matrix "org" initialized', { matrix: 'org' });

            expect(module.get(RbacService).logger).toBeInstanceOf(DefaultRBACLogger);
            expect(tokenLogger.matrixInitialized().logs).toHaveLength(0);
        });
    });

    describe('forRoot с logger', () => {
        it('кастомный логгер получает matrixInitialized при инициализации матриц', async () => {
            const custom = new TestingRBACLogger();

            await createModule([
                ArticlesModule,
                OrgsModule,
                BaseModule,
                RbacModule.forRoot({ baseResolver: BaseResolverMock, logger: custom }),
            ]);

            custom.matrixInitialized().withDetails({ matrix: 'article' }).toBeLoggedOnce();
            custom.matrixInitialized().withDetails({ matrix: 'org' }).toBeLoggedOnce();
            custom.matrixInitialized().toBeLoggedTimes(2);
        });
    });

    describe('RBAC_LOGGER из global-модуля', () => {
        it('без опции forRoot события приходят в логгер из global-модуля', async () => {
            const module = await createModule([
                ArticlesModule,
                OrgsModule,
                BaseModule,
                RbacModule.forRoot({ baseResolver: BaseResolverMock }),
                RBACTestingLoggerModule.forTesting(),
            ]);

            module.get(TestingRBACLogger).matrixInitialized().toBeLoggedTimes(2);
        });

        it('при наличии и опции forRoot, и global-токена побеждает опция forRoot', async () => {
            const optionLogger = new TestingRBACLogger();

            const module = await createModule([
                ArticlesModule,
                OrgsModule,
                BaseModule,
                RbacModule.forRoot({ baseResolver: BaseResolverMock, logger: optionLogger }),
                RBACTestingLoggerModule.forTesting(),
            ]);

            optionLogger.matrixInitialized().toBeLoggedTimes(2);
            module.get(TestingRBACLogger).matrixInitialized().toBeNotLogged();
        });
    });

    describe('RBAC_LOGGER из не-global модуля', () => {
        it('не доходит до RbacService: используется fallback DefaultRBACLogger', async () => {
            const logSpy = vi.spyOn(NestLogger.prototype, 'log');
            const tokenLogger = new TestingRBACLogger();

            const module = await createModule([
                ArticlesModule,
                OrgsModule,
                BaseModule,
                RbacModule.forRoot({ baseResolver: BaseResolverMock }),
                NonGlobalLoggerModule.withLogger(tokenLogger),
            ]);

            expect(module.get(RbacService).logger).toBeInstanceOf(DefaultRBACLogger);
            expect(tokenLogger.matrixInitialized().logs).toHaveLength(0);
            expect(logSpy).toHaveBeenCalledWith('Matrix "article" initialized', {
                matrix: 'article',
            });
        });
    });

    describe('горячий путь', () => {
        it('события доступа доходят до кастомного логгера через RbacService.createManager', async () => {
            const module = await Test.createTestingModule({
                imports: [
                    RbacModule.forTesting([ArticleRBAC, OrgRBAC]),
                    BaseModule,
                    RBACTestingLoggerModule.forTesting(),
                ],
                providers: [ArticleRBAC, OrgRBAC],
            }).compile();

            await module.get<RbacModule>(RbacModule).init(module);

            const logger = module.get(TestingRBACLogger);
            const service = module.get<RbacService>(RbacService);
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
});
