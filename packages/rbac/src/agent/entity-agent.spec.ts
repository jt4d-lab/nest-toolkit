import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EntityWithPermission } from '@src/common/rbac';
import { LocalLoggerModule } from '@src/server/logger';
import { TestingLogger, TestingLoggerMatcher } from '@src/server/logger/testing';

import {
    PermissionsResolver,
    RBACEntityAgent,
    RBACMatrix,
    RbacModule,
    RbacService,
    Roles,
} from '..';

interface Article extends EntityWithPermission<'read' | 'edit' | 'delete'> {
    id: number;
}

describe('RBAC / EntityAgent', () => {
    let module: TestingModule;
    let logger: TestingLoggerMatcher;
    let service: RbacService;
    let entityAgent: RBACEntityAgent<number, Article>;

    @RBACMatrix(
        {
            name: 'article',
            getId: (entity: Article) => entity.id,
        },
        ({ eq }) => ({
            read: [Roles.any],
            edit: [eq('id', 1)],
            delete: [],
        }),
    )
    class ArticleRBAC implements PermissionsResolver<number, Article> {
        async getEntities(ids: number[]): Promise<Article[]> {
            return ids
                .map((id) => {
                    if (id === 1 || id === 2) {
                        return { id };
                    }

                    return null;
                })
                .filter(Boolean) as Article[];
        }
    }

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [RbacModule.forTesting([ArticleRBAC]), LocalLoggerModule.forTesting()],
            providers: [ArticleRBAC],
        }).compile();

        await module.get<RbacModule>(RbacModule).init(module);

        service = module.get<RbacService>(RbacService);
        logger = module.get(TestingLogger).withContext('RBAC').strictDetails();

        const manager = await service.createManager({
            loggedIn: true,
            scope: { profileId: 101 },
        });

        entityAgent = manager.getEntityAgent(ArticleRBAC);
    });

    describe('insertPermission', () => {
        it('должен выкинуть ошибку 404 если передано undefined', async () => {
            await expect(entityAgent.insertPermissions(undefined)).rejects.toEqual(
                new NotFoundException(),
            );
        });
        it('должен выкинуть ошибку 404 если передано null', async () => {
            await expect(entityAgent.insertPermissions(null)).rejects.toEqual(
                new NotFoundException(),
            );
        });
        it('должен выкинуть ошибку 404 если entity передан, но rbac его не нашел', async () => {
            await expect(entityAgent.insertPermissions({ id: 404 })).rejects.toEqual(
                new NotFoundException(),
            );
        });
    });
    describe('прямые методы логирования доступа', () => {
        describe('Access granted', () => {
            it('должен залогировать доступ при одном разрешении', async () => {
                // Act
                await entityAgent.prepare(1);
                entityAgent.log.accessGranted('read', 1);
                entityAgent.sync.log.accessGranted('read', 1);

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать доступ при нескольких разрешениях (every)', async () => {
                // Act
                await entityAgent.prepare(1);
                entityAgent.log.accessGranted(['read', 'edit'], 1, 'every');
                entityAgent.sync.log.accessGranted(['read', 'edit'], 1, 'every');

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read, edit',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать доступ при нескольких разрешениях (some)', async () => {
                // Act
                await entityAgent.prepare(1);
                entityAgent.log.accessGranted(['read', 'edit'], 1, 'some');
                entityAgent.sync.log.accessGranted(['read', 'edit'], 1, 'some');

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read, edit',
                        mode: 'some',
                    })
                    .toBeLoggedTimes(2);
            });
        });
        describe('Access denied', () => {
            it('должен залогировать отказ в доступе при одном разрешении', async () => {
                // Act
                await entityAgent.prepare(2);
                entityAgent.log.accessDenied('edit', 2);
                entityAgent.sync.log.accessDenied('edit', 2);

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 2,
                        user: 101,
                        grantedPermissions: 'read',
                        requiredPermissions: 'edit',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать отказ в доступе при нескольких разрешениях (every)', async () => {
                // Act
                await entityAgent.prepare(2);
                entityAgent.log.accessDenied(['read', 'edit'], 2, 'every');
                entityAgent.sync.log.accessDenied(['read', 'edit'], 2, 'every');

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 2,
                        user: 101,
                        grantedPermissions: 'read',
                        requiredPermissions: 'read, edit',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать отказ в доступе при нескольких разрешениях (some)', async () => {
                // Act
                await entityAgent.prepare(2);
                entityAgent.log.accessDenied(['read', 'edit'], 2, 'some');
                entityAgent.sync.log.accessDenied(['read', 'edit'], 2, 'some');

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 2,
                        user: 101,
                        grantedPermissions: 'read',
                        requiredPermissions: 'read, edit',
                        mode: 'some',
                    })
                    .toBeLoggedTimes(2);
            });
        });
        describe('Entity not found', () => {
            it('должен залогировать отсутствие сущности', async () => {
                // Act
                entityAgent.log.notFound(404);
                entityAgent.sync.log.notFound(404);

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Entity not found')
                    .withDetails({
                        matrix: 'article',
                        entity: 404,
                        user: 101,
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать отсутствие сущности при передаче undefined', async () => {
                // Act
                entityAgent.log.notFound(undefined as unknown as Article);
                entityAgent.sync.log.notFound(undefined as unknown as Article);

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Entity not found')
                    .withDetails({
                        matrix: 'article',
                        user: 101,
                    })
                    .toBeLoggedTimes(2);
            });
        });
    });
    describe('check* методы', () => {
        describe('check', () => {
            it('не выбрасывает ошибку, если есть разрешение', async () => {
                await expect(entityAgent.check('read', { id: 1 })).resolves.toBeUndefined();

                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read',
                        mode: 'every',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает ошибку с нужным код, если нет разрешения, но сущность есть', async () => {
                await expect(entityAgent.check('edit', { id: 2 }, 403)).rejects.toMatchObject({
                    status: 403,
                });

                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 2,
                        user: 101,
                        grantedPermissions: 'read',
                        requiredPermissions: 'edit',
                        mode: 'every',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает 404, если сущность не найдена', async () => {
                await expect(entityAgent.check('read', { id: 404 })).rejects.toMatchObject({
                    status: 404,
                });

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Entity not found')
                    .withDetails({
                        matrix: 'article',
                        entity: 404,
                        user: 101,
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает ошибку с кастомным сообщением', async () => {
                await expect(
                    entityAgent.check('edit', { id: 2 }, 403, 'Нет доступа'),
                ).rejects.toMatchObject({
                    message: 'Нет доступа',
                });

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 2,
                        user: 101,
                        grantedPermissions: 'read',
                        requiredPermissions: 'edit',
                        mode: 'every',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает 404, если передан undefined', async () => {
                await expect(
                    entityAgent.check('read', undefined as unknown as Article),
                ).rejects.toMatchObject({
                    status: 404,
                });

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Entity not found')
                    .withDetails({
                        matrix: 'article',
                        user: 101,
                    })
                    .toBeLoggedOnce();
            });
        });

        describe('checkSome', () => {
            it('не выбрасывает ошибку, если есть хотя бы одно разрешение', async () => {
                await expect(
                    entityAgent.checkSome(['read', 'edit'], { id: 1 }),
                ).resolves.toBeUndefined();

                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read, edit',
                        mode: 'some',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает ошибку, если нет ни одного разрешения, но сущность есть', async () => {
                await expect(
                    entityAgent.checkSome(['edit', 'delete'], { id: 2 }, 403),
                ).rejects.toMatchObject({
                    status: 403,
                });

                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 2,
                        user: 101,
                        grantedPermissions: 'read',
                        requiredPermissions: 'edit, delete',
                        mode: 'some',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает 404, если сущность не найдена', async () => {
                await expect(entityAgent.checkSome(['read'], { id: 404 })).rejects.toMatchObject({
                    status: 404,
                });

                logger
                    .withLevel('warn')
                    .withMessage('Entity not found')
                    .withDetails({
                        matrix: 'article',
                        entity: 404,
                        user: 101,
                    })
                    .toBeLoggedOnce();
            });
        });

        describe('checkEvery', () => {
            it('не выбрасывает ошибку, если есть все разрешения', async () => {
                await expect(entityAgent.checkEvery(['read'], { id: 1 })).resolves.toBeUndefined();

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read',
                        mode: 'every',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает ошибку, если нет хотя бы одного разрешения, но сущность есть', async () => {
                await expect(
                    entityAgent.checkEvery(['read', 'delete'], { id: 1 }, 403),
                ).rejects.toMatchObject({
                    status: 403,
                });

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        entity: 1,
                        user: 101,
                        grantedPermissions: 'read, edit',
                        requiredPermissions: 'read, delete',
                        mode: 'every',
                    })
                    .toBeLoggedOnce();
            });

            it('выбрасывает 404, если сущность не найдена', async () => {
                await expect(entityAgent.checkEvery(['read'], { id: 404 })).rejects.toMatchObject({
                    status: 404,
                });

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Entity not found')
                    .withDetails({
                        matrix: 'article',
                        entity: 404,
                        user: 101,
                    })
                    .toBeLoggedOnce();
            });
        });
    });
});
