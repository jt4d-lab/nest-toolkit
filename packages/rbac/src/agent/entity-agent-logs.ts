import type { RBACLogger } from '../logging';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';
import { RelatedResolverIdTypes } from '../types';

import { AgentPermissionHelper } from './agent-permission-helper';

export class EntityAgentLogs<
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
        entity: ID | Entity,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.accessGranted(this.prepareAccessEvent(permissions, entity, mode));
    }

    accessDenied(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        mode: 'some' | 'every' = 'every',
    ): void {
        this.logger.accessDenied(this.prepareAccessEvent(permissions, entity, mode));
    }

    notFound(entity?: ID | Entity): void {
        this.logger.entityNotFound(this.prepareBaseEvent(entity));
    }

    private prepareBaseEvent(entity?: ID | Entity) {
        return {
            matrix: this.helper.matrix.name,
            entity:
                entity === undefined || entity === null
                    ? undefined
                    : this.helper.getEntityId(entity),
            user: this.helper.baseScope.profileId || 0,
        };
    }

    private prepareAccessEvent(
        permissions: PermissionFromEntity<Entity> | PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        mode: 'some' | 'every' = 'every',
    ) {
        return {
            ...this.prepareBaseEvent(entity),
            grantedPermissions: this.helper.getPermissions(entity),
            requiredPermissions: Array.isArray(permissions) ? permissions : [permissions],
            mode,
        };
    }
}
