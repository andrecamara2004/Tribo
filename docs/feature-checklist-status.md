# Tribo — Estado da checklist de funcionalidades

_Última atualização: 2026-07-17_

Mapeamento da lista de melhorias pedida, indicando **o que já existia antes desta
sessão** e **o que foi feito nesta sessão**.

**Legenda de estado:** ✅ Feito · 🟡 Parcial · ❌ Por fazer
**Coluna "Sessão":** `Antes` = já existia · `Esta sessão` = feito agora · `—` = ainda não feito

| # | Item | Estado | Sessão | Notas |
|---|------|:------:|--------|-------|
| 1 | Regras de passwords na BD em vez de "hardcoded" | ❌ | — | `MIN_PASSWORD_LENGTH = 8` continua hardcoded em `AuthResource.java`; sem regras configuráveis em BD nem complexidade |
| 2 | Verificação de emails | ❌ | — | Não há fluxo de confirmação por email. O flag `verified` é a verificação do backoffice a roles privilegiados — coisa diferente |
| 3 | Contas privadas / mudar pwd / settings | 🟡 | Antes | Campo `User.ProfileVisibility` (PUBLIC/PRIVATE) existe, mas **sem endpoint/UI** para o alterar, sem mudança de password e sem ecrã de settings |
| 4 | Dar pwd antiga para mudar | ❌ | — | Não existe mudança de password |
| 5 | Filtro para local no *find activities* | ✅ | **Esta sessão** | Filtro de proximidade no backend (`nearLat`/`nearLng`/`radiusKm`, haversine) + "Near me" (GPS) no web e mobile + pesquisa de cidade (Google Places) no mapa web |
| 6 | Paginação para activities | ✅ | Antes + **Esta sessão** | Paginação por cursor já existia; nesta sessão foi combinada com filtros server-side e UI de páginas numeradas (Anterior/Próxima) |
| 7 | Marcadores diferentes por tipo de atividade | ✅ | **Esta sessão** | Pins por tipo (verde = voluntariado, azul = corrida) no web (`MapView`) e mobile (hue), + legenda; ícone por tipo nos cartões |
| 8 | Adicionar *searches* | ✅ | **Esta sessão** | Pesquisa de texto server-side (`q`: título/local/host/categoria/tags) com caixa de pesquisa no web e mobile |
| 9 | Não ser o activity manager a decidir a verificação necessária | ❌ | — | `verifiedBy` continua a ser escolhido pelo criador no `ActivityRequest` |
| 10 | Só empresas/organizações se podem pôr como host | ❌ | — | `host` é texto livre; PARTNER e ACTIVITY_MANAGER criam sem restrição de tipo de entidade |
| 11 | Notificações (ex.: corrida cancelada) | ❌ | — | Não existe sistema de notificações em nenhuma camada |
| 12 | Status *cancelled* da corrida | ✅ | Antes | `ActivityStatus.CANCELLED` + `POST /activities/{id}/cancel` (soft, mantém histórico) |
| 13 | Possibilidade de reviews | ✅ | Antes | `ReviewResource`: rating 1–5, só participantes, só após a atividade terminar; guarda `averageRating`/`reviewCount` |
| 14 | Anotar versão Android necessária/usada | 🟡 | Antes | `minSdk = maxOf(flutter.minSdkVersion, 21)` em `build.gradle.kts` (por causa do Google Maps); não está formalmente documentado |
| 15 | Parâmetro de ranking pela qualidade das corridas (reviews) | ✅ | **Esta sessão** | Nova métrica `quality` no ranking de clãs: média das avaliações das atividades organizadas pelos membros, ponderada por nº de reviews (backend + web + mobile) |
| 16 | Searches/filtros gerais (tipo/distância/local) | ✅ | **Esta sessão** | Filtros server-side por `eventKind`, distância (`min/maxDistanceKm`) e local (proximidade) no web e mobile |
| 17 | Adicionar info de eventos externos depois de acontecerem | ❌ | — | Sem funcionalidade de resultados pós-evento; `EventKind` só tem `RUN`/`VOLUNTEER` |
| 18 | Gráficos vivos para o pace da corrida | ❌ | — | O `TrackerPage` mostra splits numéricos por km + pace atual, mas **sem** gráfico/linha de evolução |
| 19 | Gráfico de evolução de um user no perfil e/ou no clã | ❌ | — | Sem gráfico. O ranking tem uma seta de tendência (vs semana anterior), mas não um gráfico de evolução |

## Resumo

- ✅ **Feito:** 8 itens (5, 6, 7, 8, 12, 13, 15, 16)
  - Já existiam antes: **12, 13** (e a base do **6**)
  - Feitos nesta sessão: **5, 7, 8, 15, 16** (e **6** melhorado)
- 🟡 **Parcial:** 2 itens (**3, 14**) — ambos pré-existentes, não avançados nesta sessão
- ❌ **Por fazer:** 9 itens (1, 2, 4, 9, 10, 11, 17, 18, 19)

## Detalhe do que foi feito nesta sessão

### Novas funcionalidades (da lista)
- **Pesquisa + filtros de atividades** (itens 5, 8, 16): `GET /activities` ganhou `q`, `eventKind`, `minDistanceKm`, `maxDistanceKm` (novo `ActivityRepository.search`, filtragem em memória + paginação por offset). Web e mobile com caixa de pesquisa, filtro de tipo e de distância.
- **Filtro por local / "Near me"** (item 5): proximidade por haversine (`nearLat`/`nearLng`/`radiusKm`), ordenação nearest-first. Web e mobile com toggle "Near me" (GPS) + raio; no mapa web, pesquisa de cidade via Google Places (contribuição de teammate, integrada no merge).
- **Marcadores por tipo** (item 7): cores por `eventKind` no web e mobile + legenda.
- **Ranking por qualidade (reviews)** (item 15): métrica `quality` no `/clans/ranking` (web + mobile).

### Extra (fora da lista, feito nesta sessão)
- **Spinner de loading** reutilizável no web (substitui os textos "Loading…" em Activities, Find, ActivityDetail, ActivityForm, Backoffice, Feed, ranking de clãs e ProtectedRoute).
- **Correções de bugs** no separador *Find*: conflito de loader do Google Maps (loader único partilhado em `src/lib/maps.ts`) e 401 de `whoami` no arranque (refresh antes do probe).
- **Merge com o main** (PR do teammate): reconciliação de `ActivitiesPage`, `FindActivityPage` e `MapView` (filtros server-side + páginas numeradas; pesquisa de cidade + "Near me"; marcadores unificados).
- **Deploy** do web e da API para App Engine (`tribo-497810`).

## Sugestão de próximos passos (itens por fazer, agrupados por esforço)

- **Rápidos / isolados:** 14 (documentar versão Android), 10 (restringir host a empresas/orgs).
- **Médios:** 11 (notificações, ex.: cancelamento), 3+4 (settings: privacidade + mudar password com pwd antiga), 9 (tirar a verificação da decisão do manager).
- **Maiores:** 1 (regras de password em BD), 2 (verificação de email — precisa de envio de emails), 17 (resultados de eventos externos), 18 e 19 (gráficos de pace e de evolução).
