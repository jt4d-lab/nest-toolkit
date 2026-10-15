import type { RBACLogger } from '../logging';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';
import { RelatedResolverIdTypes } from '../types';

import { AgentPermissionHelper } from './agent-permission-helper';
import { ScopeRel } from './types';

export class ListAgentLogs<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> {
    constructor(
        private readonly logger: RBACLogger,
        private readonly helper: AgentPermissionHelper<ID, Entity, Related>,
    ) {}

    accessGranted(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.accessGranted(this.prepareAccessEvent(permissions, scope, mode));
    }

    accessDenied(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.accessDenied(this.prepareAccessEvent(permissions, scope, mode));
    }

    notFound(scope?: ScopeRel<Related>): void {
        this.logger.scopeNotFound(this.prepareBaseEvent(scope));
    }

    private prepareBaseEvent(scope?: ScopeRel<Related>) {
        return {
            matrix: this.helper.matrix.name,
            scope,
            user: this.helper.baseScope.profileId || 0,
        };
    }

    private prepareAccessEvent(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        mode: 'some' | 'every' = 'every',
    ) {
        return {
            ...this.prepareBaseEvent(scope),
            grantedPermissions: this.helper.getListPermissions(scope),
            requiredPermissions: Array.isArray(permissions) ? permissions : [permissions],
            mode,
        };
    }
}
