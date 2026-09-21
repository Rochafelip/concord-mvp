# Auditoria de Segurança — Concord (2026-09-18)

Auditoria somente-leitura, dividida em 6 domínios (auth/authz, messages/DM/realtime, media/uploads/LiveKit, banco de dados, frontend, Docker/CI/infra). Nenhum arquivo de código foi alterado nesta etapa. Achados ordenados por severidade global.

Resumo: **1 Crítica, 12 Alta, ~15 Média, ~25 Baixa/informativa**. A base está, em geral, bem construída (JWT, hashing de tokens, IDOR em REST, magic-byte validation em uploads, cursor pagination, ausência de SQL injection/XSS clássico) — os achados abaixo são os desvios reais encontrados com evidência.

---

## 🔴 CRÍTICA

### C1. Broadcasts WebSocket ignoram permissão VIEW_CHANNEL por canal — ✅ CORRIGIDO
- **Status:** Corrigido em PR #33 (`fix/ws-channel-visibility-broadcast`, merged em `dev`). `PermissionService.visibleMemberIds(channel, candidateMemberIds)` agora filtra por `VIEW_CHANNEL` antes de qualquer broadcast, e é usado pelos 3 serviços afetados (`MessageService`, `ChannelService`, `ChannelReadStateService`). Cobertura de teste confirmada em `MessageServiceTest` (cenário com membro sem `VIEW_CHANNEL` por override de canal).
- **Arquivos:** `backend/src/main/java/com/concordmvp/messages/MessageService.java:186,211,272-274` (MESSAGE_CREATE/DELETE), `channels/ChannelService.java:99-101,125-127` (CHANNEL_CREATE/DELETE), `messages/ChannelReadStateService.java:136-154` (CHANNEL_READ)
- **Descrição (achado original):** Todos os broadcasts em tempo real calculavam destinatários como "todos os membros do servidor" (`currentMemberIds(serverId)`), sem filtrar por quem tem `VIEW_CHANNEL` no canal específico. O REST (`getHistory`) respeitava essa restrição corretamente — só o WebSocket vazava.
- **Impacto (achado original):** Qualquer membro do servidor recebia em tempo real o conteúdo de mensagens, criação/exclusão de canais e status de leitura de canais privados/restritos aos quais não tinha acesso — bypass total de autorização, mesmo que ele não conseguisse ler via REST.
- **Correção aplicada:** Helper único (`visibleMemberIds`) reutilizado pelos 3 serviços, calculando a interseção entre membros do servidor e quem tem VIEW_CHANNEL no canal, antes de qualquer `broadcast`.
- **Teste:** Canal com override negando VIEW_CHANNEL para usuário B; A posta/apaga mensagem, cria/apaga canal, ou marca como lido; verificar que B não recebe o evento via WS.

---

## 🟠 ALTA

### A1. Login sem rate limiting/lockout
`auth/AuthController.java:55-62`, `auth/AuthService.java:51-61`. O `RateLimiter` já existe e é usado em reset/verificação de e-mail, mas não no login. Brute-force/credential stuffing sem limite. **Correção:** aplicar `RateLimiter` por IP+email com backoff. **Teste:** N logins inválidos seguidos → deve bloquear antes de esgotar tentativas.

### A2. Logout não revoga o JWT (token de 30 dias sem denylist)
`auth/AuthController.java:68-73`, `auth/JwtService.java:21-46`. Logout só limpa o cookie; o JWT continua válido até expirar (30 dias) ou troca de senha. **Correção:** denylist de `jti` (mesmo em memória/Redis) ou refresh token de curta duração com rotação. **Teste:** logout, reapresentar o mesmo JWT, confirmar rejeição (após fix).

### A3. CHANNEL_CREATE/DELETE vazam existência de canais restritos via WS
`channels/ChannelService.java:99-101,125-127`. Mesma causa raiz de C1 — contradiz o próprio design de `PermissionService.requireVisible` (retorna 404 para não revelar existência do canal). Ver correção em C1.

### A4. Download de anexos sem autenticação (segurança por obscuridade do UUID) — ✅ CORRIGIDO
- **Status:** Corrigido. `/api/v1/uploads/**` saiu do `permitAll()` em `SecurityConfig` — agora exige o cookie de sessão como qualquer outra rota. `AttachmentServingController.serve` resolve a URL requisitada de volta ao `MessageAttachment` → `Message` → canal (`MessageService.requireAttachmentAccess`, novo) e aplica exatamente a mesma checagem usada para ler o histórico de mensagens: `ChannelService.getChannel` (404 se o canal não é visível) + `PermissionService.requireChannel(..., READ_MESSAGE_HISTORY)` (403 se visível mas sem permissão). Um usuário removido do servidor perde acesso imediatamente, já que deixa de ser membro visível do canal.
- **Arquivos:** `messages/AttachmentServingController.java`, `messages/MessageService.java` (`requireAttachmentAccess`), `messages/MessageAttachmentRepository.java` (`findByUrl`), `config/SecurityConfig.java`.
- **Descrição (achado original):** `messages/AttachmentServingController.java:28-45`, `config/SecurityConfig.java:50` (`/api/v1/uploads/**` em `permitAll()`). Qualquer pessoa com a URL (vazada via Referer, cache de preview, logs, print) acessava o arquivo permanentemente, mesmo sem ser membro do servidor/canal, sem possibilidade de revogação seletiva.
- **Teste:** `MessageServiceTest.requireAttachmentAccess_unknownUrl_throwsNotFound`, `requireAttachmentAccess_nonMember_propagatesForbiddenFromChannelService`, `requireAttachmentAccess_withoutReadMessageHistory_throwsForbidden`, `requireAttachmentAccess_memberWithPermission_doesNotThrow`.
- **Observação:** o preview do composer (paperclip, drag & drop, colar) usa `URL.createObjectURL` no navegador antes do envio — o upload real só acontece no envio (AGENTS.md), então não há janela em que o cliente precise buscar a URL do servidor antes de existir um `MessageAttachment`.

### A5. Token LiveKit não é revogado quando o vínculo com o servidor termina — ✅ CORRIGIDO (parcial)
- **Status:** Corrigido para `leaveServer`. `MediaService.removeParticipant(channelId, userId)` (novo) chama a Server API do LiveKit (`POST /twirp/livekit.RoomService/RemoveParticipant`) com um token admin (`roomAdmin: true`, escopado à room) assinado com o mesmo segredo já usado para os tokens de join — sem adicionar `io.livekit:livekit-server` (mesma justificativa de dependência do resto da classe), usando `RestClient` (já vem com `spring-web`). `VoicePresenceService.disconnectFromServer(serverId, userId)` (novo) resolve, a partir do próprio tracking de presença em memória, se o usuário está conectado a algum canal de voz *deste* servidor; se estiver, chama `removeParticipant` e limpa a presença. `ServerService.leaveServer` chama `disconnectFromServer` logo após remover a membership. A chamada é best-effort (captura `RestClientException`, loga e nunca propaga) — LiveKit fora do ar não pode bloquear o usuário de sair do servidor.
- **Arquivos:** `media/MediaService.java` (`removeParticipant`, `buildRoomAdminToken`), `media/VoicePresenceService.java` (`disconnectFromServer`), `servers/ServerService.java` (`leaveServer`), `application.yml`/`application-dev.yml` (`livekit.server-url`, nova), `infrastructure/docker-compose.yml` (`LIVEKIT_SERVER_URL=http://livekit:7880`, alcançado pela rede interna do Docker — distinto de `LIVEKIT_PUBLIC_URL`, que os clientes usam via nginx).
- **Descrição (achado original):** `media/MediaService.java:57,84-101` (TTL de 6h, sem integração com LiveKit Server API), `servers/ServerService.java:217-233` (`leaveServer` não chamava `RoomServiceClient.removeParticipant`). Usuário que saía do servidor continuava com áudio/vídeo/tela ativos na chamada por até 6h.
- **Teste:** `MediaServiceTest.removeParticipant_sendsRemoveParticipantRequestToLiveKitServerApi`, `_sendsAnAdminTokenScopedToTheRoom`, `_livekitUnreachableOrErrors_doesNotThrow` (via `MockRestServiceServer`, sem servidor real); `VoicePresenceServiceTest.disconnectFromServer_*` (3 cenários); `ServerServiceTest.leaveServer_disconnectsFromVoiceInThisServer`.
- **Pendente (fora do escopo pedido, não implementado):** a auditoria também cita "é removido" — hoje não existe endpoint de expulsão de membro do servidor (moderação não implementada, ver AGENTS.md), então isso é só `leaveServer` mesmo. `deleteServer` (exclusão do servidor inteiro) não itera os membros conectados para desconectá-los do LiveKit — quem estiver em chamada continua até o TTL de 6h expirar. `VoicePresenceService.disconnectParticipant` (o "kick" de voz existente, via `DISCONNECT_MEMBERS`) também não chama `removeParticipant` — hoje só emite o evento WS `VOICE_KICK`, que um cliente adulterado poderia ignorar e permanecer conectado ao LiveKit.

### A6. Exceções genéricas retornam 500 sem nenhum log
`common/GlobalExceptionHandler.java:102-105`. `DataIntegrityViolationException` e qualquer outra exceção não mapeada viram 500 silencioso, sem `log.error`. Torna as race conditions abaixo (A7, e as de friendship) invisíveis em produção. **Correção:** logar com stacktrace completo antes de responder; handler dedicado para `DataIntegrityViolationException` → 409.

### A7. Race condition no registro de e-mail sem tratamento de constraint
`auth/AuthService.java:33-49`. `existsByEmail` + `save` sem transação/lock; dois cadastros concorrentes com o mesmo e-mail geram uma `DataIntegrityViolationException` não tratada → 500 em vez de 409. **Correção:** capturar a violação e converter para `ConflictException`. **Teste:** duas threads registrando o mesmo e-mail simultaneamente → uma 201, outra 409 (nunca 500).

### A8. Sem constraint UNIQUE em `users.username` — ✅ CORRIGIDO
- **Status:** Corrigido. `db/migration/V21__add_username_unique_constraint.sql` normaliza duplicatas existentes (renomeia todas menos a conta mais antiga por username, sufixando com parte do próprio id — seguro porque amizades/DMs referenciam usuários por id, não username) e adiciona `ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username)`. `UserRepository.existsByUsername`/`existsByUsernameAndIdNot` são checados em `AuthService.register` e `UserService.updateProfile`, ambos lançando `ConflictException` (409) antes de tocar o banco.
- **Arquivos:** `backend/src/main/resources/db/migration/V21__add_username_unique_constraint.sql`, `auth/AuthService.java:55-57`, `users/UserService.java:69-73`, `users/UserRepository.java:13-15`
- **Descrição (achado original):** `db/migration/V1__create_users.sql`, `users/User.java:23-24`, `users/UserService.java:69-76`. `username` é usado como identidade pública (amizades, DMs, membros) mas nunca teve unicidade garantida em lugar nenhum. **Correção:** migração `ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username)` (após normalizar duplicatas) + validação em register/updateProfile.
- **Teste:** `AuthServiceTest.register_throwsConflict_whenUsernameAlreadyTaken`, `UserServiceTest.updateProfile_throwsConflict_whenUsernameTakenByAnotherUser` — dois usuários com o mesmo username → 409.

### A9. Broadcast de exclusão de servidor acontece antes do commit da transação — ✅ CORRIGIDO (parcial)
- **Status:** Corrigido para `ServerService.deleteServer`. O `SERVER_DELETE` agora é publicado como `ServerDeletedEvent` (via `ApplicationEventPublisher`) só depois de todas as exclusões, e um listener `@TransactionalEventListener(phase = AFTER_COMMIT)` (`ServerService.onServerDeleted`) é quem de fato chama `realtimeEventPublisher.broadcast` — nunca antes do commit, e nunca se a transação sofrer rollback. `deleteServer` não interage mais com `RealtimeEventPublisher` diretamente.
- **Arquivos:** `servers/ServerService.java` (`deleteServer`, `onServerDeleted`), `servers/ServerDeletedEvent.java` (novo).
- **Descrição (achado original):** `servers/ServerService.java:258-296`. `SERVER_DELETE` era publicado antes das exclusões subsequentes; se qualquer uma falhasse, a transação sofria rollback mas o cliente já tinha sido notificado — bug já sinalizado em comentário no próprio código.
- **Teste:** `ServerServiceTest.deleteServer_deletesEverythingAndOnlyThenPublishesTheDeleteEvent_neverBroadcastingDirectly`, `ServerServiceTest.onServerDeleted_broadcastsTheDeleteEventToRecipients`.
- **Pendente:** o mesmo padrão (`MessageService.persistAndBroadcast`) continua com o achado equivalente de severidade Baixa, fora do escopo desta correção — não foi tocado.

### A10. PDF renderizado em iframe sem `sandbox`, classificação só por extensão da URL
`frontend/src/features/chat/MessageList.tsx:28-30,295-302`. Se o backend algum dia falhar em validar o conteúdo real (hoje valida corretamente por magic bytes — ver A11 abaixo para o caso equivalente no backend), um HTML/JS disfarçado de `.pdf` executaria dentro do iframe na origem da aplicação. **Correção:** adicionar `sandbox` sem `allow-scripts`, defesa em profundidade mesmo com o backend correto.

### A11. Runner self-hosted do GitHub Actions em repositório público usado para deploy de produção
`.github/workflows/cd-production.yml:16`, `rollback-production.yml:18`. Repositório é público; workflows de deploy rodam num runner self-hosted na própria máquina de produção. Mitigado hoje (só dispara em push a `master` protegida ou `workflow_dispatch` manual), mas desenho frágil. **Correção:** documentar que nenhum workflow com trigger `pull_request`/`pull_request_target` pode usar `self-hosted`; considerar `environment` protection rule.

### A12. `enforce_admins: false` na proteção de branch (gap entre política documentada e configuração real)
Confirmado via `gh api repos/.../branches/master/protection`. `CI_CD.md` documenta "no direct pushes", mas a config real permite ao admin dar push direto/merge sem CI verde em `master`/`dev`. **Correção:** ativar `enforce_admins` em ambas as branches.

---

## 🟡 MÉDIA (resumo — detalhe completo nos relatórios dos agentes)

- Registro sem rate limiting + enumeração de e-mail via 409 (`AuthService.java:33-36`)
- CHANNEL_READ vaza metadados de leitura para quem não tem VIEW_CHANNEL (mesma causa de C1)
- Race condition em `FriendshipService.acceptRequest` (sem `@Version`/update condicional) → notificação duplicada
- N+1 real em `FriendshipService.listFriends`/`listPending` (query por amigo em vez de `findAllById` em lote)
- `ServerService.getInvitePreview` carrega lista inteira de membros só para contar (endpoint público sem auth)
- Cascade delete inconsistente entre tabelas (channels/messages/server_members sem `ON DELETE CASCADE`, dependendo 100% da lógica manual em `deleteServer`)
- Sem configuração explícita de HikariCP (pool/timeout/leak detection)
- `ImageIO.read` sem limite de dimensão no upload de avatar (decompression bomb / DoS de memória)
- Nenhum backup do banco de dados (`docker-compose.yml`, confirmado como lacuna intencional em `DEPLOY.md`)
- Containers sem `cap_drop`/`no-new-privileges`/`read_only`
- `.env` de produção com permissão `644` em vez de `600`
- `unreadCount` sobrescrito para 0 em race entre `onMutate` otimista e `MESSAGE_CREATE` concorrente (frontend)
- Checkbox de papel de membro não desabilita durante mutation pendente → cliques duplos concorrentes (frontend)
- `websocketClient.connect()` não fecha socket existente antes de abrir um novo (sem proteção estrutural, não acionado hoje)

## 🟢 BAIXA / informativo

Diferença de tempo de resposta no login (timing side-channel), `RateLimiter` em memória (não distribuído), JWT secret de fallback hardcoded no perfil dev, `sendRequest` de amizade sem tratamento de constraint (500 em vez de 409), inconsistência 403 vs 404 em `ChannelReadStateController`, broadcast de mensagem antes do commit, sem deduplicação de mensagens por `clientMessageId`, backfill de migração sem lote, índices sub-ótimos em `friendships`/`roles`, avatar sem limite de multipart dedicado (aceita até 150MB antes de rejeitar em 5MB), sem rate limit em uploads de anexo/avatar, PDFs servidos inline na mesma origem, timeouts não limpos em `InvitePeopleModal`/`useRealtimeSync`, `ServerSidebar` sem estado de erro, reconexão WS sem backoff exponencial, workflows CI sem bloco `permissions:` explícito, credenciais triviais no Postgres de CI (efêmero, risco nulo), certificado de produção sob nome "selfsigned" (risco de downgrade silencioso), serviços nginx/livekit/duckdns rodando como root, sem Dependabot/scanner de dependências.

## ✅ Verificado e correto (não são achados)

IDOR em REST (mensagens/DM/amigos/canais/servidores), hierarquia de roles e escalada de privilégio, path traversal em avatar/anexos (nomes sempre UUID gerados no servidor), hashing de tokens de reset/verificação, invalidação de sessão ao trocar senha, cookie httpOnly+secure+SameSite=Strict, handshake WebSocket com ticket single-use, SQL Injection (100% JPQL parametrizado), XSS clássico (sem `dangerouslySetInnerHTML`, token nunca em localStorage), paginação por cursor em mensagens/DMs, magic-byte validation em uploads, controle de acesso a avatar, emissão de token LiveKit checando membership/permissão antes de mintar, volume persistente de uploads, secrets não versionados no Git, branch protection com status checks obrigatórios, porta do Postgres não exposta publicamente.

---

## Relatórios completos por domínio
Os 6 agentes de auditoria produziram relatórios detalhados (evidência, arquivo:linha, teste necessário) para cada achado — este documento é a consolidação. Domínios: (1) auth & authorization, (2) messages/DM/realtime, (3) media/uploads/LiveKit, (4) banco de dados, (5) frontend React, (6) Docker/CI/infraestrutura.
