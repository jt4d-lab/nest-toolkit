/**
 * Список разрешений для сущности
 */
export interface EntityWithPermission<Permissions extends string = string> {
    __permissions?: Permissions[];
}

/**
 * Сущность с проставленными разрешениями
 */
export type EntityWithCalculatedPermissions<Entity extends EntityWithPermission> = Entity &
    Required<Pick<Entity, '__permissions'>>;

/**
 * Разрешение, доступное для сущности
 */
export type PermissionFromEntity<T extends EntityWithPermission> =
    T extends EntityWithPermission<infer R> ? R : never;
