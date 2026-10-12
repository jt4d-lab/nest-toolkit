import { Injectable, Type } from '@nestjs/common';

import { PermissionDefinitionTableCreator } from '../matrix';
import { EntityWithPermission } from '../permissions';
import {
    PermissionsResolver,
    PermissionsResolverMeta,
    PermissionsResolverType,
    RelatedResolverIds,
} from '../resolver';
import { RelatedResolvers, RelationTypes } from '../types';

const permissionsResolverReflectKey = 'RBAC_PERMISSION_RESOLVER_META';

interface RBACMatrixMeta<
    ID extends number | string,
    Entity extends EntityWithPermission,
    Related extends RelatedResolvers = null,
> {
    /**
     * Имя матрицы разрешений
     */
    name: string;
    /**
     * Получение идентификатора сущности
     */
    getId(entity: Entity): ID;
    /**
     * Связанные матрицы разрешений
     */
    relations?: Related;
}

/**
 * Декоратор для объявления матрицы разрешений
 * @param meta Метаинформация о матрице разрешений
 * @param matrix Матрица разрешений
 */
export function RBACMatrix<
    ID extends number | string,
    Entity extends EntityWithPermission,
    Related extends RelatedResolvers = null,
>(
    meta: RBACMatrixMeta<ID, Entity, Related>,
    matrix: PermissionDefinitionTableCreator<Entity, RelationTypes<Related>>,
) {
    return (
        target: PermissionsResolverType<
            ID,
            Entity,
            Related extends object ? RelatedResolverIds<Related> : null
        >,
    ) => {
        Injectable()(target);

        const finalMeta: PermissionsResolverMeta<ID, Entity, Related> = {
            name: meta.name,
            getId: meta.getId,
            matrix,
            relations: (meta.relations || {}) as Related,
        };

        Reflect.defineMetadata(permissionsResolverReflectKey, finalMeta, target);
    };
}

export function getMeta<
    ID extends number | string,
    Entity extends EntityWithPermission = EntityWithPermission,
>(resolver: Type<PermissionsResolver<ID, Entity>>): PermissionsResolverMeta<ID, Entity> {
    const meta = Reflect.getMetadata(permissionsResolverReflectKey, resolver);

    if (!meta) {
        throw new Error(`The matrix "${resolver.name}" is not decorated by @RBACMatrix`);
    }

    return meta;
}
