import { Required } from 'utility-types';

import { EntityWithPermission } from '@src/common/rbac';

import { PermissionDefinitionTableCreator, Role, ScopeType } from '../matrix';
import { EntitiesFromRelatedMatrix, RelatedResolverIdTypes, RelatedResolvers } from '../types';

export type Type<T> = new (...args: any[]) => T;

export interface PermissionsResolverMeta<
    ID extends number | string,
    Entity extends EntityWithPermission,
    Related extends RelatedResolvers = {},
> {
    /**
     * Имя матрицы разрешений
     */
    name: string;
    /**
     * Получение идентификатора сущности
     */
    getId(entity: Entity): ID;
    /**
     * Матрица разрешений
     */
    matrix: PermissionDefinitionTableCreator<Entity, EntitiesFromRelatedMatrix<Related>>;
    /**
     * Связанные матрицы разрешений
     */
    relations: Related;
}

export interface UpdateRolesProps<
    ID extends number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
> {
    ids: Set<ID>;
    entities: Entity[];
    agent: IUpdateRoleAgent<ID>;
    context: Readonly<ScopeType>;
}

export interface IUpdateRoleAgent<ID extends number | string = number | string> {
    add(id: ID, ...roles: Role[]): void;
    remove(id: ID, ...roles: Role[]): void;
    get(id: ID): Role[];
    set(id: ID, roles: Role[]): void;
}

/**
 * Интерфейс сервиса для правил RBAC без связей
 */
export interface PermissionsResolverService<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> {
    /**
     * Получение сущностей по ID
     */
    getEntities(ids: ID[]): Promise<Entity[]>;

    /**
     * Получение связей сущности
     * @param entity
     */
    getReferences?(
        entity: Entity,
    ): Related extends null ? Record<string, string | number | undefined> : Related;

    /**
     * Получение ролей по ID сущностей
     */
    updateRoles?(props: UpdateRolesProps<ID>): Promise<void>;
}

export type PermissionsResolver<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> = Related extends null
    ? Exclude<PermissionsResolverService<ID, Entity, Related>, 'getReferences'>
    : Required<PermissionsResolverService<ID, Entity, Related>, 'getReferences'>;

export type PermissionsResolverType<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> = Type<PermissionsResolver<ID, Entity, Related>>;

export type RelatedResolverIds<T extends Exclude<RelatedResolvers, null>> = {
    [K in keyof T]: RelatedResolverId<T[K]>;
};

interface PermissionsResolverGetEntities<ID extends string | number> {
    getEntities(ids: ID[]): Promise<any>;
}

type RelatedResolverId<T extends Type<PermissionsResolverGetEntities<any>>> =
    T extends Type<PermissionsResolverGetEntities<infer ID>> ? ID | undefined : never;
