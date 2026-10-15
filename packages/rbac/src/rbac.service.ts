import { Inject, Injectable, Optional, Type } from '@nestjs/common';

import { RBACAgentManager } from './agent/manager';
import { IAgentManagerService } from './agent/types';
import { getMeta } from './decorators';
import { EmptyObject } from './empty-object';
import { DefaultRBACLogger } from './logging';
import type { RBACLogger } from './logging';
import { RelatedEntities, Role, ScopeType, SystemRoles } from './matrix';
import { EntityWithPermission } from './permissions';
import { RBAC_BASE_RESOLVER, RBAC_FEATURE_MATRICES, RBAC_LOGGER } from './rbac.providers';
import type {
    BaseResolver,
    GetBaseRoles,
    GetBaseScope,
    GetBaseScopeResult,
} from './rbac.providers';
import { PermissionsCoordinator } from './resolver';
import type {
    PermissionsResolver,
    PermissionsResolverMeta,
    PermissionsResolverType,
} from './resolver';
import { RelatedResolverIdTypes, RelatedResolvers, RelationTypes } from './types';

interface IRbacServiceCore {
    getBaseScope: GetBaseScope;
    getBaseRoles: GetBaseRoles;
}

interface RawPermissionsResolver {
    meta: PermissionsResolverMeta<any, any>;
    type: Type<PermissionsResolver>;
    service?: PermissionsResolver<any, any>;
}

interface InstanceResolver {
    resolve(matrix: Type<PermissionsResolver>): Promise<PermissionsResolver>;
}

@Injectable()
export class RbacServiceCore implements IRbacServiceCore {
    baseResolver: BaseResolver;
    logger?: RBACLogger;

    private rawMatrices = new Map<string, RawPermissionsResolver>();
    private matrices = new Map<string, PermissionsCoordinator>();

    public getBaseScope(req: Request) {
        return this.baseResolver.getBaseScope(req);
    }

    public getBaseRoles(scope: ScopeType) {
        return this.baseResolver.getBaseRoles(scope);
    }

    public registerMatrix<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
    >(meta: PermissionsResolverMeta<ID, Entity>, type: Type<PermissionsResolver>): string {
        if (!meta) {
            throw new Error(`The matrix "${type.name}" is not decorated by @RBACMatrix`);
        }

        const matrix = this.rawMatrices.get(meta.name);

        if (matrix && matrix.type !== type) {
            throw new Error(
                [
                    `The matrix "${meta.name}" already registered`,
                    `previous: ${matrix.type.name}`,
                    `new: ${type.name}`,
                ].join('\n  '),
            );
        }

        this.rawMatrices.set(meta.name, {
            meta,
            type,
        });

        return meta.name;
    }

    getMatrix<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedEntities = EmptyObject,
    >(name: string): PermissionsCoordinator<ID, Entity, Related> {
        const item = this.matrices.get(name);

        if (!item) {
            throw new Error(`Matrix "${name}" not found`);
        }

        return item as unknown as PermissionsCoordinator<ID, Entity, Related>;
    }

    public async initMatrices(resolver: InstanceResolver): Promise<void> {
        const logger = this.logger ?? new DefaultRBACLogger();
        let matrices = Array.from(this.rawMatrices.values());

        for (const item of matrices) {
            await this.instantiateMatrix(item, resolver, logger);
        }

        matrices = reorderMatrices(this.rawMatrices);

        matrices.forEach((item) => this.initMatrix(item, logger));
    }

    private async instantiateMatrix(
        item: RawPermissionsResolver,
        resolver: InstanceResolver,
        logger: RBACLogger,
    ): Promise<void> {
        const name = item.meta.name;

        try {
            item.service = await resolver.resolve(item.type);
        } catch (error) {
            logger.matrixInstantiateFailed({
                matrix: name,
                type: item.type.name,
                error,
            });
            throw error;
        }
    }

    private initMatrix(item: RawPermissionsResolver, logger: RBACLogger): void {
        const name = item.meta.name;

        try {
            const service = getRawInstance(item);

            const relatedMatrices: Record<string, PermissionsCoordinator> = {};
            const relations = item.meta.relations as Record<string, PermissionsResolverType>;

            for (const relationKey in relations) {
                const value = relations[relationKey];
                const meta = getMeta(value);

                relatedMatrices[relationKey] = this.getMatrix(meta.name);
            }

            this.matrices.set(
                name,
                new PermissionsCoordinator(item.meta, service, relatedMatrices),
            );

            logger.matrixInitialized({ matrix: name });
        } catch (error) {
            logger.matrixInitFailed({
                matrix: name,
                type: item.type.name,
                error,
            });
            throw error;
        }
    }
}

@Injectable()
export class RbacService implements IAgentManagerService {
    private readonly moduleAllowedMatrices: string[];

    private readonly logger: RBACLogger;

    constructor(
        @Optional()
        @Inject(RBAC_LOGGER)
        logger: RBACLogger,
        private readonly core: RbacServiceCore,
        @Optional() @Inject(RBAC_BASE_RESOLVER) baseResolver: BaseResolver,
        @Optional()
        @Inject(RBAC_FEATURE_MATRICES)
        public readonly availableMatrices: PermissionsResolverType[],
    ) {
        this.logger = logger ?? new DefaultRBACLogger();
        this.core.logger = this.logger;

        if (baseResolver) {
            if (this.core.baseResolver) {
                throw new Error('Can not reset RBAC.baseResolver');
            }

            this.core.baseResolver = baseResolver;
        }

        if (availableMatrices) {
            this.moduleAllowedMatrices = availableMatrices.map((matrix) => {
                const meta = getMeta(matrix);

                this.core.registerMatrix(meta, matrix);

                return meta.name;
            });
        }
    }

    async createManagerByRequest(request: Request) {
        return this.createManager(this.core.getBaseScope(request));
    }

    async createManager(baseScope: GetBaseScopeResult, additionalRoles: Role[] = []) {
        const { loggedIn, scope } = baseScope;
        const roles = await this.core.getBaseRoles(scope);

        roles.push(...additionalRoles);

        const baseRoles = [
            SystemRoles.any,
            loggedIn ? SystemRoles.loggedIn : SystemRoles.guest,
            ...roles.flat().filter((item): item is Role => Boolean(item)),
        ];

        if (!this.availableMatrices) {
            throw new Error('[RBAC] RbacService.availableMatrices is not defined');
        }

        return new RBACAgentManager(this, scope, baseRoles, this.logger);
    }

    public getPermissionMatrix<
        ID extends number | string = number | string,
        Entity extends EntityWithPermission = EntityWithPermission,
        Related extends RelatedResolvers = null,
    >(
        name: string | PermissionsResolverType<ID, Entity, RelatedResolverIdTypes>,
    ): PermissionsCoordinator<ID, Entity> {
        if (typeof name === 'function') {
            const meta = getMeta(name);

            name = meta.name;
        }

        if (!this.moduleAllowedMatrices.includes(name)) {
            throw new Error(`Permission matrix "${name}" is not available in this module`);
        }

        return this.core.getMatrix(name) as PermissionsCoordinator<
            ID,
            Entity,
            RelationTypes<Related>
        >;
    }
}

function reorderMatrices(map: Map<string, RawPermissionsResolver>): RawPermissionsResolver[] {
    const result: RawPermissionsResolver[] = [];

    map.forEach(processItem);

    return result;

    function processItem(matrix: RawPermissionsResolver) {
        if (result.includes(matrix)) {
            return;
        }

        const relatedMatrixTypes = matrix.meta.relations as Record<string, PermissionsResolverType>;

        for (const key in relatedMatrixTypes) {
            const meta = getMeta(relatedMatrixTypes[key]);

            const relatedMatrix = map.get(meta.name);

            if (!relatedMatrix) {
                throw new Error(
                    `Matrix "${meta.name}" not connected via RbacModule.forFeature([MatrixClass])`,
                );
            }

            processItem(relatedMatrix);
        }

        if (result.includes(matrix)) {
            throw new Error(
                `Matrix circular dependency detected in "${matrix.meta.name} (${matrix.type.name})`,
            );
        }

        result.push(matrix);
    }
}

function getRawInstance(matrix: RawPermissionsResolver): PermissionsResolver {
    if (!matrix.service) {
        throw new Error(`Matrix "${matrix.meta.name}" is not initialized`);
    }

    return matrix.service;
}
