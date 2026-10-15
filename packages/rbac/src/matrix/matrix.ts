import { EmptyObject } from '../empty-object';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';

import { buildGraph } from './build-graph';
import { SystemRoles } from './items';
import { Operators } from './operators';
import {
    CalculatedRelations,
    Definition,
    ItemType,
    PermissionDefinitionTableCreator,
    PermissionMatrix,
    RelatedEntities,
    RelatedPermissionMap,
    Role,
    ScopeType,
} from './types';

export function createPermissionMatrix<
    Entity extends EntityWithPermission,
    Related extends RelatedEntities = EmptyObject,
>(
    name: string,
    permissionsCreator: PermissionDefinitionTableCreator<Entity, Related>,
    relations: RelatedPermissionMap<Related>,
): PermissionMatrix<Entity, Related> {
    const permissions = permissionsCreator(new Operators(), relations);

    const graph = buildGraph(name, permissions);

    return {
        type: ItemType.Matrix,
        name,
        permissions: permissions as Record<PermissionFromEntity<Entity>, Definition<Entity>[]>,
        resolvePermissions,
        getLastDebugInfo: graph.getLastDebugInfo,
    };

    function resolvePermissions(
        roles: Role[],
        scope: ScopeType,
        entity?: Entity,
        relations?: CalculatedRelations<Related>,
    ): PermissionFromEntity<Entity>[] {
        const roleList: string[] = [SystemRoles.any.name];

        addRole(SystemRoles.any);
        roles.forEach(addRole);

        return graph.calculate(
            {
                roles: roleList,
                scope,
                relations: relations || {},
            },
            entity,
        );

        function addRole(role: Role) {
            roleList.push(role.name);
            role.extendRoles.forEach(addRole);
        }
    }
}
