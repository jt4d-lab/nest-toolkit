import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EntityWithPermission } from '@src/common/rbac';
import { LocalLoggerModule } from '@src/server/logger';
import { TestingLogger, TestingLoggerMatcher } from '@src/server/logger/testing';

import { PermissionsResolver, RBACListAgent, RBACMatrix, RbacModule, RbacService, Roles } from '..';

import { ScopeRel } from './types';

interface Author extends EntityWithPermission<'read' | 'post'> {
    id: number;
}

interface Article extends EntityWithPermission<'read' | 'edit' | 'post' | 'delete'> {
    id: number;
    authorId?: number;
}

describe('RBAC / ListAgent', () => {
    let module: TestingModule;
    let service: RbacService;
    let logger: TestingLoggerMatcher;
    let listAgent: RBACListAgent<number, Article, { author: number }>;

    @RBACMatrix(
        {
            name: 'author',
            getId: (entity: Author) => entity.id,
        },
        ({ eq }) => ({
            read: [Roles.any],
            post: [eq('id', 1)],
        }),
    )
    class AuthorRBAC implements PermissionsResolver<number, Author> {
        async getEntities(ids: number[]): Promise<Author[]> {
            return ids
                .map((id) => {
                    if (id === 1 || id === 2) {
                        return { id };
                    }

                    return null;
                })
                .filter(Boolean) as Author[];
        }
    }

    @RBACMatrix(
        {
            name: 'article',
            getId: (entity: Article) => entity.id,
            relations: {
                author: AuthorRBAC,
            },
        },
        ({ eq }, { author }) => ({
            read: [Roles.any],
            edit: [eq('id', 1)],
            post: [author.post],
            delete: [],
        }),
    )
    class ArticleRBAC implements PermissionsResolver<number, Article> {
        async getEntities(ids: number[]): Promise<Article[]> {
            return ids
                .map((id) => {
                    if (id === 1) {
                        return { id, authorId: 2 };
                    }

                    if (id === 2) {
                        return { id, authorId: 1 };
                    }

                    return null;
                })
                .filter(Boolean) as Article[];
        }

        getReferences(entity: Article) {
            return {
                author: entity.authorId,
            };
        }
    }

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [
                RbacModule.forTesting([ArticleRBAC, AuthorRBAC]),
                LocalLoggerModule.forTesting(),
            ],
            providers: [ArticleRBAC, AuthorRBAC],
        }).compile();

        await module.get<RbacModule>(RbacModule).init(module);

        service = module.get<RbacService>(RbacService);
        logger = module.get(TestingLogger).withContext('RBAC').strictDetails();

        const manager = await service.createManager({
            loggedIn: true,
            scope: { profileId: 1 },
        });

        listAgent = manager.getListAgent(ArticleRBAC);
    });
    describe('прямые методы логирования доступа', () => {
        describe('Access granted', () => {
            it('должен залогировать доступ при одном разрешении', async () => {
                // Act
                await listAgent.prepare({ author: 1 });
                listAgent.log.accessGranted('read', { author: 1 });
                listAgent.sync.log.accessGranted('read', { author: 1 });

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 1',
                        user: 1,
                        grantedPermissions: 'read, post',
                        requiredPermissions: 'read',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать доступ при нескольких разрешениях (every)', async () => {
                // Act
                await listAgent.prepare({ author: 1 });
                listAgent.log.accessGranted(['read', 'post'], { author: 1 }, 'every');
                listAgent.sync.log.accessGranted(['read', 'post'], { author: 1 }, 'every');

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 1',
                        user: 1,
                        grantedPermissions: 'read, post',
                        requiredPermissions: 'read, post',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать доступ при нескольких разрешениях (some)', async () => {
                // Act
                await listAgent.prepare({ author: 1 });
                listAgent.log.accessGranted(['read', 'edit'], { author: 1 }, 'some');
                listAgent.sync.log.accessGranted(['read', 'edit'], { author: 1 }, 'some');

                // Assert
                logger
                    .withLevel('debug')
                    .withMessage('Access granted')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 1',
                        user: 1,
                        grantedPermissions: 'read, post',
                        requiredPermissions: 'read, edit',
                        mode: 'some',
                    })
                    .toBeLoggedTimes(2);
            });
        });
        describe('Access denied', () => {
            it('должен залогировать отказ в доступе при одном разрешении', async () => {
                // Act
                await listAgent.prepare({ author: 2 });
                listAgent.log.accessDenied('post', { author: 2 });
                listAgent.sync.log.accessDenied('post', { author: 2 });

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 2',
                        user: 1,
                        grantedPermissions: 'read',
                        requiredPermissions: 'post',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать отказ в доступе при нескольких разрешениях (every)', async () => {
                // Act
                await listAgent.prepare({ author: 2 });
                listAgent.log.accessDenied(['read', 'edit'], { author: 2 }, 'every');
                listAgent.sync.log.accessDenied(['read', 'edit'], { author: 2 }, 'every');

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 2',
                        user: 1,
                        grantedPermissions: 'read',
                        requiredPermissions: 'read, edit',
                        mode: 'every',
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать отказ в доступе при нескольких разрешениях (some)', async () => {
                // Act
                await listAgent.prepare({ author: 2 });
                listAgent.log.accessDenied(['read', 'edit'], { author: 2 }, 'some');
                listAgent.sync.log.accessDenied(['read', 'edit'], { author: 2 }, 'some');

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Access denied')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 2',
                        user: 1,
                        grantedPermissions: 'read',
                        requiredPermissions: 'read, edit',
                        mode: 'some',
                    })
                    .toBeLoggedTimes(2);
            });
        });
        describe('Scope not found', () => {
            it('должен залогировать отсутствие scope', () => {
                // Act
                listAgent.log.notFound({
                    author: 404,
                    another: '3541d4b8-59e7-42b1-9552-f801dd27bcbb',
                } as ScopeRel<{ author: number }>);
                listAgent.sync.log.notFound({
                    author: 404,
                    another: '3541d4b8-59e7-42b1-9552-f801dd27bcbb',
                } as ScopeRel<{ author: number }>);

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Scope not found')
                    .withDetails({
                        matrix: 'article',
                        scope: 'author: 404, another: 3541d4b8-59e7-42b1-9552-f801dd27bcbb',
                        user: 1,
                    })
                    .toBeLoggedTimes(2);
            });
            it('должен залогировать отсутствие scope при передаче undefined', () => {
                // Act
                listAgent.log.notFound(undefined);
                listAgent.sync.log.notFound(undefined);

                // Assert
                logger
                    .withLevel('warn')
                    .withMessage('Scope not found')
                    .withDetails({
                        matrix: 'article',
                        scope: 'null',
                        user: 1,
                    })
                    .toBeLoggedTimes(2);
            });
        });
    });
    describe('insertPermission', () => {
        it('должен вставить разрешения в сущности', async () => {
            const entities: Article[] = [
                { id: 1, authorId: 2 },
                { id: 2, authorId: 1 },
            ];

            const result = await listAgent.insertPermissions(entities);

            expect(result).toBe(entities);
            expect(entities).toEqual([
                { id: 1, authorId: 2, __permissions: ['read', 'edit'] },
                { id: 2, authorId: 1, __permissions: ['read', 'post'] },
            ]);
        });

        it('должен выкинуть ошибку 404 если передано undefined или null', async () => {
            await expect(listAgent.insertPermissions([undefined, null] as any)).rejects.toEqual(
                new NotFoundException(),
            );
        });
        it('должен выкинуть ошибку 404 если entity передан, но rbac его не нашел', async () => {
            await expect(listAgent.insertPermissions([{ id: 404 }])).rejects.toEqual(
                new NotFoundException(),
            );
        });
    });
    describe('check* методы', () => {
        describe('check', () => {
            describe('no scope', () => {
                it('не выбрасывает ошибку, если есть разрешение', async () => {
                    await expect(listAgent.check('read')).resolves.toBeUndefined();

                    logger
                        .withLevel('debug')
                        .withMessage('Access granted')
                        .withDetails({
                            matrix: 'article',
                            scope: 'null',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'read',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });

                it('выбрасывает ошибку, если нет разрешения', async () => {
                    await expect(listAgent.check('post')).rejects.toMatchObject({
                        status: 403,
                    });

                    logger
                        .withLevel('warn')
                        .withMessage('Access denied')
                        .withDetails({
                            matrix: 'article',
                            scope: 'null',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'post',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });
            });
            describe('with scope', () => {
                it('не выбрасывает ошибку, если есть разрешение', async () => {
                    await expect(listAgent.check('read', { author: 1 })).resolves.toBeUndefined();

                    logger
                        .withLevel('debug')
                        .withMessage('Access granted')
                        .withDetails({
                            matrix: 'article',
                            scope: 'author: 1',
                            user: 1,
                            grantedPermissions: 'read, post',
                            requiredPermissions: 'read',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });

                it('выбрасывает ошибку с нужным кодом, если нет разрешения, но указанный scope есть', async () => {
                    await expect(listAgent.check('post', { author: 2 }, 403)).rejects.toMatchObject(
                        {
                            status: 403,
                        },
                    );

                    logger
                        .withLevel('warn')
                        .withMessage('Access denied')
                        .withDetails({
                            matrix: 'article',
                            scope: 'author: 2',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'post',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });

                it.skip('выбрасывает 404, если указанный scope не найден', async () => {
                    await expect(listAgent.check('read', { author: 404 })).rejects.toMatchObject({
                        status: 404,
                    });
                });
            });
        });

        describe('checkSome', () => {
            describe('no scope', () => {
                it('не выбрасывает ошибку, если есть хотя бы одно разрешение', async () => {
                    await expect(listAgent.checkSome(['read'])).resolves.toBeUndefined();

                    logger
                        .withLevel('debug')
                        .withMessage('Access granted')
                        .withDetails({
                            matrix: 'article',
                            scope: 'null',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'read',
                            mode: 'some',
                        })
                        .toBeLoggedOnce();
                });

                it('выбрасывает ошибку, если нет ни одного разрешения', async () => {
                    await expect(listAgent.checkSome(['post'])).rejects.toMatchObject({
                        status: 403,
                    });

                    logger
                        .withLevel('warn')
                        .withMessage('Access denied')
                        .withDetails({
                            matrix: 'article',
                            scope: 'null',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'post',
                            mode: 'some',
                        })
                        .toBeLoggedOnce();
                });
            });
            describe('with scope', () => {
                it('не выбрасывает ошибку, если есть хотя бы одно разрешение', async () => {
                    await expect(
                        listAgent.checkSome(['read', 'edit'], { author: 1 }),
                    ).resolves.toBeUndefined();

                    logger
                        .withLevel('debug')
                        .withMessage('Access granted')
                        .withDetails({
                            matrix: 'article',
                            scope: 'author: 1',
                            user: 1,
                            grantedPermissions: 'read, post',
                            requiredPermissions: 'read, edit',
                            mode: 'some',
                        })
                        .toBeLoggedOnce();
                });

                it('выбрасывает ошибку, если нет ни одного разрешения, но указанный scope найден', async () => {
                    await expect(
                        listAgent.checkSome(['edit', 'delete'], { author: 2 }, 403),
                    ).rejects.toMatchObject({
                        status: 403,
                    });

                    logger
                        .withLevel('warn')
                        .withMessage('Access denied')
                        .withDetails({
                            matrix: 'article',
                            scope: 'author: 2',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'edit, delete',
                            mode: 'some',
                        })
                        .toBeLoggedOnce();
                });

                it.skip('выбрасывает 404, если указанный scope не найден', async () => {
                    await expect(
                        listAgent.checkSome(['read'], { author: 404 }),
                    ).rejects.toMatchObject({
                        status: 404,
                    });
                });
            });
        });

        describe('checkEvery', () => {
            describe('no scope', () => {
                it('не выбрасывает ошибку, если есть все разрешения', async () => {
                    await expect(listAgent.checkEvery(['read'])).resolves.toBeUndefined();

                    logger
                        .withLevel('debug')
                        .withMessage('Access granted')
                        .withDetails({
                            matrix: 'article',
                            scope: 'null',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'read',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });

                it('выбрасывает ошибку, если нет хотя бы одного разрешения', async () => {
                    await expect(listAgent.checkEvery(['read', 'post'])).rejects.toMatchObject({
                        status: 403,
                    });

                    logger
                        .withLevel('warn')
                        .withMessage('Access denied')
                        .withDetails({
                            matrix: 'article',
                            scope: 'null',
                            user: 1,
                            grantedPermissions: 'read',
                            requiredPermissions: 'read, post',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });
            });
            describe('with scope', () => {
                it('не выбрасывает ошибку, если есть все разрешения', async () => {
                    await expect(
                        listAgent.checkEvery(['read'], { author: 1 }),
                    ).resolves.toBeUndefined();

                    logger
                        .withLevel('debug')
                        .withMessage('Access granted')
                        .withDetails({
                            matrix: 'article',
                            scope: 'author: 1',
                            user: 1,
                            grantedPermissions: 'read, post',
                            requiredPermissions: 'read',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });

                it('выбрасывает ошибку, если нет хотя бы одного разрешения, но указанный scope найден', async () => {
                    await expect(
                        listAgent.checkEvery(['read', 'delete'], { author: 1 }, 403),
                    ).rejects.toMatchObject({
                        status: 403,
                    });

                    logger
                        .withLevel('warn')
                        .withMessage('Access denied')
                        .withDetails({
                            matrix: 'article',
                            scope: 'author: 1',
                            user: 1,
                            grantedPermissions: 'read, post',
                            requiredPermissions: 'read, delete',
                            mode: 'every',
                        })
                        .toBeLoggedOnce();
                });

                it.skip('выбрасывает 404, если указанный scope не найден', async () => {
                    await expect(
                        listAgent.checkEvery(['read'], { author: 404 }),
                    ).rejects.toMatchObject({
                        status: 404,
                    });
                });
            });
        });
    });
});
