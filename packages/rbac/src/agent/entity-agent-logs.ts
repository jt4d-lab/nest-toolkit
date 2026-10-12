import { Logger } from '../logger';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';
import { RelatedResolverIdTypes } from '../types';

import { AgentPermissionHelper } from './agent-permission-helper';
import { ACCESS_DENIED, ACCESS_GRANTED, ENTITY_NOT_FOUND } from './types';

export class EntityAgentLogs<
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
        entity: ID | Entity,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.debug(ACCESS_GRANTED, this.prepareLogDetails(permissions, entity, mode));
    }

    accessDenied(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.warn(ACCESS_DENIED, this.prepareLogDetails(permissions, entity, mode));
    }

    notFound(entity?: ID | Entity): void {
        this.logger.warn(ENTITY_NOT_FOUND, this.prepareLogBaseDetails(entity));
    }

    private prepareLogBaseDetails(entity?: ID | Entity) {
        return {
            matrix: this.helper.matrix.name,
            entity: entity ? this.helper.getEntityId(entity) : undefined,
            user: this.helper.baseScope.profileId || 0,
        };
    }

    private prepareLogDetails(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        mode: 'some' | 'every' = 'every',
        reason?: string,
    ) {
        return {
            ...this.prepareLogBaseDetails(entity),
            grantedPermissions: this.helper.getPermissions(entity).join(', ') || '(none)',
            requiredPermissions: Array.isArray(permissions) ? permissions.join(', ') : permissions,
            mode,
            ...(reason && { reason }),
        };
    }
}
