import { EntityWithPermission, PermissionFromEntity } from '../permissions';

import {
    createOperatorNode,
    createPermissionNode,
    createRelatedPermissionNode,
    createRoleNode,
    createRootNode,
    createRuleNode,
} from './graph-nodes';
import { AnyNode, BaseNode, NodeExport, RBACGraph } from './graph.types';
import { Definition, ItemType, PermissionDefinitionTable, ScopeType } from './types';

interface NodeWithId<Entity extends EntityWithPermission> extends BaseNode<Entity> {
    id: number;
    children: NodeWithId<Entity>[];
}

export function buildGraph<Entity extends EntityWithPermission>(
    name: string,
    permissionDefinitionTable: PermissionDefinitionTable<Entity>,
): RBACGraph<Entity> {
    const items: NodeWithId<Entity>[] = [];
    const debug: {
        calculations: (boolean | undefined)[];
    } = {
        calculations: [],
    };

    const root = addNode(createRootNode(name));

    root.children = Array.from(Object.keys(permissionDefinitionTable)).map((perm) =>
        addNode(createPermissionNode(perm)),
    );

    root.children.forEach((permission) => {
        const rawDefinition =
            permissionDefinitionTable[permission.name as PermissionFromEntity<Entity>];
        const definition = Array.isArray(rawDefinition) ? rawDefinition : [rawDefinition];

        permission.children.push(...definition.map((def) => buildBranch(def)));
    });

    const exportedNodes: NodeExport[] = items.map((node) => {
        const result: NodeExport = {
            type: node.type,
            name: node.name,
        };

        const children = node.children?.map((child) => child.id);

        if (children && children.length) {
            result.children = children;
        }

        return result;
    });

    return {
        name,
        calculate: (context, entity) => {
            debug.calculations = [];

            return root.children
                .filter((child) => child.calculate(context, entity))
                .map((child) => child.name as PermissionFromEntity<Entity>);
        },
        getLastDebugInfo: () => {
            return {
                nodes: exportedNodes,
                calculations: debug.calculations,
                children: [],
            };
        },
    };

    function buildBranch(item: Definition<Entity>): NodeWithId<Entity> {
        switch (item.type) {
            case ItemType.Role:
                return addNode(createRoleNode(item.name));
            case ItemType.Rule:
                return addNode(
                    createRuleNode(
                        item.name,
                        item.checkAccess as (
                            entity: Entity | undefined,
                            scope: ScopeType,
                        ) => boolean,
                        item.opts,
                    ),
                );

            case ItemType.AndOperator: {
                const operator = addNode(createOperatorNode('AND'));

                item.deps.forEach((dep) => {
                    const child = buildBranch(dep);

                    operator.children.push(child);
                });

                return operator;
            }

            case ItemType.OrOperator: {
                const operator = addNode(createOperatorNode('OR'));

                item.deps.forEach((dep) => {
                    const child = buildBranch(dep);

                    operator.children.push(child);
                });

                return operator;
            }

            case ItemType.RelatedPermission:
                return addNode(createRelatedPermissionNode(item.name, item.relation));

            default:
                // @ts-expect-error проверим что все варианты обработаны
                throw new Error(`Unknown item type: ${item.type}`);
        }
    }

    function addNode(node: AnyNode<Entity>): NodeWithId<Entity> {
        const id = items.length;
        const extendedNode: NodeWithId<Entity> = {
            ...node,
            id,
        } as any;

        extendedNode.calculate = (context, entity) => {
            const result = node.calculate(context, entity);

            debug.calculations[id] = result;

            return result;
        };

        items.push(extendedNode);

        return extendedNode;
    }
}
