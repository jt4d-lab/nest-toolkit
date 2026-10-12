import { Role, ScopeType } from './matrix';

export const rbacBaseResolverToken = 'RBAC_BASE_RESOLVER';
export const rbacFeatureMatrices = 'RBAC_FEATURE_MATRICES';

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
