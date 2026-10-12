import { EntityWithPermission } from '@src/common/rbac';

import { RBACMatrix } from '../..';

describe('RBAC module / types', () => {
    interface IDemoEntity extends EntityWithPermission<'read'> {
        id: number;
        name?: string;
    }

    interface IComplexEntity extends EntityWithPermission<'read'> {
        demoId: number;
        id: number;
    }

    it('должен упасть, если getReferences не соответствует relations', () => {
        @RBACMatrix(
            {
                name: 'demo',
                getId: (entity: IDemoEntity) => entity.id,
            },
            () => ({
                read: [],
            }),
        )
        class DemoRBAC {
            getEntities(_ids: number[]): Promise<IDemoEntity[]> {
                throw new Error('Method not implemented.');
            }

            async getRoles() {
                return new Map();
            }
        }

        // @ts-expect-error
        @RBACMatrix(
            {
                name: 'complex',
                getId: (entity: IComplexEntity) => entity.id,
                relations: {
                    demo: DemoRBAC,
                },
            },
            () => ({
                read: [],
            }),
        )
        class _ComplexRBAC {
            getEntities(_ids: number[]): Promise<Map<number, IComplexEntity>> {
                throw new Error('Method not implemented.');
            }

            getReferences(entity: IComplexEntity) {
                return {
                    demo: entity.demoId.toString(), // требуется number
                };
            }

            async getRoles() {
                return new Map();
            }
        }
    });
    it('должен упасть, если getReferences отсутствует но relations задан', () => {
        @RBACMatrix(
            {
                name: 'demo',
                getId: (entity: IDemoEntity) => entity.id,
            },
            () => ({
                read: [],
            }),
        )
        class DemoRBAC {
            getEntities(_ids: number[]): Promise<IDemoEntity[]> {
                throw new Error('Method not implemented.');
            }

            async getRoles() {
                return new Map();
            }
        }

        // @ts-expect-error
        @RBACMatrix(
            {
                name: 'complex',
                getId: (entity: IComplexEntity) => entity.id,
                relations: {
                    demo: DemoRBAC,
                },
            },
            () => ({
                read: [],
            }),
        )
        class _ComplexRBAC {
            getEntities(_ids: number[]): Promise<Map<number, IComplexEntity>> {
                throw new Error('Method not implemented.');
            }

            async getRoles() {
                return new Map();
            }
        }
    });
});
