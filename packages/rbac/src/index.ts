export * from './rbac.module';
export { createRole, Roles, Operators } from './matrix';
export { type ScopeType } from './matrix';
export { RBACAgent, RBACEntityAgent, RBACListAgent } from './agent';
export { type PermissionsResolver } from './resolver';
export { RbacService } from './rbac.service';
export { RBAC, RBACMatrix } from './decorators';
export type { BaseResolver, GetBaseScope, GetBaseRoles } from './rbac.providers';
