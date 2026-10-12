import { Controller, Get, INestApplication, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';

import { EntityWithPermission } from '@src/common/rbac';
import { LocalLoggerModule } from '@src/server/logger';

import {
    createRole,
    PermissionsResolver,
    RBAC,
    RBACAgent,
    RBACEntityAgent,
    RBACMatrix,
    RbacService,
    Roles,
} from '..';
import { RBACAgentManager } from '../agent';
import { getMeta } from '../decorators';
import { RBACPipe } from '../decorators/rbac.decorator';

import { createRbacMocker } from './createRbacMocker';

interface IDemoEntity extends EntityWithPermission<'read' | 'write'> {
    id: number;
    name?: string;
}

interface IComplexEntity extends EntityWithPermission<'read' | 'write'> {
    demoId: number;
    id: number;
}

const adminRole = createRole('admin');

@RBACMatrix(
    {
        name: 'demo',
        getId: (entity: IDemoEntity) => entity.id,
    },
    () => ({
        read: [Roles.loggedIn],
        write: [adminRole],
    }),
)
class DemoRBAC implements PermissionsResolver<number, IDemoEntity> {
    async getEntities(_ids: number[]): Promise<IDemoEntity[]> {
        return [];
    }
}

@Injectable()
class ComplexService {}

@RBACMatrix(
    {
        name: 'complex',
        getId: (entity: IComplexEntity) => entity.id,
        relations: {
            demo: DemoRBAC,
        },
    },
    (_, { demo }) => ({
        read: [Roles.loggedIn],
        write: [demo.write],
    }),
)
class ComplexRBAC {
    constructor(public readonly service: ComplexService) {}

    getEntities(_id: number[]): Promise<IComplexEntity[]> {
        throw new Error('Method not implemented.');
    }

    getReferences(entity: IComplexEntity) {
        return {
            demo: entity.demoId,
        };
    }
}

describe('createRbacMocker', () => {
    it('getAgent', async () => {
        // Arrange
        const rbac = createRbacMocker(DemoRBAC);

        const module = await Test.createTestingModule({
            imports: [rbac.module, LocalLoggerModule.forTesting()],
        }).compile();

        await rbac.init(module);

        // Act
        const manager = await rbac.getManager();
        const agent = manager.getEntityAgent(DemoRBAC);

        // Assert
        expect(agent).toBeInstanceOf(RBACEntityAgent);
    });
    describe('mocks', () => {
        let app: TestingModule;
        let rbac: ReturnType<typeof createRbacMocker>;
        let manager: RBACAgentManager;

        beforeEach(async () => {
            // Arrange
            rbac = createRbacMocker(DemoRBAC);

            app = await Test.createTestingModule({
                imports: [rbac.module, LocalLoggerModule.forTesting()],
            }).compile();

            await rbac.init(app);
            manager = await rbac.getManager();
        });
        it('should set permissions from mock', async () => {
            const agent = manager.getEntityAgent(DemoRBAC);

            // Act
            rbac.mockEntity(DemoRBAC, { id: 1 }, { read: true, write: false });
            rbac.mockEntity(DemoRBAC, { id: 2 }, { write: true });

            // Assert
            expect(await agent.getPermissions({ id: 1 })).toEqual(['read']);
            expect(await agent.getPermissions({ id: 2 })).toEqual(['write']);
        });
        it('should mock by id', async () => {
            const agent = manager.getEntityAgent(DemoRBAC);

            // Act
            rbac.mockEntity(DemoRBAC, 1, { read: true, write: false });

            // Assert
            expect(await agent.getPermissions({ id: 1 })).toEqual(['read']);
        });
        it('should throw error if entity not mocked', async () => {
            const agent = manager.getEntityAgent(DemoRBAC);

            // Act & Assert
            await expect(agent.getPermissions({ id: 1 })).rejects.toThrow('Entity not mocked');
        });
        it('resetMock', async () => {
            const agent = manager.getEntityAgent(DemoRBAC);

            rbac.mockEntity(DemoRBAC, 1, { read: true, write: false });
            await agent.getPermissions(1);

            // Act
            rbac.reset();
            agent.invalidate(1);

            // Assert
            await expect(agent.getPermissions(1)).rejects.toThrow('Entity not mocked');
        });
    });
    describe('errors', () => {
        it('should throw error if init not called', async () => {
            const rbac = createRbacMocker(DemoRBAC);

            const app = await Test.createTestingModule({
                imports: [rbac.module, LocalLoggerModule.forTesting()],
            }).compile();

            // check getAgent
            await expect(() => rbac.getManager()).rejects.toThrow(
                'RbacMocker is not initialized, call await rbac.init(app) first',
            );

            // check get agent
            const manager = app.get(RbacService);
            const meta = getMeta(DemoRBAC);

            expect(() => manager.getPermissionMatrix(meta.name)).toThrow('Matrix "demo" not found');
        });
    });
    describe('integration tests', () => {
        let app: INestApplication;

        afterEach(() => app?.close());

        it('should action get agent', async () => {
            // Arrange
            const rbac = createRbacMocker(DemoRBAC, ComplexRBAC);

            @Controller()
            class DemoController {
                @Get()
                public method(@RBAC() agent: RBACAgent) {
                    const rbac = agent(ComplexRBAC).entity;

                    return { agent: !!rbac };
                }
            }

            @Module({
                controllers: [DemoController],
            })
            class DemoModule {}

            const module = await Test.createTestingModule({
                imports: [rbac.module, DemoModule, LocalLoggerModule.forTesting()],
            }).compile();

            app = module.createNestApplication();

            app.setGlobalPrefix('/api');

            await rbac.init(module);
            await app.init();

            // Act
            const pipe = module.get(RBACPipe);
            const response = await supertest(app.getHttpServer()).get('/api').expect(200);

            // Assert
            expect(pipe).toBeDefined();
            expect(response.body).toEqual({ agent: true });
        });
    });
});
