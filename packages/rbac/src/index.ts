export { RbacModule } from './rbac.module';
export { createRole, SystemRoles } from './matrix';
export type { ScopeType, Role } from './matrix';
export { RBAC, RBACMatrix } from './decorators';
export { RbacService } from './rbac.service';
export { RBAC_LOGGER } from './rbac.providers';
export type { RBACLogger, RBACLoggerOptions, RBACLogSink } from './logging';
export type {
    RBACEvent,
    RBACEventType,
    RBACLogLevel,
    AccessEventBase,
    AccessGrantedEvent,
    AccessDeniedEvent,
    ScopeNotFoundEvent,
    EntityNotFoundEvent,
    MatrixInitializedEvent,
    MatrixInstantiateFailedEvent,
    MatrixInitFailedEvent,
} from './logging';
export { DefaultRBACLogger } from './logging';
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
