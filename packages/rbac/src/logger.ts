import { Logger as NestLogger } from '@nestjs/common';

/**
 * Логгер RBAC на базе встроенного логгера NestJS.
 *
 * Добавляет `setContext`, который использовался логгером проекта-источника.
 */
export class Logger extends NestLogger {
    setContext(context: string): void {
        this.context = context;
    }
}
