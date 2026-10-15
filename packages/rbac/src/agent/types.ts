import { EntityWithPermission } from '../permissions';
import { PermissionsCoordinator, PermissionsResolverType } from '../resolver';
import { RelatedResolverIdTypes } from '../types';

export interface IAgentManagerService {
    availableMatrices: PermissionsResolverType[];
    getPermissionMatrix<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
    >(
        matrix: PermissionsResolverType<ID, Entity, RelatedResolverIdTypes>,
    ): PermissionsCoordinator<ID, Entity>;
}

export type RBACErrorCode = 403 | 404;

export type ScopeRel<Related extends RelatedResolverIdTypes = null> = Related extends object
    ? Partial<Related> | undefined
    : undefined;
