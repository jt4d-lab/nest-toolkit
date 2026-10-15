import { buildGraph } from './build-graph';
import { NodeExport, NodeType } from './graph.types';
import { createRole, createRule } from './items';

describe('RBAC Graph', () => {
    const userRole = createRole('user');
    const adminRole = createRole('admin', [userRole]);
    const superAdminRole = createRole('superAdmin', [adminRole]);
    const rootRole = createRole('root', [superAdminRole]);

    it('role in array', () => {
        // act
        const graph = buildGraph('post', {
            delete: [adminRole, rootRole],
        });

        // assert
        expect(graph.getLastDebugInfo().nodes).toEqual([
            {
                type: NodeType.Root,
                name: 'post',
                children: [1],
            },
            {
                type: NodeType.Permission,
                name: 'delete',
                children: [2, 3],
            },
            {
                type: NodeType.Role,
                name: 'admin',
            },
            {
                type: NodeType.Role,
                name: 'root',
            },
        ] as NodeExport[]);
    });
    it('single role', () => {
        // act
        const graph = buildGraph('post', {
            delete: adminRole,
        });

        // assert
        expect(graph.getLastDebugInfo().nodes).toEqual([
            {
                type: NodeType.Root,
                name: 'post',
                children: [1],
            },
            {
                type: NodeType.Permission,
                name: 'delete',
                children: [2],
            },
            {
                type: NodeType.Role,
                name: 'admin',
            },
        ] as NodeExport[]);
    });
    it('rule', () => {
        // act
        const graph = buildGraph('post', {
            delete: createRule('owner', () => true),
        });

        // assert
        expect(graph.getLastDebugInfo().nodes).toEqual([
            {
                type: NodeType.Root,
                name: 'post',
                children: [1],
            },
            {
                type: NodeType.Permission,
                name: 'delete',
                children: [2],
            },
            {
                type: NodeType.Rule,
                name: 'owner',
            },
        ] as NodeExport[]);
    });
    it('transitive roles', () => {
        // act
        const graph = buildGraph('post', {
            delete: userRole,
        });

        // assert
        expect(graph.getLastDebugInfo().nodes).toEqual([
            {
                type: NodeType.Root,
                name: 'post',
                children: [1],
            },
            {
                type: NodeType.Permission,
                name: 'delete',
                children: [2],
            },
            {
                type: NodeType.Role,
                name: 'user',
            },
        ] as NodeExport[]);
    });
});
