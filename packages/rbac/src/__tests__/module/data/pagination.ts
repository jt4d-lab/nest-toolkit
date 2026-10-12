import type { RBACListAgent, ScopeType } from '../../..';
import type { EntityWithPermission, PermissionFromEntity } from '../../../permissions';

export interface Pagination {
    count: number;
    offset: number;
    limit: number;
}

export interface PaginatedResponse<
    T extends EntityWithPermission = EntityWithPermission,
> extends EntityWithPermission<PermissionFromEntity<T>> {
    pagination: Pagination;
    data: T[];
}

interface DummyPaginatedResponseOptions<T extends EntityWithPermission> {
    rbac?: RBACListAgent<any, T, any>;
    can?: (entity: T) => boolean;
    scope?: ScopeType;
}

export async function makeDummyPaginatedResponse<T extends EntityWithPermission>(
    data: T[],
    count?: number,
    options: DummyPaginatedResponseOptions<T> = {},
): Promise<PaginatedResponse<T>> {
    const { rbac, can, scope } = options;

    if (count === undefined) {
        count = data.length;
    }

    const result: PaginatedResponse<T> = {
        data,
        pagination: {
            count,
            limit: data.length,
            offset: 0,
        },
    };

    if (rbac) {
        await rbac.insertPermissions(data);
        result.__permissions = await rbac.getPermissions(scope);

        if (can) {
            result.data = data.filter(can);
        }
    }

    return result;
}
