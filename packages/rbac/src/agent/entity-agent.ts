import {
    canEvery,
    canSome,
    EntityWithCalculatedPermissions,
    EntityWithPermission,
    PermissionFromEntity,
} from '../permissions';
import { RelatedResolverIdTypes } from '../types';

import { AgentMethods, handleErrorDecision, RBACAbstractAgent } from './abstract-agent';
import { AgentPermissionHelper } from './agent-permission-helper';
import { EntityAgentLogs } from './entity-agent-logs';
import type { RBACListAgent } from './list-agent';
import { RBACErrorCode } from './types';

export interface IRBACEntityAgentSync<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> extends AgentMethods {
    log: EntityAgentLogs<ID, Entity, Related>;

    getPermissions(entity: ID | Entity): PermissionFromEntity<Entity>[];
    insertPermissions<T extends Entity>(entity?: T | null): EntityWithCalculatedPermissions<T>;

    check(
        permission: PermissionFromEntity<Entity>,
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    can(permission: PermissionFromEntity<Entity>, entity: ID | Entity): boolean;
    canSome(permissions: PermissionFromEntity<Entity>[], entity: ID | Entity): boolean;
    canEvery(permissions: PermissionFromEntity<Entity>[], entity: ID | Entity): boolean;
    exists(entity: ID | Entity): boolean;
}

export interface IRBACEntityAgent<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> extends RBACAbstractAgent {
    log: EntityAgentLogs<ID, Entity, Related>;
    sync: IRBACEntityAgentSync<ID, Entity, Related>;
    prepare(entity: ID | Entity): Promise<void>;
    prepare(entities: (ID | Entity)[]): Promise<void>;

    getPermissions(entity: ID | Entity): Promise<PermissionFromEntity<Entity>[]>;
    insertPermissions<T extends Entity>(
        entity: T | Promise<T>,
    ): Promise<EntityWithCalculatedPermissions<T>>;

    check(
        permission: PermissionFromEntity<Entity>,
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    can(permission: PermissionFromEntity<Entity>, entity: ID | Entity): Promise<boolean>;
    canSome(permissions: PermissionFromEntity<Entity>[], entity: ID | Entity): Promise<boolean>;
    canEvery(permissions: PermissionFromEntity<Entity>[], entity: ID | Entity): Promise<boolean>;
    exists(entity: ID | Entity): Promise<boolean>;
}

export class RBACEntityAgent<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> implements IRBACEntityAgent<ID, Entity, Related> {
    public readonly sync: RBACEntityAgentSync<ID, Entity, Related>;

    constructor(
        private readonly helper: AgentPermissionHelper<ID, Entity>,
        private readonly getListAgent: () => RBACListAgent<ID, Entity, Related>,
        public readonly log: EntityAgentLogs<ID, Entity, Related>,
    ) {
        this.sync = new RBACEntityAgentSync(helper, log);

        this.getPermissions = this.getPermissions.bind(this);
        this.insertPermissions = this.insertPermissions.bind(this);
    }

    get list() {
        return this.getListAgent();
    }

    async prepare(entity: ID | Entity): Promise<void>;
    async prepare(entities: (ID | Entity)[]): Promise<void>;
    async prepare(entities: ID | Entity | (ID | Entity)[]) {
        return this.helper.prepare(entities);
    }

    invalidate(entities: ID | Entity | (ID | Entity)[]) {
        return this.helper.invalidate(entities);
    }

    async getPermissions(entity: ID | Entity): Promise<PermissionFromEntity<Entity>[]> {
        await this.helper.prepare(entity);

        return this.helper.getPermissions(entity);
    }

    /**
     * Добавляет к сущности права
     * @throws NotFoundException если сущность не найдена
     */
    async insertPermissions<T extends Entity>(
        entity?: T | null | Promise<T | null | undefined>,
    ): Promise<EntityWithCalculatedPermissions<T>> {
        if (!entity) {
            handleErrorDecision(404);
        }

        if ('then' in entity) {
            entity = await entity;
        }

        if (!entity) {
            handleErrorDecision(404);
        }

        await this.helper.prepare(entity);

        return this.sync.insertPermissions(entity);
    }

    async can(permission: PermissionFromEntity<Entity>, entity: ID | Entity): Promise<boolean> {
        await this.helper.prepare(entity);

        return this.sync.can(permission, entity);
    }

    async canSome(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
    ): Promise<boolean> {
        await this.helper.prepare(entity);

        return this.sync.canSome(permissions, entity);
    }

    async canEvery(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
    ): Promise<boolean> {
        await this.helper.prepare(entity);

        return this.sync.canEvery(permissions, entity);
    }

    async check(
        permission: PermissionFromEntity<Entity>,
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void> {
        await this.helper.prepare(entity);

        return this.sync.check(permission, entity, httpCode, errorMessage);
    }

    async checkSome(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void> {
        await this.helper.prepare(entity);

        return this.sync.checkSome(permissions, entity, httpCode, errorMessage);
    }

    async checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void> {
        await this.helper.prepare(entity);

        return this.sync.checkEvery(permissions, entity, httpCode, errorMessage);
    }

    async exists(entity: ID | Entity): Promise<boolean> {
        await this.helper.prepare(entity);

        return this.sync.exists(entity);
    }
}

class RBACEntityAgentSync<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> implements IRBACEntityAgentSync<ID, Entity, Related> {
    constructor(
        private readonly helper: AgentPermissionHelper<ID, Entity>,
        public readonly log: EntityAgentLogs<ID, Entity, Related>,
    ) {}

    getPermissions(entity: ID | Entity): PermissionFromEntity<Entity>[] {
        return this.helper.getPermissions(entity);
    }

    /**
     * Добавляет к сущности права
     * @throws NotFoundException если сущность не найдена
     */
    insertPermissions<T extends Entity>(entity?: T | null): EntityWithCalculatedPermissions<T> {
        if (!entity) {
            handleErrorDecision(404);
        }

        const permissions = this.helper.getPermissions(entity);

        if (permissions.length === 0) {
            handleErrorDecision(404);
        }

        entity.__permissions = permissions;

        return entity as EntityWithCalculatedPermissions<T>;
    }

    can(permission: PermissionFromEntity<Entity>, entity: ID | Entity): boolean {
        return this.helper.getPermissions(entity).includes(permission);
    }

    canSome(permissions: PermissionFromEntity<Entity>[], entity: ID | Entity): boolean {
        const entityPermissions = this.helper.getPermissions(entity);

        return canSome(entityPermissions, ...permissions);
    }

    canEvery(permissions: PermissionFromEntity<Entity>[], entity: ID | Entity): boolean {
        const entityPermissions = this.helper.getPermissions(entity);

        return canEvery(entityPermissions, ...permissions);
    }

    check(
        permission: PermissionFromEntity<Entity>,
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void {
        const can = this.can(permission, entity);

        if (can) {
            this.log.accessGranted(permission, entity);
        } else {
            if (this.exists(entity)) {
                this.log.accessDenied(permission, entity);
                handleErrorDecision(httpCode, errorMessage);
            } else {
                this.log.notFound(entity);
                handleErrorDecision(404);
            }
        }
    }

    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void {
        const can = this.canSome(permissions, entity);

        if (can) {
            this.log.accessGranted(permissions, entity, 'some');
        } else {
            if (this.exists(entity)) {
                this.log.accessDenied(permissions, entity, 'some');
                handleErrorDecision(httpCode, errorMessage);
            } else {
                this.log.notFound(entity);
                handleErrorDecision(404);
            }
        }
    }

    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        entity: ID | Entity,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void {
        const can = this.canEvery(permissions, entity);

        if (can) {
            this.log.accessGranted(permissions, entity, 'every');
        } else {
            if (this.exists(entity)) {
                this.log.accessDenied(permissions, entity, 'every');
                handleErrorDecision(httpCode, errorMessage);
            } else {
                this.log.notFound(entity);
                handleErrorDecision(404);
            }
        }
    }

    exists(entity: ID | Entity): boolean {
        return this.helper.existsSync(entity);
    }
}
