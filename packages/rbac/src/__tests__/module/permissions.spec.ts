import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';

import { RbacModule } from '../..';
import { LocalLoggerModule } from '../../test-utils/logger';

import { ArticlesModule } from './data/articles.module';
import { BaseModule, BaseResolverMock } from './data/base.module';
import { OrgsModule } from './data/orgs.module';

describe('RBAC module / permissions', () => {
    let module: TestingModule;

    let app: INestApplication;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [
                ArticlesModule,
                OrgsModule,
                BaseModule,
                RbacModule.forRoot({
                    baseResolver: BaseResolverMock,
                }),
                LocalLoggerModule.forTesting(),
            ],
            providers: [],
        }).compile();

        app = module.createNestApplication();
        await module.get<RbacModule>(RbacModule).init(module);
        await app.init();
    });
    afterEach(() => app.close());

    describe('one entity', () => {
        it('не получает разрешения, если у связанного объекта нет нужного разрешения', async () => {
            await supertest(app.getHttpServer())
                .get('/articles/2')
                .set('Accept', 'application/json')
                .expect(['read', 'readList']);
        });
        it('успешно получает разрешение, если у связанного объекта есть нужное разрешение', async () => {
            await supertest(app.getHttpServer())
                .get('/articles/1')
                .set('Accept', 'application/json')
                .expect(['read', 'readList', 'write', 'create']);
        });
        it('объект, которого нет, не должен иметь каких-либо разрешений', () => {
            return supertest(app.getHttpServer())
                .get('/articles/404')
                .set('Accept', 'application/json')
                .expect([]);
        });
        describe('http code', () => {
            it('успешно получает объект, если у него есть разрешение', async () => {
                await supertest(app.getHttpServer())
                    .get('/articles/1/check')
                    .set('Accept', 'application/json')
                    .expect(200);
            });
            it('отвечает 403 при отсутствии разрешения', async () => {
                await supertest(app.getHttpServer())
                    .get('/articles/2/check')
                    .set('Accept', 'application/json')
                    .expect(403);
            });
            it('отвечает 404 при отсутствии объекта', async () => {
                await supertest(app.getHttpServer())
                    .get('/articles/404/check')
                    .set('Accept', 'application/json')
                    .expect(404);
            });
            it('отвечает 404 при отсутствии разрешения, но заданном коде ответа 404', async () => {
                await supertest(app.getHttpServer())
                    .get('/articles/2/check/404')
                    .set('Accept', 'application/json')
                    .expect(404);
            });
        });
    });
    describe('many entities', () => {
        it('получает разрешение на список без scope, элементам высталяются нужные разрешения', async () => {
            await supertest(app.getHttpServer())
                .get('/articles')
                .set('Accept', 'application/json')
                .expect((res) => {
                    expect(res.body.data).toHaveLength(2);
                    expect(res.body.data[0].__permissions).toEqual([
                        'read',
                        'readList',
                        'write',
                        'create',
                    ]);
                    expect(res.body.data[1].__permissions).toEqual(['read', 'readList']);
                    expect(res.body.__permissions).toEqual(['read']);
                });
        });
        it('получает права на список со scope (разрешение есть)', async () => {
            await supertest(app.getHttpServer())
                .get('/org/1')
                .set('Accept', 'application/json')
                .expect((res) => {
                    expect(res.body.data).toHaveLength(1);
                    expect(res.body.data[0].__permissions).toEqual([
                        'read',
                        'readList',
                        'write',
                        'create',
                    ]);
                    expect(res.body.__permissions).toEqual(['read', 'readList', 'write', 'create']);
                });
        });
        it('получает права на список со scope (разрешения нет)', async () => {
            await supertest(app.getHttpServer())
                .get('/org/2')
                .set('Accept', 'application/json')
                .expect((res) => {
                    expect(res.body.data).toHaveLength(1);
                    expect(res.body.data[0].__permissions).toEqual(['read', 'readList']);
                    expect(res.body.__permissions).toEqual(['read', 'readList']);
                });
        });
        it('получает минимальные права на список со scope (связанного объекта не существует)', async () => {
            await supertest(app.getHttpServer())
                .get('/org/404')
                .set('Accept', 'application/json')
                .expect((res) => {
                    expect(res.body.data).toHaveLength(0);
                    expect(res.body.__permissions).toEqual(['read']);
                });
        });
    });
});
