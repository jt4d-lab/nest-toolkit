import { EntityWithPermission } from '../permissions';

import { createRole, Roles } from './items';
import { createPermissionMatrix } from './matrix';
import { Operators } from './operators';
import { ItemType } from './types';

describe('RBAC PermissionMatrix', () => {
    const userRole = createRole('user');
    const adminRole = createRole('admin', [userRole]);
    const superAdminRole = createRole('superAdmin', [adminRole]);
    const rootRole = createRole('root', [superAdminRole]);

    describe('guests', () => {
        it('empty deps - disallow all', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    read: [],
                }),
                {},
            );

            // act
            const permitted = matrix.resolvePermissions([adminRole], {});

            // assert
            expect(permitted).toEqual([]);
        });
        it('allow only for guest', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    read: [Roles.guest],
                }),
                {},
            );

            // act
            const guestPermitted = matrix.resolvePermissions([Roles.guest], {});
            const loggedUserPermitted = matrix.resolvePermissions([Roles.loggedIn], {});

            // assert
            expect(guestPermitted).toEqual(['read']);
            expect(loggedUserPermitted).toEqual([]);
        });
    });
    describe('roles', () => {
        it('single role', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    read: userRole,
                }),
                {},
            );

            // act
            const permitted = matrix.resolvePermissions([userRole], {});

            // assert
            expect(permitted).toEqual(['read']);
        });
        it('multiple roles', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    read: [userRole, Roles.guest],
                }),
                {},
            );

            // act
            const permitted = matrix.resolvePermissions([userRole], {});

            // assert
            expect(permitted).toEqual(['read']);
        });
        it('should disallow if no required role present', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    delete: [adminRole],
                }),
                {},
            );

            // act
            const userPermitted = matrix.resolvePermissions([userRole], {});
            const adminPermitted = matrix.resolvePermissions([adminRole], {});

            // assert
            expect(userPermitted).toEqual([]);
            expect(adminPermitted).toEqual(['delete']);
        });
        it('transitive role', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    create: [userRole],
                }),
                {},
            );

            // act
            const permitted = matrix.resolvePermissions([adminRole], {});

            // assert
            expect(permitted).toEqual(['create']);
        });
        it('deep transitive role', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                () => ({
                    create: [userRole],
                }),
                {},
            );

            // act
            const permitted = matrix.resolvePermissions([rootRole], {});

            // assert
            expect(permitted).toEqual(['create']);
        });
    });
    describe('rules and operator "and"', () => {
        describe('rule and role', () => {
            interface Post extends EntityWithPermission<'update'> {
                ownerId: number;
            }
            const matrix = createPermissionMatrix<Post>(
                'post',
                ({ and, createRule }) => {
                    const owner = createRule('updateOwn', (post, scope) => {
                        return Number.isFinite(scope.userId) && post.ownerId === scope.userId;
                    });

                    return {
                        update: and(userRole, owner),
                    };
                },
                {},
            );

            it('should allow if rule and role are fulfilled', () => {
                const permitted = matrix.resolvePermissions(
                    [userRole],
                    {
                        userId: 1 /* owner */,
                    },
                    { ownerId: 1 },
                );

                expect(permitted).toEqual(['update']);
            });
            it('should forbid if rule is not fulfilled', () => {
                const permitted = matrix.resolvePermissions(
                    [userRole],
                    {
                        userId: 1 /* owner */,
                    },
                    { ownerId: 2 },
                );

                expect(permitted).toEqual([]);
            });
            it('should forbid if role is not suitable', () => {
                const permitted = matrix.resolvePermissions(
                    [Roles.guest],
                    {
                        userId: 1 /* owner */,
                    },
                    { ownerId: 1 },
                );

                expect(permitted).toEqual([]);
            });
        });
        it('rule always returns false if entity not present', () => {
            // arrange
            const matrix = createPermissionMatrix(
                'post',
                ({ createRule }) => {
                    const alwaysTrue = createRule('alwaysTrue', () => true);

                    return {
                        update: alwaysTrue,
                    };
                },
                {},
            );

            const permitted = matrix.resolvePermissions([], {});

            // act & assert
            expect(permitted).toEqual([]);
        });
        // it('should prefer without execution in case with two rules: with and without execution ', () => {}); // todo #651
    });
    describe('operator and', () => {
        interface Post extends EntityWithPermission<'update'> {
            ownerId: number;
        }

        const matrix = createPermissionMatrix<Post>(
            'post',
            ({ and, eq, createRule }) => {
                const ownerRule = createRule('owner', (post, scope) => {
                    return Number.isFinite(scope.userId) && post.ownerId === scope.userId;
                });

                return {
                    update: and(ownerRule, adminRole, eq('ownerId', 1)),
                };
            },
            {},
        );

        it('should throw error if rules less than 2', () => {
            const operators = new Operators<EntityWithPermission>();

            expect(() => operators.and(Roles.any)).toThrow();
        });
        it('выполняются все условия', () => {
            expect(
                matrix.resolvePermissions(
                    [adminRole],
                    {
                        userId: 1 /* admin, owner */,
                    },
                    { ownerId: 1 },
                ),
            ).toEqual(['update']);
        });
        it('выполняется два из трех условий', () => {
            // non-admin
            expect(
                matrix.resolvePermissions(
                    [userRole],
                    {
                        userId: 1 /* non-admin, owner */,
                    },
                    { ownerId: 1 },
                ),
            ).toEqual([]);
        });
        it('выполняется два других из трех условий', () => {
            // non-owner
            expect(
                matrix.resolvePermissions(
                    [adminRole],
                    {
                        userId: 2 /* admin, non-owner */,
                    },
                    { ownerId: 1 },
                ),
            ).toEqual([]);
        });
        it('не выполняется ни одно из условий', () => {
            // rule is not fulfilled
            expect(
                matrix.resolvePermissions(
                    [adminRole],
                    {
                        userId: 2 /* admin, owner */,
                    },
                    { ownerId: 2 },
                ),
            ).toEqual([]);
        });
    });
    describe('operator or', () => {
        interface Post extends EntityWithPermission<'update'> {
            ownerId: number;
        }

        const matrix = createPermissionMatrix<Post>(
            'post',
            ({ or, eq, createRule }) => {
                const ownerRule = createRule('owner', (post, scope) => {
                    return Number.isFinite(scope.userId) && post.ownerId === scope.userId;
                });

                return {
                    update: or(ownerRule, adminRole, eq('ownerId', 1)),
                };
            },
            {},
        );

        it('should throw error if rules less than 2', () => {
            const operators = new Operators<EntityWithPermission>();

            expect(() => operators.or(Roles.any)).toThrow();
        });
        it('выполняются все условия', () => {
            expect(
                matrix.resolvePermissions(
                    [adminRole],
                    {
                        userId: 1 /* admin, owner */,
                    },
                    { ownerId: 1 },
                ),
            ).toEqual(['update']);
        });
        it('выполняется два из трех условий', () => {
            // non-admin
            expect(
                matrix.resolvePermissions(
                    [userRole],
                    {
                        userId: 1 /* non-admin, owner */,
                    },
                    { ownerId: 1 },
                ),
            ).toEqual(['update']);
        });
        it('выполняется одно из трех условий', () => {
            // non-owner
            expect(
                matrix.resolvePermissions(
                    [adminRole],
                    {
                        userId: 1 /* non-admin, non-owner */,
                    },
                    { ownerId: 2 },
                ),
            ).toEqual(['update']);
        });
        it('не выполняется ни одно из условий', () => {
            // rule is not fulfilled
            expect(
                matrix.resolvePermissions(
                    [userRole],
                    {
                        userId: 1 /* non-admin, non-owner */,
                    },
                    { ownerId: 2 },
                ),
            ).toEqual([]);
        });
    });
    describe('составные операторы', () => {
        it('оператор как аргумент оператора', () => {
            interface Post extends EntityWithPermission<'update'> {
                ownerId: number;
            }

            const matrix = createPermissionMatrix<Post>(
                'post',
                ({ or, and, eq }) => {
                    return {
                        update: or(
                            and(adminRole, eq('ownerId', 1)),
                            and(userRole, eq('ownerId', 2)),
                        ),
                    };
                },
                {},
            );

            expect(matrix.resolvePermissions([adminRole], {}, { ownerId: 1 })).toEqual(['update']);

            expect(matrix.resolvePermissions([userRole], {}, { ownerId: 1 })).toEqual([]);

            expect(matrix.resolvePermissions([userRole], {}, { ownerId: 2 })).toEqual(['update']);
        });
    });
    describe('relations', () => {
        // arrange
        interface IOrg extends EntityWithPermission<'writePost'> {
            id: number;
        }
        interface IPost extends EntityWithPermission<'write'> {
            id: number;
        }
        const matrix = createPermissionMatrix<IPost, { org: IOrg }>(
            'post',
            (_, { org }) => ({
                write: [org.writePost],
            }),
            {
                org: {
                    writePost: {
                        type: ItemType.RelatedPermission,
                        name: 'writePost',
                        relation: 'org',
                    },
                },
            },
        );

        it('allow if direct relation permission allows', async () => {
            // act
            const permitted = matrix.resolvePermissions([userRole], {}, undefined, {
                org: ['writePost'],
            });

            // assert
            expect(permitted).toEqual(['write']);
        });
        it('disallow if direct relation permission disallows', async () => {
            // act
            const permitted = matrix.resolvePermissions([userRole], {}, undefined, {
                org: [],
            });

            // assert
            expect(permitted).toEqual([]);
        });
        it('throw error if not relation', async () => {
            expect(() =>
                matrix.resolvePermissions([userRole], {}, undefined, {} as any),
            ).toThrowError('Relation "org" not found');
        });
    });
    describe('complex', () => {
        // arrange
        interface Post extends EntityWithPermission<'read' | 'create' | 'update' | 'delete'> {
            id: number;
            draft: boolean;
            ownerId: number;
            contest: {
                id: number;
            };
        }

        const postMatrix = createPermissionMatrix<Post>(
            'post',
            ({ and, eq, createRule }) => {
                const ownerRule = createRule('owner', (post, scope) => {
                    return Number.isFinite(scope.userId) && post.ownerId === scope.userId;
                });

                return {
                    read: [Roles.any],
                    create: [userRole],
                    update: [and(Roles.loggedIn, ownerRule)],
                    delete: [and(ownerRule, eq('draft', true)), adminRole],
                    rate: [and(userRole, eq('draft', false))],
                };
            },
            {},
        );

        it('guest', () => {
            const permitted = postMatrix.resolvePermissions([Roles.guest], {});

            expect(permitted).toEqual(['read']);
        });
        it('user', () => {
            const permitted = postMatrix.resolvePermissions([Roles.loggedIn, userRole], {
                userId: 1,
            });

            expect(permitted.sort()).toEqual(['read', 'create'].sort());
        });
        it('user, owner, draft', () => {
            const permitted = postMatrix.resolvePermissions(
                [Roles.loggedIn, userRole],
                { userId: 1 },
                { id: 1, contest: { id: 1 }, ownerId: 1, draft: true },
            );

            expect(permitted.sort()).toEqual(['read', 'delete', 'update', 'create'].sort());
        });
        it('user, owner, not draft', () => {
            const permitted = postMatrix.resolvePermissions(
                [Roles.loggedIn, userRole],
                { userId: 1 },
                { id: 1, contest: { id: 1 }, ownerId: 1, draft: false },
            );

            expect(permitted.sort()).toEqual(['read', 'update', 'create', 'rate'].sort());
        });
        it('user, not owner', () => {
            const permitted = postMatrix.resolvePermissions(
                [Roles.loggedIn, userRole],
                { userId: 1 },
                { id: 1, contest: { id: 1 }, ownerId: 2, draft: false },
            );

            expect(permitted.sort()).toEqual(['read', 'create', 'rate'].sort());
        });
        it('admin', () => {
            const permitted = postMatrix.resolvePermissions([Roles.loggedIn, adminRole], {
                userId: 2,
            });

            expect(permitted.sort()).toEqual(['read', 'delete', 'create'].sort());
        });
        it('admin, owner', () => {
            const permitted = postMatrix.resolvePermissions(
                [Roles.loggedIn, adminRole],
                { userId: 2 },
                { id: 1, contest: { id: 1 }, ownerId: 2, draft: false },
            );

            expect(permitted.sort()).toEqual(['read', 'update', 'delete', 'create', 'rate'].sort());
        });
        it('admin, not owner', () => {
            const permitted = postMatrix.resolvePermissions(
                [Roles.loggedIn, adminRole],
                { userId: 2 },
                { id: 1, contest: { id: 1 }, ownerId: 1, draft: false },
            );

            expect(permitted.sort()).toEqual(['read', 'delete', 'create', 'rate'].sort());
        });
        it('superAdmin, no draft', () => {
            const permitted = postMatrix.resolvePermissions(
                [Roles.loggedIn, superAdminRole],
                { userId: 3 },
                { id: 1, contest: { id: 1 }, ownerId: 1, draft: false },
            );

            expect(permitted.sort()).toEqual(['read', 'delete', 'create', 'rate'].sort());
        });
    });
});
