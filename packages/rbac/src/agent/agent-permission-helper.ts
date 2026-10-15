import { GraphDebug, Role, ScopeType } from '../matrix';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';
import { PermissionsCoordinator } from '../resolver';
import { RelatedResolverIdTypes } from '../types';

import { ScopeRel } from './types';

interface CacheItem<Entity extends EntityWithPermission> {
    entity: Entity | null;
    roles: Role[];
}

export class AgentPermissionHelper<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> {
    private readonly cache = new Map<ID, CacheItem<Entity>>();
    private readonly permissionsCache = new Map<ID, PermissionFromEntity<Entity>[]>();

    constructor(
        public readonly matrix: PermissionsCoordinator<ID, Entity>,
        private readonly relations: Map<string, AgentPermissionHelper>,
        /**
         * Начальный scope, все остальные будут его расширять
         */
        public readonly baseScope: Readonly<ScopeType>,
        /**
         * Начальные роли, назначение которых не зависит от entity
         */
        private readonly baseRoles: Role[],
        private readonly getDependents: () => AgentPermissionHelper[],
    ) {}

    getEntityId(entity: ID | Entity): ID {
        return isID(entity) ? entity : this.matrix.getId(entity);
    }

    async prepare(entities?: ID | Entity | (Entity | ID | undefined)[]): Promise<void> {
        if (!entities) {
            return;
        }

        if (!Array.isArray(entities)) {
            entities = [entities];
        }

        const ids = this.getNewEntityIds(entities);

        if (!ids.length) {
            return;
        }

        const targets = await this.matrix.getEntities(ids);

        const foundIds = new Set<ID>();
        const unFoundIds = new Set<ID>(ids);

        targets.forEach((entity) => {
            const id = this.matrix.getId(entity);

            foundIds.add(id);

            this.cache.set(id, { entity, roles: [] });
            unFoundIds.delete(id);
        });

        unFoundIds.forEach((id) => this.cache.set(id, { entity: null, roles: [] }));

        if (!foundIds.size) {
            return;
        }

        await Promise.all([
            this.matrix.updateRoles(foundIds, targets, this.cache, this.baseScope),
            this.prepareRelated(targets),
        ]);
    }

    canGetPermissionsSync(target?: Entity | ID): boolean {
        if (!target) {
            return true;
        }

        const id = this.getEntityId(target);

        if (this.permissionsCache.has(id)) {
            return true;
        }

        const cache = this.cache.get(id);

        if (!cache) {
            return false;
        }

        const { entity, roles } = cache;

        if (!entity) {
            this.permissionsCache.set(id, []);

            return true;
        }

        const totalRoles = [...this.baseRoles, ...roles];

        const relations: Record<string, any> = {};

        const debugInfo: Record<string, GraphDebug> = {};

        const refs = (entity ? this.matrix.getReferences(entity) : {}) as Record<string, any>;

        this.relations.forEach((resolver, key) => {
            relations[key] = resolver.getPermissions(refs[key]);
            debugInfo[key] = resolver.matrix.getLastDebugInfo();
        });

        const permissions = this.matrix.resolvePermissions(
            totalRoles,
            this.baseScope,
            entity,
            relations,
        );

        this.permissionsCache.set(id, permissions);

        return true;
    }

    getPermissions(entity?: Entity | ID): PermissionFromEntity<Entity>[] {
        if (!entity) {
            return [];
        }

        if (this.canGetPermissionsSync(entity)) {
            const id = isID(entity) ? entity : this.matrix.getId(entity);

            return this.permissionsCache.get(id)!;
        } else {
            throw new Error('Not found prepared scope.\n' + 'Did you forgot call prepare?');
        }
    }

    existsSync(entity?: Entity | ID): boolean {
        if (!entity) {
            return false;
        }

        if (!this.canGetPermissionsSync(entity)) {
            throw new Error('Not found prepared scope.\n' + 'Did you forgot call prepare?');
        }

        const id = isID(entity) ? entity : this.matrix.getId(entity);

        const cache = this.cache.get(id);

        return Boolean(cache && cache.entity);
    }

    async prepareScope(scope?: ScopeRel<Related>): Promise<void> {
        if (!scope) {
            return;
        }

        await Promise.all(
            [...this.relations.keys()].map((key) => {
                const resolver = this.relations.get(key)!;

                return resolver.prepare(scope[key]);
            }),
        );
    }

    canGetListPermissionsSync(scope?: ScopeRel<Related>): boolean {
        if (!scope) {
            return true;
        }

        return Object.keys(scope).every((key) => {
            const resolver = this.relations.get(key);

            if (!resolver) {
                throw new Error(`[RBAC ${this.matrix.name}] prepareScope: invalid relation ${key}`);
            }

            return resolver.canGetPermissionsSync(scope[key]);
        });
    }

    getListPermissions(scope?: ScopeRel<Related>): PermissionFromEntity<Entity>[] {
        if (!this.canGetListPermissionsSync(scope)) {
            throw new Error('Not found prepared scope.\n' + 'Did you forgot call prepare?');
        }

        const relations: Record<string, any> = {};
        const debugInfo: Record<string, GraphDebug> = {};
        const scopeRecord = scope as Record<string, any> | undefined;

        [...this.relations.keys()].forEach((key) => {
            const resolver = this.relations.get(key)!;

            relations[key] = resolver.getPermissions(scopeRecord ? scopeRecord[key] : undefined);
            debugInfo[key] = resolver.matrix.getLastDebugInfo();
        });

        return this.matrix.resolvePermissions(this.baseRoles, this.baseScope, null, relations);
    }

    invalidate(_entities?: ID | Entity | (Entity | ID)[]): void {
        this.clearCache();
    }

    clearCache(): void {
        this.cache.clear();
        this.permissionsCache.clear();

        this.getDependents().forEach((dependent) => dependent.clearCache());
    }

    getLastDebugInfo(): GraphDebug {
        return this.matrix.getLastDebugInfo();
    }

    /**
     * Получение идентификаторов сущностей, которые еще не были обработаны
     */
    private getNewEntityIds(entities: (ID | Entity | undefined)[]): ID[] {
        const set = new Set<ID>();

        entities.forEach((entity) => {
            if (!entity) {
                return;
            }

            const id = isID(entity) ? entity : this.matrix.getId(entity);

            if (this.cache.has(id)) {
                return;
            }

            set.add(id);
        });

        return Array.from(set);
    }

    private async prepareRelated(targets: Entity[]): Promise<void[]> {
        if (!targets.length) {
            return [];
        }

        const list = Object.keys(this.matrix.relatedResolvers);

        if (!list.length) {
            return [];
        }

        const relatedEntities: Record<string, (string | number | undefined)[]> = {};

        list.forEach((key) => (relatedEntities[key] = []));

        targets.forEach((entity) => {
            const refs = this.matrix.getReferences(entity);

            for (const key of list) {
                relatedEntities[key].push(refs[key]);
            }
        });

        return Promise.all(
            list.map((key) => {
                const resolver = this.relations.get(key)!;

                return resolver.prepare(relatedEntities[key]);
            }),
        );
    }
}

function isID<ID extends number | string>(id: ID | EntityWithPermission): id is ID {
    return typeof id === 'string' || typeof id === 'number';
}
