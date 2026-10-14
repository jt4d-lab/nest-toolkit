## Публикация в npm

Workflow `.github/workflows/release.yml` ничего не публикует напрямую: он только стейджит пакеты
через `npm stage publish`, а публикует их мейнтейнер вручную с 2FA. `NPM_TOKEN` не нужен, OIDC идёт
через npm Trusted Publishing. Staged publishing требует npm@11.6.0+ — workflow сам ставит нужную
версию.

- Push тега строго вида `vX.Y.Z` стейджит стабильный релиз: все публичные пакеты из `packages/*`
  получают версию `X.Y.Z` и dist-tag `latest`. Внутренние зависимости временно получают диапазон
  `^X.Y.Z`.
- Ручной запуск **Publish libraries** из любой ветки стейджит канареечный релиз. Версия каждого
  пакета берётся из выбранной ветки и получает суффикс `-canary.<GitHub run ID>`; внутренние
  зависимости получают строгую ссылку на соответствующую канареечную версию. Публикация использует
  npm dist-tag `canary`.

В обоих случаях пакеты лежат в staging и недоступны потребителям, пока их не подтвердят; workflow
печатает версии пакетов в summary шага в формате, который можно вставить прямо в зависимости
`package.json` (например, `"@jt4d/nest-rbac": "1.2.3",`). Stage id берётся из `npm stage list`.

### Подтверждение релиза

Одобрение выполняется локально, вручную, с 2FA (локально нужен npm@11.6.0+):

- `npm stage list` — список staged-версий;
- `npm stage view <stage-id>` / `npm stage download <stage-id>` — посмотреть, что именно будет
  опубликовано;
- `npm stage approve <stage-id>` — опубликовать, `npm stage reject <stage-id>` — отклонить.

Staged-версия занимает тот же semver-слот, что и опубликованная: пока stage не отклонён, повторный
запуск с той же версией упадёт. Устаревшие stage нужно отклонять через `npm stage reject`.

Workflow меняет манифесты только в своём временном checkout и не создаёт коммитов. Перед первой
публикацией каждого нового публичного пакета настройте в npm его GitHub Actions Trusted Publisher:
репозиторий `jt4d-lab/nest-toolkit`, workflow filename `release.yml` и право
`--allow-stage-publish`. Право `--allow-publish` выдавать не нужно: без него `npm publish` из CI
падает с `OIDC permission denied for this action`, то есть релиз невозможно опубликовать минуя
подтверждение. У пакета может быть только одна trust-конфигурация. То же самое через CLI
(npm@11.15.0+):

```bash
npm trust github @jt4d/nest-rbac \
    --file release.yml \
    --repo jt4d-lab/nest-toolkit \
    --allow-stage-publish
```

Убедитесь, что у trust-конфигурации нет права publish (`npm trust list <package>`), иначе гейт
подтверждения можно обойти.

Важно: workflow берётся из того коммита, на который смотрит тег. Ставьте тег на коммит, где уже есть
staged-publishing, иначе запустится старая версия workflow с прямой публикацией.

Подтверждение и настройка trust-конфигурации требуют включённой 2FA на аккаунте мейнтейнера.
