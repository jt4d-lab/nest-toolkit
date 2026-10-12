import { EntityWithPermission } from '@src/common/rbac';

import { createRule } from './items';
import { AndOperator, Definition, ItemType, OrOperator, Rule, ScopeType } from './types';

export class Operators<Entity extends EntityWithPermission> {
    and(...deps: Definition<Entity>[]): AndOperator<Entity> {
        if (deps.length < 2) {
            throw new Error('At least two rules are required');
        }

        return {
            type: ItemType.AndOperator,
            name: 'operator:and',
            deps,
        };
    }
    or(...deps: Definition<Entity>[]): OrOperator<Entity> {
        if (deps.length < 2) {
            throw new Error('At least two rules are required');
        }

        return {
            type: ItemType.OrOperator,
            name: 'operator:or',
            deps,
        };
    }
    createRule(
        name: string,
        execute: (entity: Entity, scope: ScopeType) => boolean,
        opts: { allowEmpty?: boolean } = {},
    ): Rule<Entity> {
        return createRule<Entity>(name, execute, opts);
    }
    eq<Field extends keyof Omit<Entity, keyof EntityWithPermission>>(
        field: Field,
        value: Entity[Field],
        ...moreValues: Entity[Field][]
    ) {
        if (!moreValues.length) {
            return createRule<Entity>(`${String(field)} is '${value}'`, (entity) => {
                return entity[field] === value;
            });
        }

        moreValues.unshift(value);

        return createRule<Entity>(
            `${String(field)} has value from list ${moreValues
                .map(String)
                .map((item) => `'${item}'`)
                .join(', ')}`,
            (entity) => {
                return moreValues.includes(entity[field]);
            },
        );
    }
    notEq<Field extends keyof Omit<Entity, keyof EntityWithPermission>>(
        field: Field,
        value: Entity[Field],
        ...moreValues: Entity[Field][]
    ) {
        if (!moreValues.length) {
            return createRule<Entity>(`${String(field)} is not "${value}"`, (entity) => {
                return entity[field] !== value;
            });
        }

        moreValues.unshift(value);

        return createRule<Entity>(
            `${String(field)} has no value from list ${moreValues.map(String).join(', ')}`,
            (entity) => {
                return !moreValues.includes(entity[field]);
            },
        );
    }
}
