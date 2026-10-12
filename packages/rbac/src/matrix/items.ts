import { EmptyObject } from '../empty-object';
import { EntityWithPermission } from '../permissions';

import { ItemType, Permission, Role, Rule, ScopeType } from './types';

export const Roles = {
    any: createRole('ΔAny'),
    guest: createRole('ΔGuest'),
    loggedIn: createRole('ΔLoggedIn'),
} as const;

export function createRole(name: string, extendRoles: Role[] = []): Role {
    return {
        type: ItemType.Role,
        name,
        extendRoles,
    };
}

export function createPermission(name: string): Permission {
    return {
        type: ItemType.Permission,
        name,
    };
}

export function createRule<Entity extends EntityWithPermission = EmptyObject>(
    name: string,
    checkAccess: (entity: Entity, scope: ScopeType) => boolean,
    opts: { allowEmpty?: boolean } = {},
): Rule<Entity> {
    return {
        type: ItemType.Rule,
        name,
        deps: [Roles.any],
        checkAccess,
        opts,
    };
}
