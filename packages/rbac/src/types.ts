import { PermissionsResolverType } from './resolver';

export type RelatedResolvers = null | Record<string, PermissionsResolverType<any, any>>;

export type RelatedResolverIdTypes = null | Record<string, string | number | undefined>;

export type RelationTypes<T extends RelatedResolvers> = RelatedResolvers extends null
    ? {}
    : {
          [K in keyof T]: T[K] extends PermissionsResolverType<any, infer R> ? R : never;
      };

export type EntitiesFromRelatedMatrix<T extends RelatedResolvers> = RelatedResolvers extends null
    ? {}
    : {
          [K in keyof T]: T[K] extends PermissionsResolverType<any, infer R> ? R : never;
      };
