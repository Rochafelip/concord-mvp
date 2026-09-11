# Plano de implementação: Avatar e User Settings

**Especificação:** [2026-09-11-user-avatar-settings-design.md](../specs/2026-09-11-user-avatar-settings-design.md)

## Resultado esperado

Permitir que usuários adicionem, substituam, visualizem e removam o avatar,
com armazenamento local privado, validação do conteúdo real da imagem, fallback
visual do Concord e atualização em tempo real em todos os contextos que exibem
um usuário. A única área funcional de configurações será Perfil.

## Fase 1 — Preparar modelo, configuração e contratos backend

### 1.1 Revisar e preservar compatibilidade do modelo

- Confirmar todos os consumidores de `User`, `MeResponse` e
  `UserSummaryResponse`.
- Criar uma migração Flyway que preserve `NULL` para usuários existentes e
  renomeie `avatar_url` para `avatar_storage_key`, ou faça a transição
  equivalente sem perda de dados.
- Atualizar `User` para usar o nome de storage key internamente.
- Manter `avatarUrl` como campo público derivado nos DTOs.
- Garantir que senha, hash, timestamps internos e demais dados privados não
  entrem em respostas de resumo.

### 1.2 Definir configuração de uploads

- Reutilizar `APP_UPLOADS_DIR` e o volume `backend_uploads` já existentes.
- Adicionar configuração específica para diretório de avatars e limite de
  5 MB.
- Configurar limite multipart/request de forma que o backend consiga retornar
  `413` para arquivos acima do limite.
- Não adicionar S3, Redis ou nova infraestrutura.

### 1.3 Criar contratos de avatar

- Adicionar DTOs/constantes necessárias para upload e respostas.
- Definir o caminho público derivado:
  `/api/v1/users/{userId}/avatar`.
- Adicionar `USER_PROFILE_UPDATE` ao enum de eventos.
- Reutilizar `UserSummaryResponse` como payload público do evento.

## Fase 2 — Implementar storage e validação segura

### 2.1 Criar serviço de storage isolado

- Criar uma interface pequena para salvar, abrir e remover avatar.
- Implementar storage local sob:
  `/app/uploads/avatars/{userId}/{opaque-file-id}`.
- Criar diretórios de usuário de forma segura.
- Gerar o nome interno com UUID ou outro identificador opaco.
- Nunca concatenar o nome original enviado pelo cliente no caminho.
- Normalizar e verificar que todos os caminhos resolvidos permanecem dentro do
  diretório de avatars.

### 2.2 Implementar validação de imagem

- Validar tamanho antes de persistir.
- Aceitar apenas JPEG, PNG, GIF e WebP.
- Verificar MIME declarado e extensão permitida.
- Decodificar o conteúdo com um leitor de imagem para detectar arquivo
  corrompido ou conteúdo que não corresponda ao tipo declarado.
- Rejeitar arquivo vazio, tipo desconhecido, mismatch MIME/extensão/conteúdo e
  arquivos que não possam ser decodificados.
- Não confiar no filename, no `Content-Type` ou apenas nos bytes mágicos.
- Usar mensagens de erro compatíveis com o `GlobalExceptionHandler`.

### 2.3 Definir transição de arquivo

- Salvar o novo arquivo antes de trocar a chave no banco.
- Persistir a nova chave somente após o arquivo estar completo.
- Remover o arquivo antigo depois que a nova referência estiver persistida.
- Se a persistência falhar, tentar limpar somente o novo arquivo e propagar o
  erro.
- Se a limpeza do arquivo antigo falhar, registrar e tratar conforme o padrão
  de erro operacional existente; não retornar um sucesso silencioso quando a
  operação não puder ser concluída com segurança.

## Fase 3 — Implementar serviço e endpoints de usuário

### 3.1 Evoluir `UserService`

- Adicionar operação para atualizar/substituir avatar.
- Adicionar operação para remover avatar.
- Derivar a URL pública somente quando houver `avatar_storage_key`.
- Reutilizar `getCurrentUser` para autorização do próprio usuário.
- Publicar o evento somente depois de banco e arquivo estarem consistentes.
- Manter `updateProfile` e `changePassword` sem alteração comportamental
  indevida.

### 3.2 Adicionar endpoints

- `PUT /api/v1/users/me/avatar` com multipart field `file`.
- `DELETE /api/v1/users/me/avatar`.
- `GET /api/v1/users/{userId}/avatar`.
- Garantir autenticação nos três endpoints.
- Para o `GET`, validar que o usuário solicitante possui o mesmo contexto de
  acesso usado para receber o resumo do usuário; não criar endpoint anônimo.
- Servir o tipo seguro detectado no storage e impedir interpretação de nomes
  enviados pelo cliente.
- Retornar `404` quando o usuário não possui avatar ou o arquivo não existe.
- Retornar `400` para conteúdo inválido e `413` para tamanho excedido.
- Manter `GET /me`, `PATCH /me` e os DTOs atuais compatíveis.

### 3.3 Atualizar publicação realtime

- Adicionar publicação de `USER_PROFILE_UPDATE` após upload e remoção.
- Montar payload com apenas `UserSummaryResponse`.
- Incluir avatar URL derivada e `null` após remoção.
- Garantir que a publicação não inclua email, status de verificação ou dados
  privados.
- Verificar o caminho de broadcast usado pelo `RealtimeEventPublisher`.

## Fase 4 — Integrar todos os usos backend/frontend de usuário

### 4.1 Backend

- Confirmar que mensagens, membros de servidor e presença de voz continuam
  usando `UserSummaryResponse`.
- Confirmar que nenhum endpoint adicional serializa a entidade `User`.
- Atualizar testes que constroem `User` ou esperam `avatarUrl`.
- Verificar que chamadas e screen sharing recebem o avatar através do resumo
  de presença, sem transportar avatar por mídia/WebRTC.

### 4.2 Tipos e cache frontend

- Atualizar tipos para representar o payload `USER_PROFILE_UPDATE`.
- Criar helper de atualização por `user.id` para evitar lógica duplicada.
- Atualizar o `authStore` quando o evento atingir o usuário atual.
- Atualizar mensagens, membros, presença de voz e demais caches locais que
  contenham `UserSummaryResponse`.
- Garantir que uma atualização recebida antes de uma lista ser carregada não
  cause erro nem substitua dados incompletos de forma destrutiva.
- Preservar usuários antigos com `avatarUrl: null`.

### 4.3 WebSocket

- Adicionar o novo tipo ao cliente e aos testes do realtime.
- Processar o evento no hook/store de sincronização existente.
- Verificar que não é necessário renovar JWT, recarregar a página ou fazer
  logout/login.

## Fase 5 — Evoluir o componente Avatar

- Manter API de tamanhos `sm`, `md` e `lg`, adicionando estados explícitos
  apenas quando necessários.
- Usar `ConcordMark` centralizado em círculo com cores da paleta Concord
  quando não houver URL.
- Adicionar fallback após erro de carregamento da imagem.
- Adicionar estado de loading sem quebrar o tamanho reservado do layout.
- Manter `alt`/`aria-label` com o display name.
- Evitar layout shift e imagens sem dimensões previsíveis.
- Cobrir AppShell, MessageList, membros, presença e tiles/strips de chamadas
  com o componente único.

## Fase 6 — Adicionar controles de avatar em Settings

### 6.1 API e hooks frontend

- Adicionar funções `uploadAvatar` e `removeAvatar` em `features/settings/api`.
- Adicionar mutations correspondentes em `features/settings/hooks`.
- Fazer o upload como `FormData`, sem definir manualmente o boundary
  multipart.
- Atualizar o `authStore` usando a resposta `MeResponse`.
- Propagar erros `400`, `413`, falha de conexão e erros genéricos pelo padrão
  de `ApiError`.

### 6.2 UI de Perfil

- Adicionar preview grande do avatar atual.
- Adicionar input de arquivo com `accept` para os formatos suportados.
- Validar antecipadamente tamanho e tipo no navegador, sem substituir a
  validação do backend.
- Exibir Adicionar/Alterar, Remover, pendente, sucesso, arquivo inválido,
  arquivo grande, indisponibilidade e falha de conexão.
- Desabilitar ações conflitantes durante upload/remoção.
- Limpar o input após sucesso ou erro apropriado para permitir selecionar o
  mesmo arquivo novamente.
- Manter Perfil, Senha e Áudio funcionando.
- Não adicionar controles inativos para Conta, Aparência ou Voz e vídeo; manter
  a organização preparada para futuras seções.

## Fase 7 — Testes

### Backend

- Teste unitário do validador para cada formato permitido.
- Testes para extensão/MIME incompatíveis, conteúdo não-imagem, corrupção,
  vazio, arquivo acima de 5 MB e filename malicioso.
- Testes de serviço para criar, substituir, remover e preservar avatar após
  falha.
- Teste de controller para status, multipart, conteúdo servido, autenticação e
  `404`.
- Teste de privacidade dos DTOs.
- Teste de publicação de `USER_PROFILE_UPDATE`.
- Teste de migração/integração compatível com a infraestrutura de testes
  existente, se houver cobertura Flyway configurada.

### Frontend

- `Avatar`: imagem válida, fallback ConcordMark, erro de carregamento e
  loading.
- API/hooks: `FormData`, sucesso e erro.
- Settings: adicionar, substituir, remover, pending, sucesso, invalidação e
  arquivo inválido.
- Realtime: atualização do usuário atual, mensagem, membro e presença por id.
- Regressão de usuários sem avatar e componentes de chamadas.

Executar primeiro os testes direcionados de users/avatar/settings/realtime;
depois executar a suíte backend/frontend existente se os testes direcionados
passarem.

## Fase 8 — Documentação e verificação final

- Atualizar [ARCHITECTURE.md](../../ARCHITECTURE.md) com storage privado,
  endpoint autenticado e evento realtime.
- Atualizar [DATABASE.md](../../DATABASE.md) com a chave de storage e a
  ausência de bytes no PostgreSQL.
- Atualizar [DECISIONS.md](../../DECISIONS.md) com a política de avatar de
  5 MB, formatos e decisão de storage local.
- Verificar manualmente:
  - usuário novo sem avatar;
  - upload válido;
  - substituição;
  - remoção;
  - imagem indisponível;
  - atualização em mensagem, membro, app shell e chamada;
  - refresh da página sem necessidade de novo login;
  - usuário antigo com `NULL`.
- Conferir `git diff`, testes e ausência de arquivos temporários ou dados
  enviados pelo usuário no repositório.

## Ordem de execução resumida

1. Migração e configuração.
2. Storage e validação.
3. Serviço, endpoints e DTOs.
4. Evento realtime e integração de caches.
5. Componente Avatar.
6. Settings/Profile.
7. Testes direcionados e suíte existente.
8. Documentação e verificação final.

## Critérios de conclusão

- Nenhum avatar é salvo no PostgreSQL.
- Nenhum usuário existente perde acesso ou quebra por `NULL`.
- Uploads inválidos não são persistidos.
- Avatar não é servido anonimamente.
- A alteração aparece sem logout/login em todos os usos cobertos.
- Respostas públicas não expõem email ou informações de autenticação.
- O fallback usa a identidade visual do Concord.
- A suíte de testes relevante passa.
