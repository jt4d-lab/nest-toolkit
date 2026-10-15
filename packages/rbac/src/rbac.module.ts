import { DynamicModule, INestApplicationContext, Module, Type } from '@nestjs/common';

import { RBACPipe } from './decorators/rbac.decorator';
import type { RBACLogger } from './logging';
import {
    BaseResolver,
    RBAC_BASE_RESOLVER,
    RBAC_FEATURE_MATRICES,
    RBAC_LOGGER,
} from './rbac.providers';
import { RbacService, RbacServiceCore } from './rbac.service';
import { PermissionsResolver } from './resolver';

@Module({
    providers: [RbacServiceCore],
    exports: [RbacServiceCore],
})
class RbacModuleCore {}

interface RbacRootModuleOptions {
    baseResolver: Type<BaseResolver>;
    logger?: RBACLogger;
}

@Module({
    imports: [RbacModuleCore],
    providers: [],
})
export class RbacModule {
    public async init(app: INestApplicationContext) {
        const service = app.get(RbacServiceCore);

        await service.initMatrices(app);
    }

    public static forRoot({ baseResolver, logger }: RbacRootModuleOptions): DynamicModule {
        return {
            module: RbacModule,
            imports: [RbacModuleCore],
            providers: [
                { provide: RBAC_BASE_RESOLVER, useExisting: baseResolver },
                ...(logger ? [{ provide: RBAC_LOGGER, useValue: logger }] : []),
                RbacService,
            ],
        };
    }

    public static forFeature(matrices: Type<PermissionsResolver>[]): DynamicModule {
        return {
            module: RbacModule,
            imports: [RbacModuleCore],
            providers: [
                RbacService,
                RBACPipe,
                { provide: RBAC_FEATURE_MATRICES, useValue: matrices },
            ],
            exports: [RbacService, RBACPipe],
        };
    }

    public static forTesting(matrices: Type<PermissionsResolver>[]): DynamicModule {
        const baseResolver: BaseResolver = {
            getBaseScope() {
                return { loggedIn: true, scope: {} };
            },
            async getBaseRoles() {
                return [];
            },
        };

        return {
            module: RbacModule,
            imports: [RbacModuleCore],
            providers: [
                { provide: RBAC_BASE_RESOLVER, useValue: baseResolver },
                { provide: RBAC_FEATURE_MATRICES, useValue: matrices },
                RbacService,
            ],
        };
    }
}
