## Публикация в npm

Публикация выполняется workflow `.github/workflows/release.yml` через npm Trusted Publishing;
`NPM_TOKEN` не нужен.

- Push тега строго вида `vX.Y.Z` выпускает стабильный релиз всех публичных пакетов из `packages/*` с
  версией `X.Y.Z` и npm dist-tag `latest`. Внутренние зависимости временно получают диапазон
  `^X.Y.Z`.
- Ручной запуск **Publish libraries** из любой ветки выпускает канареечный релиз. Версия каждого
  пакета берётся из выбранной ветки и получает суффикс `-canary.<GitHub run ID>`; внутренние
  зависимости получают строгую ссылку на соответствующую канареечную версию. Публикация использует
  npm dist-tag `canary`.

Workflow меняет манифесты только в своём временном checkout и не создаёт коммитов. Перед первой
публикацией каждого нового публичного пакета настройте в npm его GitHub Actions Trusted Publisher:
репозиторий `jt4d-lab/nest-toolkit` и workflow filename `release.yml`.
