import { Role, ScopeType } from './matrix';

export const RBAC_BASE_RESOLVER = 'RBAC_BASE_RESOLVER';
export const RBAC_FEATURE_MATRICES = 'RBAC_FEATURE_MATRICES';
export const RBAC_LOGGER = 'RBAC_LOGGER';

export interface GetBaseScopeResult {
    loggedIn: boolean;
    scope: ScopeType;
}

export interface GetBaseScope {
    (request: Request): GetBaseScopeResult;
}

export interface GetBaseRoles {
    (scope: ScopeType): Promise<(Role | Role[] | null)[]>;
}

export interface BaseResolver {
    getBaseScope: GetBaseScope;
    getBaseRoles: GetBaseRoles;
}
