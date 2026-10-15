import { EntityWithPermission, PermissionFromEntity } from './types';

export interface PermissionList<Entity extends EntityWithPermission> {
    can(permission: PermissionFromEntity<Entity>): boolean;

    canSome(...permissions: PermissionFromEntity<Entity>[]): boolean;

    canEvery(...permissions: PermissionFromEntity<Entity>[]): boolean;
}

export function createPermissionList<Entity extends EntityWithPermission>({
    __permissions,
}: Entity): PermissionList<Entity> {
    if (!__permissions) {
        throw new Error('Entity does not contains calculated permissions');
    }

    return {
        can(permission: PermissionFromEntity<Entity>): boolean {
            return __permissions.includes(permission);
        },
        canSome(...permissions): boolean {
            return permissions.some((permission) => __permissions.includes(permission));
        },
        canEvery(...permissions): boolean {
            return permissions.every((permission) => __permissions.includes(permission));
        },
    };
}
