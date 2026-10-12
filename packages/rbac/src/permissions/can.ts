import { EntityWithPermission, PermissionFromEntity } from './types';

/**
 * Проверка разрешения для сущности
 * @param entity сущность
 * @param permission разрешение
 */
export function can<Entity extends EntityWithPermission>(
    entity: Entity,
    permission: PermissionFromEntity<Entity>,
): boolean;
/**
 * Проверка разрешения для списка разрешений
 * @param entityPermissions список разрешений сущности
 * @param permission разрешение
 */
export function can<Entity extends EntityWithPermission>(
    entityPermissions: PermissionFromEntity<Entity>[],
    permission: PermissionFromEntity<Entity>,
): boolean;

export function can<Entity extends EntityWithPermission>(
    entity: Entity | PermissionFromEntity<Entity>[],
    permission: PermissionFromEntity<Entity>,
) {
    const permissions = getPermissionsFromEntity(entity);

    return permissions.includes(permission);
}

/**
 * Проверка, что есть хотя бы одно разрешение для сущности
 * @param entity сущность
 * @param permissions разрешения
 */
export function canSome<Entity extends EntityWithPermission>(
    entity: Entity,
    ...permissions: PermissionFromEntity<Entity>[]
): boolean;
/**
 * Проверка, что есть хотя бы одно разрешение для сущности
 * @param entityPermissions разрешения сущности
 * @param permissions разрешения
 */
export function canSome<Entity extends EntityWithPermission>(
    entityPermissions: PermissionFromEntity<Entity>[],
    ...permissions: PermissionFromEntity<Entity>[]
): boolean;

export function canSome<Entity extends EntityWithPermission>(
    entity: Entity,
    ...permissions: PermissionFromEntity<Entity>[]
) {
    const entityPermissions = getPermissionsFromEntity(entity);

    return permissions.some((permission) => entityPermissions?.includes(permission));
}

/**
 * Проверка, что есть все разрешения для сущности
 * @param entity сущность
 * @param permissions разрешения
 */
export function canEvery<Entity extends EntityWithPermission>(
    entity: Entity,
    ...permissions: PermissionFromEntity<Entity>[]
): boolean;
/**
 * Проверка, что есть все разрешения для сущности
 * @param entityPermissions разрешения сущности
 * @param permissions разрешения
 */
export function canEvery<Entity extends EntityWithPermission>(
    entityPermissions: PermissionFromEntity<Entity>[],
    ...permissions: PermissionFromEntity<Entity>[]
): boolean;

export function canEvery<Entity extends EntityWithPermission>(
    entity: Entity,
    ...permissions: PermissionFromEntity<Entity>[]
) {
    const entityPermissions = getPermissionsFromEntity(entity);

    return permissions.every((permission) => entityPermissions?.includes(permission));
}

/**
 * Фабрика функций для проверки разрешения сущностей
 * @param permission разрешение
 *
 * @example const readableItems = allItems.filter(canFactory('read'))
 */
export function canFactory<Entity extends EntityWithPermission>(
    permission: PermissionFromEntity<Entity>,
) {
    return (entity: Entity) => can(entity, permission);
}

/**
 * Фабрика функций для проверки разрешения сущностей
 * @param permissions разрешения
 *
 * @example const readableItems = allItems.filter(canFactory('read'))
 */
export function canSomeFactory<Entity extends EntityWithPermission>(
    ...permissions: PermissionFromEntity<Entity>[]
) {
    return (entity: Entity) => canSome(entity, ...permissions);
}

/**
 * Фабрика функций для проверки разрешения сущностей
 * @param permissions разрешения
 *
 * @example const readableItems = allItems.filter(canFactory('read'))
 */
export function canEveryFactory<Entity extends EntityWithPermission>(
    ...permissions: PermissionFromEntity<Entity>[]
) {
    return (entity: Entity) => canEvery(entity, ...permissions);
}

export function getPermissionsFromEntity<Entity extends EntityWithPermission>(
    entity: Entity | PermissionFromEntity<Entity>[],
): PermissionFromEntity<Entity>[] {
    if (!entity) {
        throw new Error('[RBAC] Can: Entity does not exist');
    }

    let permissions: string[] | undefined;

    if (Array.isArray(entity)) {
        if (entity.some((item) => typeof item !== 'string')) {
            throw new Error('Can not work with array of entities, use single entity instead');
        }

        permissions = entity;
    } else {
        permissions = entity.__permissions;
    }

    if (!permissions) {
        throw new Error('Entity does not contains calculated permissions');
    }

    return permissions as PermissionFromEntity<Entity>[];
}
