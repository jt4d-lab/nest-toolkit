import { NotFoundException } from '@nestjs/common';

import {
    canEvery,
    canSome,
    EntityWithCalculatedPermissions,
    EntityWithPermission,
    PermissionFromEntity,
} from '@src/common/rbac';

import { RelatedResolverIdTypes } from '../types';

import { AgentMethods, handleErrorDecision, RBACAbstractAgent } from './abstract-agent';
import { AgentPermissionHelper } from './agent-permission-helper';
import type { RBACEntityAgent } from './entity-agent';
import { ListAgentLogs } from './list-agent-logs';
import { RBACErrorCode, ScopeRel } from './types';

export interface IRBACListAgentSync<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> extends AgentMethods {
    log: ListAgentLogs<ID, Entity, Related>;

    getPermissions(scope?: ScopeRel<Related>): PermissionFromEntity<Entity>[];
    insertPermissions<T extends Entity>(entity: T[]): EntityWithCalculatedPermissions<T>[];

    check(
        permission: PermissionFromEntity<Entity>,
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    check(
        permission: PermissionFromEntity<Entity>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    can(permission: PermissionFromEntity<Entity>, scope?: ScopeRel<Related>): boolean;
    canSome(permissions: PermissionFromEntity<Entity>[], scope?: ScopeRel<Related>): boolean;
    canEvery(permissions: PermissionFromEntity<Entity>[], scope?: ScopeRel<Related>): boolean;
}

export interface IRBACListAgent<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> extends RBACAbstractAgent {
    log: ListAgentLogs<ID, Entity, Related>;
    sync: IRBACListAgentSync<ID, Entity, Related>;
    prepare(scope?: ScopeRel<Related>): Promise<void>;
    prepare(entities: Entity[]): Promise<void>;

    getPermissions(scope?: ScopeRel<Related>): Promise<PermissionFromEntity<Entity>[]>;
    insertPermissions<T extends Entity>(
        entity: T[] | Promise<T[]>,
    ): Promise<EntityWithCalculatedPermissions<T>[]>;

    check(
        permission: PermissionFromEntity<Entity>,
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    check(
        permission: PermissionFromEntity<Entity>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    can(permission: PermissionFromEntity<Entity>, scope?: ScopeRel<Related>): Promise<boolean>;
    canSome(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
    ): Promise<boolean>;
    canEvery(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
    ): Promise<boolean>;
}

export class RBACListAgent<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> implements IRBACListAgent<ID, Entity, Related>
{
    public readonly sync: RBACListAgentSync<ID, Entity, Related>;

    constructor(
        private readonly helper: AgentPermissionHelper<ID, Entity, Related>,
        private readonly getEntityAgent: () => RBACEntityAgent<ID, Entity, Related>,
        public readonly log: ListAgentLogs<ID, Entity, Related>,
    ) {
        this.sync = new RBACListAgentSync(helper, log);

        this.getPermissions = this.getPermissions.bind(this);
        this.insertPermissions = this.insertPermissions.bind(this);
    }

    get entity() {
        return this.getEntityAgent();
    }

    async prepare(scope?: ScopeRel<Related>): Promise<void>;
    async prepare(entities: Entity[]): Promise<void>;
    async prepare(entities?: ScopeRel<Related> | Entity[]) {
        if (Array.isArray(entities)) {
            return this.helper.prepare(entities);
        } else {
            return this.helper.prepareScope(entities);
        }
    }

    invalidate(entities: ID | Entity | (ID | Entity)[]) {
        return this.helper.invalidate(entities);
    }

    async getPermissions(scope?: ScopeRel<Related>): Promise<PermissionFromEntity<Entity>[]> {
        await this.helper.prepareScope(scope);

        return this.sync.getPermissions(scope);
    }

    async insertPermissions<T extends Entity>(
        entities: T[] | Promise<T[]>,
    ): Promise<EntityWithCalculatedPermissions<T>[]> {
        if ('then' in entities) {
            entities = await entities;
        }

        await this.helper.prepare(entities);

        return this.sync.insertPermissions(entities);
    }

    async can(
        permission: PermissionFromEntity<Entity>,
        scope?: ScopeRel<Related>,
    ): Promise<boolean> {
        await this.helper.prepareScope(scope);

        return this.sync.can(permission, scope);
    }

    async canSome(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
    ): Promise<boolean> {
        await this.helper.prepareScope(scope);

        return this.sync.canSome(permissions, scope);
    }

    async canEvery(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
    ): Promise<boolean> {
        await this.helper.prepareScope(scope);

        return this.sync.canEvery(permissions, scope);
    }

    async check(
        permission: PermissionFromEntity<Entity>,
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    async check(
        permission: PermissionFromEntity<Entity>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    async check(
        permission: PermissionFromEntity<Entity>,
        arg1?: ScopeRel<Related> | RBACErrorCode,
        arg2?: RBACErrorCode | string,
        arg3?: string,
    ): Promise<void> {
        const [scope, httpCode, errorMessage] = parseArgs(arg1, arg2, arg3);

        await this.helper.prepareScope(scope);

        return this.sync.check(permission, scope, httpCode, errorMessage);
    }

    async checkSome(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    async checkSome(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    async checkSome(
        permissions: PermissionFromEntity<Entity>[],
        arg1?: ScopeRel<Related> | RBACErrorCode,
        arg2?: RBACErrorCode | string,
        arg3?: string,
    ): Promise<void> {
        const [scope, httpCode, errorMessage] = parseArgs(arg1, arg2, arg3);

        await this.helper.prepareScope(scope);

        return this.sync.checkSome(permissions, scope, httpCode, errorMessage);
    }

    async checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    async checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): Promise<void>;
    async checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        arg1?: ScopeRel<Related> | RBACErrorCode,
        arg2?: RBACErrorCode | string,
        arg3?: string,
    ): Promise<void> {
        const [scope, httpCode, errorMessage] = parseArgs(arg1, arg2, arg3);

        await this.helper.prepareScope(scope);

        return this.sync.checkEvery(permissions, scope, httpCode, errorMessage);
    }
}

class RBACListAgentSync<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> implements IRBACListAgentSync<ID, Entity, Related>
{
    constructor(
        private readonly helper: AgentPermissionHelper<ID, Entity, Related>,
        public readonly log: ListAgentLogs<ID, Entity, Related>,
    ) {}

    getPermissions(scope?: ScopeRel<Related>): PermissionFromEntity<Entity>[] {
        return this.helper.getListPermissions(scope);
    }

    insertPermissions<T extends Entity>(entities: T[]): EntityWithCalculatedPermissions<T>[] {
        entities.forEach((entity) => {
            if (!this.helper.existsSync(entity)) {
                throw new NotFoundException();
            }

            entity.__permissions = this.helper.getPermissions(entity);
        });

        return entities as EntityWithCalculatedPermissions<T>[];
    }

    can(permission: PermissionFromEntity<Entity>, scope?: ScopeRel<Related>): boolean {
        return this.helper.getListPermissions(scope).includes(permission);
    }

    canSome(permissions: PermissionFromEntity<Entity>[], scope?: ScopeRel<Related>): boolean {
        const entityPermissions = this.helper.getListPermissions(scope);

        return canSome(entityPermissions, ...permissions);
    }

    canEvery(permissions: PermissionFromEntity<Entity>[], scope?: ScopeRel<Related>): boolean {
        const entityPermissions = this.helper.getListPermissions(scope);

        return canEvery(entityPermissions, ...permissions);
    }

    check(
        permission: PermissionFromEntity<Entity>,
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    check(
        permission: PermissionFromEntity<Entity>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    check(
        permission: PermissionFromEntity<Entity>,
        arg1?: ScopeRel<Related> | RBACErrorCode,
        arg2?: RBACErrorCode | string,
        arg3?: string,
    ): void {
        const [scope, httpCode, errorMessage] = parseArgs(arg1, arg2, arg3);

        const can = this.can(permission, scope);

        if (can) {
            this.log.accessGranted(permission, scope);
        } else {
            this.log.accessDenied(permission, scope);
            handleErrorDecision(httpCode, errorMessage);
        }
    }

    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkSome(
        permissions: PermissionFromEntity<Entity>[],
        arg1?: ScopeRel<Related> | RBACErrorCode,
        arg2?: RBACErrorCode | string,
        arg3?: string,
    ): void {
        const [scope, httpCode, errorMessage] = parseArgs(arg1, arg2, arg3);

        const can = this.canSome(permissions, scope);

        if (can) {
            this.log.accessGranted(permissions, scope, 'some');
        } else {
            this.log.accessDenied(permissions, scope, 'some');
            handleErrorDecision(httpCode, errorMessage);
        }
    }

    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        scope?: ScopeRel<Related>,
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        httpCode?: RBACErrorCode,
        errorMessage?: string,
    ): void;
    checkEvery(
        permissions: PermissionFromEntity<Entity>[],
        arg1?: ScopeRel<Related> | RBACErrorCode,
        arg2?: RBACErrorCode | string,
        arg3?: string,
    ): void {
        const [scope, httpCode, errorMessage] = parseArgs(arg1, arg2, arg3);

        const can = this.canEvery(permissions, scope);

        if (can) {
            this.log.accessGranted(permissions, scope, 'every');
        } else {
            this.log.accessDenied(permissions, scope, 'every');
            handleErrorDecision(httpCode, errorMessage);
        }
    }
}

function parseArgs<Related extends RelatedResolverIdTypes = null>(
    arg1?: ScopeRel<Related> | number,
    arg2?: string | number,
    arg3?: string,
): [scope?: ScopeRel<Related>, httpCode?: RBACErrorCode, errorMessage?: string] {
    if (typeof arg1 === 'number') {
        return [undefined, arg1 as RBACErrorCode, arg2 as string] as const;
    }

    return [arg1 as ScopeRel<Related>, arg2 as RBACErrorCode, arg3 as string] as const;
}
