import { Logger } from '../logger';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';
import { RelatedResolverIdTypes } from '../types';

import { AgentPermissionHelper } from './agent-permission-helper';
import { ACCESS_DENIED, ACCESS_GRANTED, SCOPE_NOT_FOUND, ScopeRel } from './types';

export class ListAgentLogs<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> {
    constructor(
        private readonly logger: Logger,
        private readonly helper: AgentPermissionHelper<ID, Entity, Related>,
    ) {}

    accessGranted(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.debug(ACCESS_GRANTED, this.prepareLogDetails(permissions, scope, mode));
    }

    accessDenied(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.warn(ACCESS_DENIED, this.prepareLogDetails(permissions, scope, mode));
    }

    notFound(scope?: ScopeRel<Related>): void {
        this.logger.warn(SCOPE_NOT_FOUND, this.prepareLogBaseDetails(scope));
    }

    private prepareLogBaseDetails(scope?: ScopeRel<Related>) {
        return {
            matrix: this.helper.matrix.name,
            scope: serializeScope(scope),
            user: this.helper.baseScope.profileId || 0,
        };
    }

    private prepareLogDetails(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        mode: 'some' | 'every' = 'every',
        reason?: string,
    ) {
        return {
            ...this.prepareLogBaseDetails(scope),
            grantedPermissions: this.helper.getListPermissions(scope).join(', ') || '(none)',
            requiredPermissions: Array.isArray(permissions) ? permissions.join(', ') : permissions,
            mode,
            ...(reason && { reason }),
        };
    }
}

function serializeScope(scope?: null | Record<string, string | number | undefined | null>) {
    if (!scope) {
        return 'null';
    }

    return Object.entries(scope)
        .map(([key, value]) => {
            if (value === null || value === undefined) {
                return;
            }

            return `${key}: ${value}`;
        })
        .join(', ');
}
