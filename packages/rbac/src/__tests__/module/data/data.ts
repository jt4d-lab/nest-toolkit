import { Article, Org } from './entities';

export const articlesDatabase: Article[] = [
    {
        id: 1,
        orgId: 1,
        ownerId: 1,
        org: {
            id: 1,
            name: 'Some org',
        },
    },
    {
        id: 2,
        orgId: 2,
        ownerId: 2,
        org: {
            id: 2,
            name: 'Another org',
        },
    },
    {
        id: 3,
        orgId: 1,
        ownerId: 1,
        org: {
            id: 1,
            name: 'Some org',
        },
    },
];

export const orgsDatabase: Org[] = [
    {
        id: 1,
        name: 'Some org',
    },
    {
        id: 2,
        name: 'Another org',
    },
];
