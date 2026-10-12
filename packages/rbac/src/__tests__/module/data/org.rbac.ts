import { createRole, PermissionsResolver, RBACMatrix, Roles } from '../../..';
import { UpdateRolesProps } from '../../../resolver';

import { orgsDatabase } from './data';
import { Org } from './entities';

export const orgMember = createRole('orgMember');

@RBACMatrix(
    {
        name: 'org',
        getId: (entity: Org) => entity.id,
    },
    () => ({
        read: [Roles.any],
        writeArticle: [orgMember],
    }),
)
export class OrgRBAC implements PermissionsResolver<number, Org> {
    log: string[] = [];

    async getEntities(ids: number[]): Promise<Org[]> {
        this.log.push(`getEntities ${ids}`);

        return ids
            .map((id) => orgsDatabase.find((item) => item.id === id))
            .filter((item): item is Org => !!item);
    }

    async updateRoles({ entities, agent, context }: UpdateRolesProps<number, Org>) {
        this.log.push(`updateRoles ${entities.map((entity) => entity.id)}`);
        entities.forEach((entity) => {
            if (entity.id === context.profileId) {
                agent.add(entity.id, orgMember);
            }
        });
    }
}
