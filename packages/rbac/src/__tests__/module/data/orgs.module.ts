import { Module } from '@nestjs/common';

import { RbacModule } from '../../..';

import { OrgRBAC } from './org.rbac';

@Module({
    imports: [RbacModule.forFeature([OrgRBAC])],
    providers: [OrgRBAC],
    exports: [OrgRBAC],
})
export class OrgsModule {}
