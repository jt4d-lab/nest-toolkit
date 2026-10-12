import { Test } from '@nestjs/testing';

import { JTRbacModule } from './rbac.module';

describe('JTRbacModule', () => {
    it('собирается без провайдеров', async () => {
        const moduleRef = await Test.createTestingModule({ imports: [JTRbacModule] }).compile();

        await moduleRef.close();
    });
});
