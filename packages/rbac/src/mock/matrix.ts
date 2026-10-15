import { getMeta, RBACMatrix } from '../decorators';
import { ItemType, Operators, RelatedPermissionMap } from '../matrix';
import { EntityWithPermission } from '../permissions';
import { PermissionsResolver, PermissionsResolverType } from '../resolver';

export interface MockController<
    ID extends string | number = string | number,
    Entity extends EntityWithPermission = EntityWithPermission,
> {
    resetMock(): void;
    mock(
        entity: ID | Partial<Entity> | null,
        permissions: Partial<Record<keyof Entity, boolean>>,
    ): void;
}

type MatrixMockAgent = Record<string, (entity: any) => boolean>;

export function createMockMatrices(controllers: Map<string, MockController>) {
    return (matrix: PermissionsResolverType) => {
        const meta = getMeta(matrix);
        const [ctrl, agent] = createMockController(matrix);

        controllers.set(meta.name, ctrl);

        return createMockMatrix(matrix, agent);
    };
}

function createMockController(matrix: PermissionsResolverType): [MockController, MatrixMockAgent] {
    const permissionList = getMatrixPermissions(matrix);
    const permissions: Record<string, boolean> = {};
    const agent: MatrixMockAgent = {};

    const mockData = new Map<string | number, Record<string, boolean>>();

    const getId = getMeta(matrix).getId;

    permissionList.forEach((permission) => {
        agent[permission] = (entity: any) => {
            let perm = permissions;

            if (entity) {
                const id = typeof entity === 'object' ? fakeGetId(getId)(entity) : entity;
                const item = mockData.get(id);

                if (item) {
                    perm = item;
                } else {
                    throw new Error('Entity not mocked');
                }
            }

            const result = perm[permission];

            if (typeof result === 'boolean') {
                return result;
            }

            throw new Error(`Permission ${permission} is not set`);
        };
    });

    const ctrl: MockController = {
        resetMock,
        mock(entity: object | null, newPermissions: Record<string, boolean>) {
            permissionList.forEach((permission) => {
                if (permission in newPermissions) {
                    return;
                }

                newPermissions[permission] = false;
            });

            if (entity) {
                const id = typeof entity === 'object' ? getId(entity) : entity;

                mockData.set(id, newPermissions);
            } else {
                Object.assign(permissions, newPermissions);
            }
        },
    };

    resetMock();

    return [ctrl, agent];

    function resetMock() {
        mockData.clear();
        permissionList.forEach((permission) => {
            if (permission in permissions) {
                return;
            }

            permissions[permission] = false;
        });
    }
}

function createMockMatrix(
    matrix: PermissionsResolverType,
    agent: MatrixMockAgent,
): PermissionsResolverType {
    const meta = getMeta(matrix);

    @RBACMatrix(
        {
            name: meta.name,
            getId: fakeGetId(meta.getId),
        },
        ({ createRule }) => {
            const result: Record<string, any> = {};

            Object.keys(agent).forEach((permission) => {
                result[permission] = createRule('fake ' + permission, agent[permission], {
                    allowEmpty: true,
                });
            });

            return result;
        },
    )
    class WrappedMatrix implements PermissionsResolver<number | string, any> {
        getEntities(ids: (string | number)[]): Promise<any> {
            return Promise.resolve(ids.map((__id) => ({ __id })));
        }
    }

    return WrappedMatrix;
}

function getMatrixPermissions(permissionsResolver: PermissionsResolverType): string[] {
    const meta = getMeta(permissionsResolver);

    const relations: RelatedPermissionMap<any> = {};
    const metaRelations = meta.relations as Record<string, PermissionsResolverType>;

    Object.keys(metaRelations).forEach((relationKey) => {
        const relationPermissions = getMatrixPermissions(metaRelations[relationKey]);

        relations[relationKey] = {};

        relationPermissions.forEach((permission) => {
            relations[relationKey][permission] = {
                type: ItemType.RelatedPermission,
                name: permission,
                relation: relationKey,
            };
        });
    });

    const permissions = meta.matrix(new Operators(), relations);

    return Object.keys(permissions);
}

function fakeGetId<ID extends number | string, Entity extends EntityWithPermission>(
    getId: (entity: Entity) => ID,
) {
    return (entity: Entity) => {
        if ('__id' in entity) {
            return entity['__id'] as string | number;
        } else {
            return getId(entity);
        }
    };
}
