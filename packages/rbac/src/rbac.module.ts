import { DynamicModule, Module, Type, INestApplicationContext } from '@nestjs/common';

import { RBACPipe } from './decorators/rbac.decorator';
import { BaseResolver, rbacBaseResolverToken, rbacFeatureMatrices } from './rbac.providers';
import { RbacService, RbacServiceCore } from './rbac.service';
import { PermissionsResolver } from './resolver';

@Module({
    providers: [RbacServiceCore],
    exports: [RbacServiceCore],
})
class RbacModuleCore {}

interface RbacRootModuleOptions {
    baseResolver: Type<BaseResolver>;
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

    public static forRoot({ baseResolver }: RbacRootModuleOptions): DynamicModule {
        return {
            module: RbacModule,
            imports: [RbacModuleCore],
            providers: [{ provide: rbacBaseResolverToken, useExisting: baseResolver }, RbacService],
        };
    }

    public static forFeature(matrices: Type<PermissionsResolver>[]): DynamicModule {
        return {
            module: RbacModule,
            imports: [RbacModuleCore],
            providers: [
                RbacService,
                RBACPipe,
                { provide: rbacFeatureMatrices, useValue: matrices },
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
                { provide: rbacBaseResolverToken, useValue: baseResolver },
                { provide: rbacFeatureMatrices, useValue: matrices },
                RbacService,
            ],
        };
    }
}
