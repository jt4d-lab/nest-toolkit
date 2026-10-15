export { RbacModule } from './rbac.module';
export { createRole, SystemRoles } from './matrix';
export type { ScopeType, Role } from './matrix';
export { RBAC, RBACMatrix } from './decorators';
export { RbacService } from './rbac.service';
export type { PermissionsResolver, PermissionsResolverType, UpdateRolesProps } from './resolver';
export type {
    BaseResolver,
    GetBaseScope,
    GetBaseRoles,
    GetBaseScopeResult,
} from './rbac.providers';
export type {
    EntityWithPermission,
    PermissionFromEntity,
    EntityWithCalculatedPermissions,
    PermissionList,
} from './permissions';
export {
    can,
    canFactory,
    canSome,
    canSomeFactory,
    canEvery,
    canEveryFactory,
    createPermissionList,
} from './permissions';
export {
    RBACAgent,
    RBACEntityAgent,
    RBACListAgent,
    RBACAgentManager,
    type RBACGetter,
} from './agent';

export { Logger } from './logger';
