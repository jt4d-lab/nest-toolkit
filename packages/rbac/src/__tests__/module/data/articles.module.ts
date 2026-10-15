import { Controller, Get, Module, Param, ParseIntPipe } from '@nestjs/common';

import { RBAC, RBACAgent, RbacModule } from '../../..';
import { PermissionFromEntity } from '../../../permissions';

import { ArticleRBAC } from './article.rbac';
import { Article } from './entities';
import { OrgsModule } from './orgs.module';
import { makeDummyPaginatedResponse, PaginatedResponse } from './pagination';

@Controller()
class ArticleController {
    constructor(private articlesRBAC: ArticleRBAC) {}

    @Get('articles/:id')
    async get(
        @Param('id', ParseIntPipe) id: number,
        @RBAC() rbacAgent: RBACAgent,
    ): Promise<PermissionFromEntity<Article>[]> {
        const rbac = rbacAgent(ArticleRBAC).entity;

        return rbac.getPermissions(id);
    }

    @Get('articles/:id/check')
    async check403(@Param('id', ParseIntPipe) id: number, @RBAC() rbacAgent: RBACAgent) {
        const rbac = rbacAgent(ArticleRBAC).entity;

        await rbac.check('write', id);

        return 'ok';
    }

    @Get('articles/:id/check/404')
    async check404(@Param('id', ParseIntPipe) id: number, @RBAC() rbacAgent: RBACAgent) {
        const rbac = rbacAgent(ArticleRBAC).entity;

        await rbac.check('write', id, 404);

        return 'ok';
    }

    @Get('articles')
    async list(@RBAC() rbacAgent: RBACAgent): Promise<PaginatedResponse<Article>> {
        const rbac = rbacAgent(ArticleRBAC).list;

        const data = await this.articlesRBAC.getEntities([1, 2]);

        return makeDummyPaginatedResponse(data, data.length, { rbac });
    }

    @Get('org/:org')
    async listOrg(
        @Param('org', ParseIntPipe) org: number,
        @RBAC() rbacAgent: RBACAgent,
    ): Promise<PaginatedResponse<Article>> {
        const rbac = rbacAgent(ArticleRBAC).list;

        const data = await this.articlesRBAC.getEntities([1, 2]).then((articles) => {
            return articles.filter((article) => article.orgId === org);
        });

        return makeDummyPaginatedResponse(data, data.length, { rbac, scope: { org } });
    }
}

@Module({
    imports: [RbacModule.forFeature([ArticleRBAC]), OrgsModule],
    controllers: [ArticleController],
    providers: [ArticleRBAC],
    exports: [ArticleRBAC],
})
export class ArticlesModule {}
