import { uniq } from 'lodash';

import { ScopeType } from '..';
import { EmptyObject } from '../empty-object';
import {
    Definition,
    ItemType,
    PermissionDefinitionTableCreator,
    PermissionMatrix,
    RelatedEntities,
    RelatedPermission,
    Role,
} from '../matrix';
import { createPermissionMatrix } from '../matrix/matrix';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';

import { IUpdateRoleAgent, PermissionsResolverMeta, PermissionsResolverService } from './types';

export class PermissionsCoordinator<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedEntities = EmptyObject,
> {
    // turn to private if possible
    public readonly matrix: PermissionMatrix<Entity, Related>;
    public readonly permissions: Record<PermissionFromEntity<Entity>, Definition<Entity>[]>;

    public readonly name: string;
    public resolvePermissions: PermissionMatrix<Entity, Related>['resolvePermissions'];
    public getLastDebugInfo: PermissionMatrix<Entity, Related>['getLastDebugInfo'];

    private readonly getIdOriginal: (entity: Entity) => ID;

    constructor(
        meta: PermissionsResolverMeta<ID, Entity>,
        private readonly service: PermissionsResolverService<ID, Entity>,
        public readonly relatedResolvers: Record<string, PermissionsCoordinator>,
    ) {
        this.name = meta.name;
        this.matrix = this.createPermissionMatrix(this.name, meta.matrix, relatedResolvers);
        this.permissions = this.matrix.permissions;
        this.getIdOriginal = meta.getId;
        this.resolvePermissions = this.matrix.resolvePermissions;
        this.getLastDebugInfo = this.matrix.getLastDebugInfo;

        if (!relatedResolvers) {
            this.relatedResolvers = {};
        }
    }

    public getId(entity: Entity): ID {
        const id = this.getIdOriginal(entity);

        if (typeof id !== 'number' && typeof id !== 'string') {
            throw new Error(`[RBAC ${this.name}]: getId must return a number or a string`);
        }

        return id;
    }

    public getReferences(entity: Entity) {
        if (!entity || !this.service.getReferences) {
            return {};
        }

        return this.service.getReferences?.(entity);
    }

    /**
     * Обновление ролей сущностей
     * @param ids ID сущностей
     * @param entities Сущности (должны быть все из ids)
     * @param roleStorage Хранилище ролей сущностей (должны быть инициализированны все из ids)
     * @param context Контекст
     */
    public async updateRoles(
        ids: Set<ID>,
        entities: Entity[],
        roleStorage: Map<ID, { roles: Role[] }>,
        context: Readonly<ScopeType>,
    ): Promise<void> {
        if (!this.service.updateRoles) {
            return;
        }

        if (!ids.size) {
            return;
        }

        return this.service.updateRoles({
            ids,
            entities,
            agent: new UpdateRoleAgent(this.name, ids, roleStorage),
            context,
        });
    }

    public async getEntities(ids: ID[]): Promise<Entity[]> {
        const entities = await this.service.getEntities(ids);

        if (!Array.isArray(entities)) {
            throw new Error(`[RBAC ${this.name}]: getEntities must return an array`);
        }

        return entities;
    }

    private createPermissionMatrix(
        name: string,
        permissionsCreator: PermissionDefinitionTableCreator<Entity, Related>,
        relatedCoordinators: Record<string, PermissionsCoordinator>,
    ) {
        const relations: Record<string, Record<string, RelatedPermission>> = {};

        for (const relationKey in relatedCoordinators) {
            const coordinator = relatedCoordinators[relationKey];

            const relatedPermissions: Record<string, RelatedPermission> = {};

            Object.keys(coordinator.permissions).forEach((permission) => {
                relatedPermissions[permission] = {
                    type: ItemType.RelatedPermission,
                    name: permission,
                    relation: relationKey,
                };
            });

            relations[relationKey] = relatedPermissions;
        }

        return createPermissionMatrix(name, permissionsCreator, relations as any);
    }
}

class UpdateRoleAgent<ID extends number | string> implements IUpdateRoleAgent<ID> {
    private lastId?: ID;
    private lastRoles: Role[] = [];

    constructor(
        private readonly matrixName: string,
        private readonly ids: Set<ID>,
        private readonly storage: Map<ID, { roles: Role[] }>,
    ) {}

    add(id: ID, ...roles: Role[]): void {
        this.processRoles(id, (currentRoles) => uniq([...currentRoles, ...roles]));
    }
    remove(id: ID, ...roles: Role[]): void {
        this.processRoles(id, (currentRoles) =>
            currentRoles.filter((role) => !roles.includes(role)),
        );
    }
    get(id: ID): Role[] {
        this.checkId(id);

        return this.storage.get(id)!.roles;
    }
    set(id: ID, roles: Role[]): void {
        this.processRoles(id, () => uniq(roles));
    }

    private processRoles(id: ID, callback: (roles: Role[]) => Role[]) {
        if (this.lastId === id) {
            this.lastRoles = callback(this.lastRoles)!;
        } else {
            this.checkId(id);
            this.lastId = id;
            this.lastRoles = callback(this.storage.get(id)!.roles);
        }

        this.storage.get(id)!.roles = this.lastRoles;
    }

    private checkId(id: ID) {
        if (!this.ids.has(id)) {
            throw new Error(`[RBAC ${this.matrixName}] updateRoles: id ${id} no in scope`);
        }
    }
}
