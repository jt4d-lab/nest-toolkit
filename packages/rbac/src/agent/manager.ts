import { getMeta } from '../decorators';
import { Logger } from '../logger';
import { Role, ScopeType } from '../matrix';
import { EntityWithPermission } from '../permissions';
import { PermissionsCoordinator, PermissionsResolverType } from '../resolver';
import { RelatedResolverIdTypes } from '../types';

import { AgentPermissionHelper } from './agent-permission-helper';
import { RBACEntityAgent } from './entity-agent';
import { EntityAgentLogs } from './entity-agent-logs';
import { RBACListAgent } from './list-agent';
import { ListAgentLogs } from './list-agent-logs';
import { IAgentManagerService } from './types';

export interface RBACGetter<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> {
    entity: RBACEntityAgent<ID, Entity, Related>;
    list: RBACListAgent<ID, Entity, Related>;
}

interface Item<
    ID extends number | string = number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
    Related extends RelatedResolverIdTypes = null,
> {
    allowed?: boolean;
    getter?: RBACGetter<ID, Entity, Related>;
    helper?: AgentPermissionHelper<ID, Entity>;
    entity?: RBACEntityAgent<ID, Entity, Related>;
    list?: RBACListAgent<ID, Entity, Related>;
    related?: PermissionsCoordinator[];
}

export class RBACAgentManager {
    private readonly items = new Map<string, Item<any, any, any>>();

    constructor(
        private readonly service: IAgentManagerService,
        private readonly baseScope: ScopeType,
        private readonly baseRoles: Role[],
        private readonly logger: Logger,
    ) {
        service.availableMatrices.forEach((matrix) =>
            this.items.set(getMeta(matrix).name, {
                allowed: true,
            }),
        );
    }

    getGetter<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): RBACGetter<ID, Entity, Related> {
        return this.getAllowedItem(rbac).getter || this.buildGetter(rbac);
    }

    getEntityAgent<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): RBACEntityAgent<ID, Entity, Related> {
        return this.getAllowedItem(rbac).entity || this.buildEntityAgent(rbac);
    }

    getListAgent<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): RBACListAgent<ID, Entity, Related> {
        return this.getAllowedItem(rbac).list || this.buildListAgent(rbac);
    }

    getHelperByResolver<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): AgentPermissionHelper<ID, Entity> {
        const item = this.getItem(rbac);

        if (!item.helper) {
            const matrix = this.service.getPermissionMatrix<ID, Entity>(rbac);

            if (!matrix) {
                throw new Error(`[RBAC] Can not find matrix ${rbac.name}`);
            }

            item.helper = this.getHelper(matrix);
        }

        return item.helper;
    }

    private getHelper<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
    >(coordinator: PermissionsCoordinator<ID, Entity>): AgentPermissionHelper<ID, Entity> {
        const name = coordinator.name;

        const item = this.getOrCreateItem(name);

        if (item.helper) {
            return item.helper as AgentPermissionHelper<ID, Entity>;
        }

        const relations = new Map<string, AgentPermissionHelper<any, any>>();
        const related: PermissionsCoordinator[] = [];

        Object.entries(coordinator.relatedResolvers).forEach(
            ([key, relation]: [string, PermissionsCoordinator<any, any>]) => {
                relations.set(key, this.getHelper(relation));
                related.push(relation);
            },
        );

        const helper = new AgentPermissionHelper<ID, Entity>(
            coordinator,
            relations,
            this.baseScope,
            this.baseRoles,
            () => this.getDependents(coordinator),
        );

        item.helper = helper;
        item.related = related;

        return helper;
    }

    /**
     * Получить всех зависимых агентов от указанного coordinator
     */
    private getDependents(
        coordinator: PermissionsCoordinator<any, any>,
    ): AgentPermissionHelper<any, any>[] {
        const result: AgentPermissionHelper<any, any>[] = [];

        this.items.forEach(({ related, helper }) => {
            if (related && related.includes(coordinator) && helper) {
                result.push(helper);
            }
        });

        return result;
    }

    private getAllowedItem<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): Item<ID, Entity, Related> {
        const item = this.getItem(rbac);

        if (!item.allowed) {
            throw new Error(
                `[RBAC] Can not use unregistered in this module matrix ${getMeta(rbac).name}`,
            );
        }

        return item;
    }

    private getItem<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: string | PermissionsResolverType<ID, Entity, Related>): Item<ID, Entity, Related> {
        const name = typeof rbac === 'string' ? rbac : getMeta(rbac).name;

        const item = this.items.get(name);

        if (!item) {
            throw new Error(`[RBAC] Can not use unregistered in this module matrix ${name}`);
        }

        return item as Item<ID, Entity, Related>;
    }

    private getOrCreateItem(name: string): Item<any, any, any> {
        const item = this.items.get(name);

        if (item) {
            return item;
        }

        const newItem = {} as Item<any, any, any>;

        this.items.set(name, newItem);

        return newItem;
    }

    private buildGetter<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): RBACGetter<ID, Entity, Related> {
        const getter = {} as RBACGetter<ID, Entity, Related>;

        Object.defineProperties(getter, {
            entity: {
                get: () => {
                    return this.getEntityAgent(rbac);
                },
            },
            list: {
                get: () => {
                    return this.getListAgent(rbac);
                },
            },
        });

        this.getItem(rbac).getter = getter;

        return getter;
    }

    private buildEntityAgent<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): RBACEntityAgent<ID, Entity, Related> {
        const helper = this.getHelperByResolver(rbac);
        const agent = new RBACEntityAgent(
            helper,
            () => this.getListAgent(rbac),
            new EntityAgentLogs(this.logger, helper),
        );

        this.getItem(rbac).entity = agent;

        return agent;
    }

    private buildListAgent<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolverIdTypes = null,
    >(rbac: PermissionsResolverType<ID, Entity, Related>): RBACListAgent<ID, Entity, Related> {
        const helper = this.getHelperByResolver(rbac);
        const agent = new RBACListAgent(
            helper,
            () => this.getEntityAgent(rbac),
            new ListAgentLogs(this.logger, helper),
        );

        this.getItem(rbac).list = agent;

        return agent;
    }
}
