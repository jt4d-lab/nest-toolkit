import { createParamDecorator, ExecutionContext, Injectable, PipeTransform } from '@nestjs/common';

import { RBACAgent } from '..';
import { RbacService } from '../rbac.service';

export interface IRBACContext {
    request: Request;
}

@Injectable()
export class RBACPipe implements PipeTransform {
    constructor(private manager: RbacService) {}

    async transform({ request }: IRBACContext) {
        const manager = await this.manager.createManagerByRequest(request);

        return RBACAgent(manager);
    }
}

const RBACAgentGetter = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): IRBACContext => {
        const httpCtx = ctx.switchToHttp();

        const request = httpCtx.getRequest<Request>();

        return {
            request,
        };
    },
);

/**
 * Декоратор для доступа к RBAC
 *
 * Возвращает **RBACAgent**
 */
export function RBAC() {
    return RBACAgentGetter(RBACPipe);
}
