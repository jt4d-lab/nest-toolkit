import { EntityWithPermission } from '../permissions';

import { andOperator, orOperator } from './graph-operators';
import {
    NodeType,
    OperatorNode,
    PermissionNode,
    RelatedPermissionNode,
    RoleNode,
    RootNode,
    RuleNode,
} from './graph.types';
import { ScopeType } from './types';

export function createRootNode<Entity extends EntityWithPermission = EntityWithPermission>(
    name: string,
): RootNode<Entity> {
    return {
        type: NodeType.Root,
        name,
        calculate: orOperator,
        children: [],
    };
}

export function createPermissionNode<Entity extends EntityWithPermission = EntityWithPermission>(
    permission: string,
): PermissionNode<Entity> {
    return {
        type: NodeType.Permission,
        name: permission,
        calculate: orOperator,
        children: [],
    };
}

export function createRelatedPermissionNode<
    Entity extends EntityWithPermission = EntityWithPermission,
>(permission: string, relation: string): RelatedPermissionNode<Entity> {
    return {
        type: NodeType.RelatedPermission,
        name: permission,
        relation,
        calculate: ({ relations }) => {
            if (!relations[relation]) {
                throw new Error(`Relation "${relation}" not found`);
            }

            return relations[relation].includes(permission);
        },
        children: [],
    };
}

export function createRoleNode<Entity extends EntityWithPermission = EntityWithPermission>(
    role: string,
): RoleNode<Entity> {
    return {
        type: NodeType.Role,
        name: role,
        calculate: ({ roles }) => roles.includes(role),
        children: [],
    };
}

export function createRuleNode<Entity extends EntityWithPermission = EntityWithPermission>(
    name: string,
    rule: (entity: Entity | undefined, scope: ScopeType) => boolean,
    opts: { allowEmpty?: boolean } = {},
): RuleNode<Entity> {
    return {
        type: NodeType.Rule,
        name,
        calculate: (context, entity) => {
            if (!entity && !opts.allowEmpty) {
                return false;
            }

            return rule(entity, context.scope);
        },
        children: [],
    };
}

export function createOperatorNode<Entity extends EntityWithPermission = EntityWithPermission>(
    operator: 'OR' | 'AND',
): OperatorNode<Entity> {
    return {
        type: NodeType.Operator,
        name: operator,
        calculate: operator === 'OR' ? orOperator : andOperator,
        children: [],
    };
}
