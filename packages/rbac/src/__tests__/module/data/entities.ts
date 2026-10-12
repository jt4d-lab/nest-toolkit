import { EntityWithPermission } from '../../../permissions';

export interface Org extends EntityWithPermission<'read' | 'writeArticle'> {
    id: number;
    name: string;
}
export interface Article extends EntityWithPermission<'read' | 'readList' | 'write'> {
    id: number;
    ownerId: number;
    orgId: number;
    org: Org;
}
