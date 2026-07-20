# Tribo — Estado da checklist de funcionalidades

_Última atualização: 2026-07-20_

Estado atual da lista de melhorias pedida.

**Legenda de estado:** ✅ Feito · 🟡 Parcial · ❌ Por fazer
**Coluna "Quando":** `Já existia` = pré-existente · `Implementado` = feito no âmbito destas melhorias · `—` = ainda por fazer

| # | Item | Estado | Quando | Notas |
|---|------|:------:|--------|-------|
| 1 | Regras de passwords na BD em vez de "hardcoded" | ✅ | Implementado | `PasswordPolicy` + `PasswordPolicyRepository` (singleton em Datastore, com defaults). Validada no registo e na mudança de password. `GET /auth/password-policy` (público, para mostrar as regras) e `PUT /config/password-policy` (SYSADMIN) |
| 2 | Verificação de emails | ✅ | Implementado | Registo cria conta por confirmar + envia link por email (Jakarta Mail / SMTP Gmail, credenciais em Secret Manager). **Login bloqueado até confirmar** (`403 EMAIL_NOT_VERIFIED`). `POST /auth/verify-email` + `/auth/resend-verification`. UI: painel "check your email", página `/verify-email`, botão reenviar (web + mobile) |
| 3 | Contas privadas / mudar pwd / settings | ✅ | Implementado | Ecrã **Settings** (web `/settings` + nav; mobile via Perfil): mudar password e alternar privacidade PUBLIC/PRIVATE. Conta PRIVATE mascara nome/foto em clãs e feed a terceiros (exceto o próprio e roles privilegiados) |
| 4 | Dar pwd antiga para mudar | ✅ | Implementado | `POST /users/me/password` exige a **password atual**, valida a nova contra a policy e recusa reutilização |
| 5 | Filtro para local no *find activities* | ✅ | Implementado | Filtro de proximidade no backend (`nearLat`/`nearLng`/`radiusKm`, haversine) + "Near me" (GPS) no web e mobile + pesquisa de cidade (Google Places) no mapa web |
| 6 | Paginação para activities | ✅ | Já existia (melhorado) | Paginação por cursor já existia; foi combinada com filtros server-side e UI de páginas numeradas (Anterior/Próxima) |
| 7 | Marcadores diferentes por tipo de atividade | ✅ | Implementado | Pins por tipo (verde = voluntariado, azul = corrida) no web (`MapView`) e mobile (hue) + legenda; ícone por tipo nos cartões |
| 8 | Adicionar *searches* | ✅ | Implementado | Pesquisa de texto server-side (`q`: título/local/host/categoria/tags) com caixa de pesquisa no web e mobile |
| 9 | Não ser o activity manager a decidir a verificação necessária | ❌ | — | `verifiedBy` continua a ser escolhido pelo criador no `ActivityRequest` |
| 10 | Só empresas/organizações se podem pôr como host | ❌ | — | `host` é texto livre; PARTNER e ACTIVITY_MANAGER criam sem restrição de tipo de entidade |
| 11 | Notificações (ex.: corrida cancelada) | ❌ | — | Não existe sistema de notificações em nenhuma camada |
| 12 | Status *cancelled* da corrida | ✅ | Já existia | `ActivityStatus.CANCELLED` + `POST /activities/{id}/cancel` (soft, mantém histórico) |
| 13 | Possibilidade de reviews | ✅ | Já existia | `ReviewResource`: rating 1–5, só participantes, só após a atividade terminar; guarda `averageRating`/`reviewCount` |
| 14 | Anotar versão Android necessária/usada | 🟡 | Já existia | `minSdk = maxOf(flutter.minSdkVersion, 21)` em `build.gradle.kts` (por causa do Google Maps); ainda não documentado formalmente |
| 15 | Parâmetro de ranking pela qualidade das corridas (reviews) | ✅ | Implementado | Métrica `quality` no ranking de clãs: média das avaliações das atividades organizadas pelos membros, ponderada por nº de reviews (backend + web + mobile) |
| 16 | Searches/filtros gerais (tipo/distância/local) | ✅ | Implementado | Filtros server-side por `eventKind`, distância (`min/maxDistanceKm`) e local (proximidade) no web e mobile |
| 17 | Adicionar info de eventos externos depois de acontecerem | ❌ | — | Sem funcionalidade de resultados pós-evento; `EventKind` só tem `RUN`/`VOLUNTEER` |
| 18 | Gráficos vivos para o pace da corrida | ❌ | — | O `TrackerPage` mostra splits numéricos por km + pace atual, mas **sem** gráfico/linha de evolução |
| 19 | Gráfico de evolução de um user no perfil e/ou no clã | ❌ | — | Sem gráfico. O ranking tem uma seta de tendência (vs semana anterior), mas não um gráfico de evolução |

## Resumo

- ✅ **Feito:** 12 itens (1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 15, 16)
- 🟡 **Parcial:** 1 item (**14** — versão Android)
- ❌ **Por fazer:** 6 itens (9, 10, 11, 17, 18, 19)

## Detalhe do que foi implementado

### Autenticação e conta (itens 1–4)
- **Regras de password na BD** (1): policy configurável em Datastore, validada no registo e na mudança de password; endpoint público para as regras + endpoint SYSADMIN para as alterar.
- **Verificação de email** (2): fluxo completo com token + email (SMTP Gmail via Secret Manager); login bloqueado até confirmação; reenvio de link.
- **Settings + privacidade + mudar password** (3, 4): ecrã de Settings (web + mobile); mudança de password exige a atual; toggle de conta privada com mascaramento de identidade em clãs/feed.

### Descoberta de atividades (itens 5, 7, 8, 16)
- Pesquisa de texto + filtros server-side (`q`, `eventKind`, distância) via novo `ActivityRepository.search`; UI no web e mobile.
- Filtro por local: "Near me" (GPS, haversine, nearest-first) + pesquisa de cidade (Google Places) no mapa web.
- Marcadores por tipo (cores/hue) + legenda; ícone por tipo nos cartões.

### Ranking (item 15)
- Métrica `quality` no `/clans/ranking`, baseada nas reviews das atividades dos membros (web + mobile).

### Extra (fora da lista de 19)
- **Registo com data de nascimento** (em vez de idade); a idade é derivada.
- **Contas BACKOFFICE seeded** via `BOOTSTRAP_BACKOFFICE_EMAILS` — role dedicada para moderação em vez do SYSADMIN.
- **Proteção de segurança:** BACKOFFICE já não consegue suspender contas SYSADMIN.
- **Atividades terminadas** ficam assinaladas ("Ended") e esbatidas nos cartões/listas (web + mobile).
- **Spinner de loading** modernizado (boot fullscreen antes do React montar + overlay por página nas mudanças de separador).
- Correções: conflito de loader do Google Maps (loader partilhado) e 401 de `whoami` no arranque.
- **Deploy** contínuo do web e da API para App Engine (`tribo-497810`).

## Próximos passos (itens por fazer)

- **Rápidos / isolados:** 14 (documentar versão Android), 10 (restringir host a empresas/orgs).
- **Médios:** 11 (notificações, ex.: cancelamento), 9 (tirar a verificação da decisão do manager).
- **Maiores:** 17 (resultados de eventos externos), 18 e 19 (gráficos de pace e de evolução).
