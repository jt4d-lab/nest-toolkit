# Changelog

## Unreleased

### Breaking changes

- Удалён публичный экспорт `Logger`; логирование переведено на событийный контракт `RBACLogger`.
  Настраиваемый логгер передаётся через `RbacModule.forRoot({ logger })` или токен `RBAC_LOGGER`
  (провайдер должен быть в `@Global()`-модуле). По умолчанию используется `DefaultRBACLogger`.
- Конструктор публичного `RBACAgentManager` получил обязательный 4-й параметр `logger: RBACLogger`.
