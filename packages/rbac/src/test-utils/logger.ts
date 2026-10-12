import { DynamicModule, Module } from '@nestjs/common';

import { Logger } from '../logger';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
    level: LogLevel;
    message: string;
    context: string;
    [extra: string]: unknown;
}

/**
 * Набор тестовых утилит для проверки логирования RBAC.
 *
 * Оригинальный логгер проекта-источника заменён на встроенный логгер NestJS, поэтому здесь
 * остался только сбор и матчинг записей логов.
 */
export class TestingLogger {
    private readonly entries: LogEntry[] = [];

    log(level: LogLevel, message: string, context: string, details?: object) {
        this.entries.push({
            level,
            message,
            context,
            ...details,
        });
    }

    clear() {
        this.entries.length = 0;
    }

    any(): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, {});
    }

    withMessage(message: string): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { message });
    }

    withLevel(level: LogLevel): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { level });
    }

    withContext(context: string): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { context });
    }
}

export class TestingLoggerMatcher {
    constructor(
        private readonly entries: LogEntry[],
        private readonly filter: Partial<LogEntry>,
        private readonly strict = false,
    ) {}

    get logs() {
        // В strict-режиме детали должны совпадать полностью, без лишних ключей.
        if (this.strict) {
            const baseFields: (keyof LogEntry)[] = ['level', 'message', 'context'];

            return this.entries.filter((log) => {
                for (const field of baseFields) {
                    if (this.filter[field] !== undefined && log[field] !== this.filter[field]) {
                        return false;
                    }
                }

                const detailFilterKeys = Object.keys(this.filter).filter((key) => {
                    return !baseFields.includes(key as keyof LogEntry);
                });

                const entryDetailKeys = Object.keys(log).filter((key) => {
                    return !baseFields.includes(key as keyof LogEntry);
                });

                if (detailFilterKeys.length !== entryDetailKeys.length) {
                    return false;
                }

                for (const key of detailFilterKeys) {
                    if (log[key] !== (this.filter as Record<string, unknown>)[key]) {
                        return false;
                    }
                }

                return true;
            });
        }

        return this.entries.filter((log) => {
            for (const key in this.filter) {
                if (log[key] !== this.filter[key]) {
                    return false;
                }
            }

            return true;
        });
    }

    withMessage(message: string): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { ...this.filter, message }, this.strict);
    }

    withLevel(level: LogLevel): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { ...this.filter, level }, this.strict);
    }

    withContext(context: string): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { ...this.filter, context }, this.strict);
    }

    withDetails(obj: Record<string, boolean | number | string>): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { ...this.filter, ...obj }, this.strict);
    }

    /**
     * Строгий режим: все детали должны совпадать, лишних быть не должно.
     */
    strictDetails(): TestingLoggerMatcher {
        return new TestingLoggerMatcher(this.entries, { ...this.filter }, true);
    }

    toBeLogged(): void {
        if (this.logs.length === 0) {
            if (this.entries.length) {
                this.toBeLoggedTimes(1);
            } else {
                fail('No logs recorded');
            }
        }
    }

    toBeNotLogged(): void {
        this.toBeLoggedTimes(0);
    }

    toBeLoggedOnce(): void {
        this.toBeLoggedTimes(1);
    }

    toBeLoggedTimes(n: number): void {
        const logs = this.logs;

        if (logs.length === n) {
            return;
        }

        this.throwDiff(n);
    }

    /**
     * Фильтрует логи только по основным полям (level, message, context), игнорируя детали.
     */
    private getLogsWithoutDetails() {
        const fields: (keyof LogEntry)[] = ['level', 'message', 'context'];

        return this.entries.filter((log) =>
            fields.every((field) => {
                if (!this.filter[field]) {
                    return true;
                }

                return log[field] === this.filter[field];
            }),
        );
    }

    private throwDiff(n: number) {
        const expected: LogEntry[] = [];

        for (let i = 0; i < n; i++) {
            expected.push(this.filter as LogEntry);
        }

        const actual = this.getLogsWithoutDetails();

        if (actual.length) {
            // @ts-ignore -- сравнение сматченных записей с ожидаемыми
            expect(actual).toEqual(expected);
        }

        if (!this.entries.length) {
            return fail('No logs recorded');
        }

        // @ts-ignore -- сравнение сматченных записей с ожидаемыми
        expect(this.entries.map(logEntryToString(this.filter)).toSorted().join('\n')).toEqual(
            expected.map(() => logEntryToString(this.filter)(this.filter as LogEntry)).join('\n'),
        );
    }
}

function fail(message: string): void {
    throw new Error(message);
}

function logEntryToString(filter: Partial<LogEntry>) {
    return (entry: LogEntry): string => {
        let result = '';

        if (filter.context) {
            result += `${entry.context} `;
        }

        if (filter.level) {
            result += `[${entry.level}] `;
        }

        if (filter.message) {
            result += `${entry.message}`;
        }

        return result;
    };
}

/**
 * Тестовый логгер, совместимый с NestJS: пишет записи в {@link TestingLogger}.
 */
export class MockLogger extends Logger {
    constructor(private readonly testingLogger: TestingLogger) {
        super();
    }

    override log(message: unknown, ...optionalParams: unknown[]): void {
        this.capture('info', message, optionalParams);
    }

    override debug(message: unknown, ...optionalParams: unknown[]): void {
        this.capture('debug', message, optionalParams);
    }

    override warn(message: unknown, ...optionalParams: unknown[]): void {
        this.capture('warn', message, optionalParams);
    }

    override error(message: unknown, ...optionalParams: unknown[]): void {
        this.capture('error', message, optionalParams);
    }

    private capture(level: LogLevel, message: unknown, optionalParams: unknown[]) {
        const details = optionalParams.find((param) => param && typeof param === 'object');

        this.testingLogger.log(level, String(message), this.context ?? '', details as object);
    }
}

@Module({})
export class LocalLoggerModule {
    static forTesting(): DynamicModule {
        return {
            global: true,
            module: LocalLoggerModule,
            providers: [
                TestingLogger,
                {
                    provide: Logger,
                    useFactory: (testingLogger: TestingLogger) => new MockLogger(testingLogger),
                    inject: [TestingLogger],
                },
            ],
            exports: [Logger, TestingLogger],
        };
    }
}
