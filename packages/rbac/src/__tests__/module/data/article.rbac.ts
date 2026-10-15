import { PermissionsResolver, RBACMatrix, SystemRoles } from '../../..';

import { articlesDatabase } from './data';
import { Article } from './entities';
import { OrgRBAC } from './org.rbac';

@RBACMatrix(
    {
        name: 'article',
        getId: (entity: Article) => entity.id,
        relations: {
            org: OrgRBAC,
        },
    },
    (_, { org }) => ({
        read: [SystemRoles.any],
        readList: [org.read],
        write: [org.writeArticle],
        create: [org.writeArticle],
    }),
)
export class ArticleRBAC implements PermissionsResolver<number, Article, { org: number }> {
    log: string[] = [];

    async getEntities(ids: number[]): Promise<Article[]> {
        this.log.push(`getEntities ${ids}`);

        return ids
            .map((id) => articlesDatabase.find((item) => item.id === id))
            .filter((item): item is Article => !!item);
    }

    getReferences(entity: Article) {
        return {
            org: entity.orgId,
        };
    }
}
