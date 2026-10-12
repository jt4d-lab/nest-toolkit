import { EmptyObject } from '../empty-object';
import { EntityWithPermission, PermissionFromEntity } from '../permissions';

import { CalculatedRelations, RelatedEntities, ScopeType } from './types';

export interface RBACGraph<
    Entity extends EntityWithPermission,
    Related extends RelatedEntities = EmptyObject,
> {
    name: string;
    calculate(context: EntityContext<Related>, entity?: Entity): PermissionFromEntity<Entity>[];
    getLastDebugInfo(): GraphDebug;
}

export enum NodeType {
    Root = 'root',
    Permission = 'permission',
    RelatedPermission = 'related-permission',
    Operator = 'operator',
    Rule = 'rule',
    Role = 'role',
}

export interface NodeExport {
    type: NodeType;
    name: string;
    children?: number[];
}

export interface CalculateFunction<Entity extends EntityWithPermission> {
    (this: Pick<BaseNode<Entity>, 'children'>, context: EntityContext, entity?: Entity): boolean;
}

export interface BaseNode<Entity extends EntityWithPermission> {
    type: NodeType;
    name: string;
    children: BaseNode<Entity>[];
    calculate: CalculateFunction<Entity>;
}

export interface RootNode<Entity extends EntityWithPermission> extends BaseNode<Entity> {
    type: NodeType.Root;
}

export interface PermissionNode<Entity extends EntityWithPermission> extends BaseNode<Entity> {
    type: NodeType.Permission;
}

export interface RelatedPermissionNode<
    Entity extends EntityWithPermission,
> extends BaseNode<Entity> {
    type: NodeType.RelatedPermission;
    relation: string;
}

export interface RoleNode<Entity extends EntityWithPermission> extends BaseNode<Entity> {
    type: NodeType.Role;
}

export interface OperatorNode<Entity extends EntityWithPermission> extends BaseNode<Entity> {
    type: NodeType.Operator;
}

export interface RuleNode<Entity extends EntityWithPermission> extends BaseNode<Entity> {
    type: NodeType.Rule;
    name: string;
}

export type AnyNode<Entity extends EntityWithPermission> =
    | RootNode<Entity>
    | PermissionNode<Entity>
    | RelatedPermissionNode<Entity>
    | OperatorNode<Entity>
    | RuleNode<Entity>
    | RoleNode<Entity>;

export interface GraphDebug {
    nodes: NodeExport[];
    calculations: (boolean | undefined)[];
}

export interface EntityContext<
    Related extends RelatedEntities = Record<string, EntityWithPermission>,
> {
    roles: string[];
    scope: ScopeType;
    relations: CalculatedRelations<Related>;
}
