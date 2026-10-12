export * from './rbac.module';
export { createRole, Roles, Operators, type Role } from './matrix';
export { type ScopeType } from './matrix';
export {
    RBACAgent,
    RBACEntityAgent,
    RBACListAgent,
    RBACAgentManager,
    type RBACGetter,
} from './agent';
export { type RelatedResolverIdTypes } from './types';
export {
    type PermissionsResolver,
    type PermissionsResolverType,
    type UpdateRolesProps,
} from './resolver';
export { RbacService } from './rbac.service';
export { Logger } from './logger';
export { RBAC, RBACMatrix } from './decorators';
export type {
    BaseResolver,
    GetBaseScope,
    GetBaseRoles,
    GetBaseScopeResult,
} from './rbac.providers';
export * from './permissions';
