import { EntityWithPermission } from '../permissions';

import { BaseNode, EntityContext } from './graph.types';

export function orOperator<Entity extends EntityWithPermission>(
    this: Pick<BaseNode<Entity>, 'children'>,
    context: EntityContext,
    entity?: Entity,
) {
    return this.children.some((child) => child.calculate(context, entity));
}

export function andOperator<Entity extends EntityWithPermission>(
    this: Pick<BaseNode<Entity>, 'children'>,
    context: EntityContext,
    entity?: Entity,
) {
    return this.children.every((child) => child.calculate(context, entity));
}
