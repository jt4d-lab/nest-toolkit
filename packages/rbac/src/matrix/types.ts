import { EntityWithPermission, PermissionFromEntity } from '@src/common/rbac';

import { GraphDebug } from './graph.types';
import { Operators } from './operators';

export enum ItemType {
    Role = 'ΔRole',
    Rule = 'ΔRule',
    AndOperator = 'ΔAndOperator',
    OrOperator = 'ΔOrOperator',
    Permission = 'ΔPermission',
    RelatedPermission = 'ΔRelatedPermission',
    Matrix = 'ΔMatrix',
}

/**
 * Роль: набор разрешений, связанных с определенной функцией или позицией в организации.
 *
 * Роль определяет, какие операции или доступ к ресурсам могут выполнять пользователи, назначенные этой роли.
 */
export interface Role {
    readonly type: ItemType.Role;
    readonly name: string;
    readonly extendRoles: Role[];
}

/**
 * Разрешение: право на выполнение определенной операции или доступ к определенным ресурсам
 */
export interface Permission {
    readonly type: ItemType.Permission;
    readonly name: string;
}

/**
 * Разрешение: право на выполнение определенной операции или доступ к определенным ресурсам
 */
export interface RelatedPermission {
    readonly type: ItemType.RelatedPermission;
    readonly name: string;
    readonly relation: string;
}

/**
 * Правило: условие или набор условий, определяющих, когда и как разрешение должно быть применено
 */
export interface Rule<
    Entity extends EntityWithPermission = {},
    Scope extends ScopeType = ScopeType,
> {
    readonly type: ItemType.Rule;
    readonly name: string;
    readonly deps: (Role | Rule<Entity, Scope>)[];
    readonly opts: { allowEmpty?: boolean };
    checkAccess(entity: Entity, scope: Scope): boolean;
}

export type Definition<Entity extends EntityWithPermission, Scope extends ScopeType = ScopeType> =
    | AndOperator<Entity>
    | OrOperator<Entity>
    | Role
    | Rule<Entity, Scope>
    | RelatedPermission;

/**
 * Скоуп - это мапа данных которая характеризует сущность с точки зрения ролей.
 * Все сущности с одинаковым скоупом имеют одинаковые роли.
 */
export interface ScopeType {
    [key: string]: string | number;
}

/**
 * Матрица разрешений - структурированное представление всех разрешений, определенных в системе, относящийся к сущностям
 */
export interface PermissionMatrix<
    Entity extends EntityWithPermission,
    Related extends RelatedEntities = {},
> {
    readonly type: ItemType.Matrix;
    readonly name: string;
    readonly permissions: Record<PermissionFromEntity<Entity>, Definition<Entity>[]>;
    resolvePermissions(
        roles: Role[],
        scope: ScopeType,
        entity?: Entity | null,
        relations?: CalculatedRelations<Related>,
    ): PermissionFromEntity<Entity>[];
    getLastDebugInfo(): GraphDebug;
}

export interface AndOperator<
    Entity extends EntityWithPermission = {},
    Scope extends ScopeType = ScopeType,
> {
    readonly type: ItemType.AndOperator;
    readonly name: string;
    readonly deps: Definition<Entity, Scope>[];
}

export interface OrOperator<
    Entity extends EntityWithPermission = {},
    Scope extends ScopeType = ScopeType,
> {
    readonly type: ItemType.OrOperator;
    readonly name: string;
    readonly deps: Definition<Entity, Scope>[];
}

/**
 * Типы связанных сущностей
 */
export type RelatedEntities = Record<string, EntityWithPermission>;

/**
 * Мапа с сформированными элементами графа разрешений
 */
export type RelatedPermissionMap<Related extends RelatedEntities> = {
    [K in keyof Related]: { [Permission in PermissionFromEntity<Related[K]>]: RelatedPermission };
};

/**
 * Посчитанные разрешения связанных сущностей
 */
export type CalculatedRelations<Related extends RelatedEntities> = {
    [K in keyof Related]: PermissionFromEntity<Related[K]>[];
};
export interface PermissionDefinitionTableCreator<
    Entity extends EntityWithPermission,
    Related extends RelatedEntities = {},
> {
    (
        operators: Operators<Entity>,
        relations: RelatedPermissionMap<Related>,
    ): PermissionDefinitionTable<Entity>;
}

export type PermissionDefinitionTable<Entity extends EntityWithPermission> = Record<
    PermissionFromEntity<Entity>,
    Definition<Entity> | Definition<Entity>[]
>;
