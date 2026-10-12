import { Test, TestingModule } from '@nestjs/testing';

import { RbacModule, RbacService } from '../..';
import { LocalLoggerModule } from '../../test-utils/logger';

import { ArticleRBAC } from './data/article.rbac';
import { BaseModule } from './data/base.module';
import { OrgRBAC } from './data/org.rbac';

describe('RBAC module / request-level cache ', () => {
    let module: TestingModule;
    let service: RbacService;
    let articleRBAC: ArticleRBAC;
    let orgRBAC: OrgRBAC;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [
                RbacModule.forTesting([ArticleRBAC, OrgRBAC]),
                LocalLoggerModule.forTesting(),
                BaseModule,
            ],
            providers: [ArticleRBAC, OrgRBAC],
        }).compile();

        await module.get<RbacModule>(RbacModule).init(module);

        service = module.get<RbacService>(RbacService);
        articleRBAC = module.get<ArticleRBAC>(ArticleRBAC);
        orgRBAC = module.get<OrgRBAC>(OrgRBAC);
    });

    describe('EntityAgent', () => {
        it('при повторном запросе разрешений, повторных запросов к БД не происходит', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 1 },
            });
            const rbac = manager.getEntityAgent(ArticleRBAC);

            await rbac.getPermissions(1);

            expect(articleRBAC.log).toEqual(['getEntities 1']);
            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
            articleRBAC.log.length = 0;
            orgRBAC.log.length = 0;

            // act
            await rbac.getPermissions(1);

            // assert
            expect(articleRBAC.log).toEqual([]);
            expect(orgRBAC.log).toEqual([]);
        });
        it('при запросе разрешений для списка к БД запросы идут только за ранее неизвестными сущностями', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 2 },
            });
            const rbac = manager.getEntityAgent(ArticleRBAC);

            await rbac.getPermissions(1);

            expect(articleRBAC.log).toEqual(['getEntities 1']);
            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
            articleRBAC.log.length = 0;
            orgRBAC.log.length = 0;

            // act
            await rbac.prepare([1, 3]);
            rbac.sync.getPermissions(1);
            rbac.sync.getPermissions(3);

            // assert
            expect(articleRBAC.log).toEqual(['getEntities 3']);
            // нет новых запросов по связанным сущностям, т.к. новых связанных сущностей не было
            expect(orgRBAC.log).toEqual([]);
        });
        it('после сброса кеша, происходит лишь один повторный запрос к БД на сущность', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 2 },
            });
            const rbac = manager.getEntityAgent(ArticleRBAC);
            const orgRbacAgent = manager.getEntityAgent(OrgRBAC);

            await rbac.getPermissions(1);

            expect(articleRBAC.log).toEqual(['getEntities 1']);
            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
            articleRBAC.log.length = 0;
            orgRBAC.log.length = 0;

            // act
            orgRbacAgent.invalidate(1);

            await rbac.prepare([1, 3]);
            rbac.sync.getPermissions(1);
            rbac.sync.getPermissions(3);

            // assert
            expect(articleRBAC.log).toEqual(['getEntities 1,3']);
            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
        });
    });
    describe('ListAgent', () => {
        it('при запросе разрешений без scope никаких запросов к БД не происходит', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 1 },
            });
            const rbac = manager.getListAgent(ArticleRBAC);

            await rbac.getPermissions();

            expect(orgRBAC.log).toEqual([]);
            orgRBAC.log.length = 0;

            // act
            await rbac.getPermissions();

            // assert
            expect(orgRBAC.log).toEqual([]);
        });
        it('при повторном запросе разрешений со scope, повторных запросов к БД не происходит', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 1 },
            });
            const rbac = manager.getListAgent(ArticleRBAC);

            await rbac.getPermissions({ org: 1 });

            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
            orgRBAC.log.length = 0;

            // act
            await rbac.getPermissions({ org: 1 });

            // assert
            expect(orgRBAC.log).toEqual([]);
        });
        it('при запросе разрешений со scope для списка к БД запросы идут только за ранее неизвестными сущностями', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 2 },
            });
            const rbac = manager.getListAgent(ArticleRBAC);

            await rbac.getPermissions({ org: 1 });

            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
            orgRBAC.log.length = 0;

            // act
            await rbac.prepare({ org: 1 });
            await rbac.prepare({ org: 2 });

            // assert
            expect(orgRBAC.log).toEqual(['getEntities 2', 'updateRoles 2']);
        });
        it('после сброса кеша, происходит лишь один повторный запрос к БД на сущность', async () => {
            // arrange
            const manager = await service.createManager({
                loggedIn: true,
                scope: { profileId: 2 },
            });
            const rbac = manager.getListAgent(ArticleRBAC);
            const orgRbacAgent = manager.getEntityAgent(OrgRBAC);

            await rbac.getPermissions({ org: 1 });

            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
            orgRBAC.log.length = 0;

            // act
            orgRbacAgent.invalidate(1);

            await rbac.prepare({ org: 1 });

            // assert
            expect(orgRBAC.log).toEqual(['getEntities 1', 'updateRoles 1']);
        });
    });
});
