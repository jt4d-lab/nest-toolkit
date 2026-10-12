import {
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';

export interface AgentMethods {
    getPermissions: any;
    insertPermissions: any;
    check: any;
    checkSome: any;
    checkEvery: any;
    can: any;
    canSome: any;
    canEvery: any;
    exists?: any;
}

export interface RBACAbstractAgent extends AgentMethods {
    sync: AgentMethods;
    prepare: any;
    invalidate: any;
}

export function handleErrorDecision(code: number = 403, message?: string): never {
    switch (code) {
        case 403:
            throw new ForbiddenException(message);
        case 404:
            throw new NotFoundException(message);
        default:
            throw new InternalServerErrorException();
    }
}
