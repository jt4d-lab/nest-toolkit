import { EntityWithPermission } from '../permissions';
import { PermissionsResolverType } from '../resolver';
import { RelatedResolverIdTypes } from '../types';

import { RBACAgentManager, RBACGetter } from './manager';

export interface RBACAgent {
    <
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(
        rbac: PermissionsResolverType<ID, Entity, Related>,
    ): RBACGetter<ID, Entity, Related>;
}

export function RBACAgent(manager: RBACAgentManager): RBACAgent {
    return <
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(
        rbac: PermissionsResolverType<ID, Entity, Related>,
    ): RBACGetter<ID, Entity, Related> => {
        return manager.getGetter(rbac);
    };
}
