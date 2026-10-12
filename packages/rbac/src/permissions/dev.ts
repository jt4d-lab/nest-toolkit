import { EntityWithPermission, PermissionFromEntity } from './types';

export function addPermissions<Entity extends EntityWithPermission>(
    entity: Entity,
    ...permissions: PermissionFromEntity<Entity>[]
): Entity;
export function addPermissions<Entity extends EntityWithPermission>(
    entities: Entity[],
    ...permissions: PermissionFromEntity<Entity>[]
): Entity[];

export function addPermissions<Entity extends EntityWithPermission>(
    entity: Entity | Entity[],
    ...permissions: PermissionFromEntity<Entity>[]
) {
    if (Array.isArray(entity)) {
        return entity.map((e) => addPermissions(e, ...permissions));
    }

    return {
        ...entity,
        __permissions: permissions,
    };
}
