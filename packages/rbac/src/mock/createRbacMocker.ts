import { DynamicModule, Module } from '@nestjs/common';
import { NestApplicationContext } from '@nestjs/core';

import { EntityWithPermission, PermissionFromEntity } from '@src/common/rbac';

import { RbacModule, RbacService, ScopeType } from '..';
import { RBACAgentManager } from '../agent';
import { getMeta } from '../decorators';
import { Role } from '../matrix';
import { GetBaseScopeResult } from '../rbac.providers';
import { RbacServiceCore } from '../rbac.service';
import { PermissionsResolverType } from '../resolver';
import { RelatedResolverIdTypes } from '../types';

import { createMockMatrices, MockController } from './matrix';

export type RbacMocker = ReturnType<typeof createRbacMocker>;

export function createRbacMocker(...matrices: PermissionsResolverType[]) {
    let app: NestApplicationContext;

    const controllers = new Map<string, MockController>();
    const mockedMatrices = matrices.map(createMockMatrices(controllers));

    const baseResolverMock = {
        getBaseScope(_request: Request): GetBaseScopeResult {
            return { loggedIn: true, scope: {} };
        },
        async getBaseRoles(_scope: ScopeType): Promise<(Role | Role[] | null)[]> {
            return [];
        },
    };

    return {
        module: createMockModule(mockedMatrices),
        init: async (nestApp: NestApplicationContext) => {
            app = nestApp;
            const coreService = app.get(RbacServiceCore);

            coreService.baseResolver = baseResolverMock;
            await coreService.initMatrices(app);
        },
        getManager,
        reset() {
            controllers.forEach((controller) => controller.resetMock());
        },
        /** @deprecated use mockEntity or mockList */
        mock<T extends EntityWithPermission>(
            matrix: PermissionsResolverType<any, T>,
            entity: Partial<T> | null,
            permissions: Partial<Record<PermissionFromEntity<T>, boolean>>,
        ) {
            const meta = getMeta(matrix);
            const controller = controllers.get(meta.name);

            if (!controller) {
                throw new Error(`Controller for ${meta.name} is not found`);
            }

            controller.mock(entity, permissions);
        },
        mockEntity<ID extends string | number, Entity extends EntityWithPermission>(
            matrix: PermissionsResolverType<ID, Entity>,
            entity: ID | Partial<Entity>,
            permissions: Partial<Record<PermissionFromEntity<Entity>, boolean>>,
        ) {
            const meta = getMeta(matrix);
            const controller = controllers.get(meta.name);

            if (!controller) {
                throw new Error(`Controller for ${meta.name} is not found`);
            }

            controller.mock(entity, permissions);
        },
        mockList<
            ID extends string | number,
            Entity extends EntityWithPermission,
            Related extends RelatedResolverIdTypes = null,
        >(
            matrix: PermissionsResolverType<ID, Entity, Related>,
            _scope: RelatedResolverIdTypes | null = null,
            permissions: Partial<Record<PermissionFromEntity<Entity>, boolean>>,
        ) {
            const meta = getMeta(matrix);
            const controller = controllers.get(meta.name);

            if (!controller) {
                throw new Error(`Controller for ${meta.name} is not found`);
            }

            controller.mock(null, permissions);
        },
    };

    function createMockModule(matrices: PermissionsResolverType[]): DynamicModule {
        @Module({})
        class RbacMockModule {}

        const module = RbacModule.forFeature(matrices);

        return {
            global: true,
            ...module,
            module: RbacMockModule,
            providers: [...(module.providers || []), ...matrices],
        };
    }

    async function getManager(): Promise<RBACAgentManager> {
        if (!app) {
            throw new Error('RbacMocker is not initialized, call await rbac.init(app) first');
        }

        const rbacService = app.get(RbacService);

        return rbacService.createManager(baseResolverMock.getBaseScope({} as any));
    }
}
