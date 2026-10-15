import { DynamicModule, Global, Injectable, Module } from '@nestjs/common';

import { BaseResolver } from '../../..';

@Injectable()
export class BaseResolverMock implements BaseResolver {
    getBaseScope() {
        return { loggedIn: true, scope: { profileId: 1 } };
    }
    async getBaseRoles() {
        return [];
    }
}
@Global()
@Module({
    providers: [BaseResolverMock],
    exports: [BaseResolverMock],
})
export class BaseModule {
    static forRoot(): DynamicModule {
        return {
            global: true,
            module: BaseModule,
            providers: [BaseResolverMock],
            exports: [BaseResolverMock],
        };
    }
}
