# DuckDNS + Let's Encrypt (deploy doméstico)

Runbook do caminho que este deploy usa de verdade: um hostname gratuito do
[DuckDNS](https://www.duckdns.org/) apontando para o IP público do PC, com um
certificado Let's Encrypt real emitido pelo acme.sh via desafio DNS-01.

Isto substitui o certificado self-signed e o IP cru descritos em
[`HOME_DEPLOY.md`](./HOME_DEPLOY.md), que continua sendo a referência para
roteador, firewall e portas. Para um VPS com domínio próprio e certbot, veja
[`DEPLOY.md`](./DEPLOY.md).

## Por que DNS-01 e não HTTP-01

O provedor de internet deste deploy bloqueia tráfego de entrada nas portas 80 e
443 (confirmado em `HOME_DEPLOY.md` §5), e o desafio HTTP-01 do Let's Encrypt
exige a porta 80 alcançável. O desafio DNS-01 não usa porta nenhuma: ele prova a
posse do domínio publicando um registro TXT, e a API do DuckDNS permite escrever
esse TXT com o token da conta.

Essa mesma capacidade tem um limite que importa muito para e-mail: o DuckDNS
oferece **um único** registro TXT no ápice do subdomínio, e é ele que o DNS-01
consome. Não há como criar `_dmarc.` nem `<seletor>._domainkey.`, então SPF,
DKIM e DMARC próprios são impossíveis neste hostname. Veja
[`EMAIL.md`](./EMAIL.md).

## Configuração

Duas variáveis em `.env` (veja `.env.example`):

```
DUCKDNS_SUBDOMAIN=concordmvp
DUCKDNS_TOKEN=<token da conta DuckDNS>
```

O serviço `duckdns` em `docker-compose.yml` usa as duas para manter o registro A
apontado para o IP público atual do PC — é o que torna desnecessário o
procedimento manual de "se o seu IP público mudar" do `HOME_DEPLOY.md`.

## Emissão inicial

Só é feita uma vez. O estado resultante fica em `duckdns/acme-state/`, que é
gitignored porque contém a chave privada do certificado e a chave da conta
Let's Encrypt.

```bash
cd infrastructure
mkdir -p duckdns/acme-state nginx/certs

DUCKDNS_TOKEN="$(grep -E '^DUCKDNS_TOKEN=' .env | cut -d= -f2-)"
DUCKDNS_SUBDOMAIN="$(grep -E '^DUCKDNS_SUBDOMAIN=' .env | cut -d= -f2-)"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/acme.sh \
  -e DuckDNS_Token="${DUCKDNS_TOKEN}" \
  -v "$(pwd)/duckdns/acme-state:/acme.sh" \
  neilpang/acme.sh --home /acme.sh \
  --register-account -m "$(grep -E '^ACME_EMAIL=' .env | cut -d= -f2-)"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/acme.sh \
  -e DuckDNS_Token="${DUCKDNS_TOKEN}" \
  -v "$(pwd)/duckdns/acme-state:/acme.sh" \
  neilpang/acme.sh --home /acme.sh \
  --issue --dns dns_duckdns -d "${DUCKDNS_SUBDOMAIN}.duckdns.org"
```

O `--user "$(id -u):$(id -g)"` não é cosmético: sem ele o acme.sh grava todo o
estado como `root` dentro da árvore de trabalho, e **toda renovação futura
falha** porque `renew.sh` roda com o seu uid. Veja "Solução de problemas".

Depois disso, implante o certificado com o script de renovação — ele detecta que
o certificado emitido difere do implantado e faz a cópia:

```bash
./duckdns/renew.sh
```

## Renovação

[`duckdns/renew.sh`](./duckdns/renew.sh) faz a execução completa: pede ao acme.sh
que renove se estiver dentro da janela de 30 dias, e **só então**, se o
certificado realmente mudou, copia o par para `nginx/certs/`, recarrega o nginx e
reinicia o livekit.

O "só se mudou" é essencial, não uma otimização. Implantar significa
`docker compose restart livekit`, que derruba todas as chamadas de voz ativas —
o LiveKit não recarrega o listener TLS a quente. Um cron diário que reiniciasse
incondicionalmente desconectaria os usuários uma vez por dia sem motivo.

A comparação é contra o certificado **implantado**, não contra um instantâneo de
antes/depois da execução. Assim, uma execução anterior que renovou mas falhou no
meio da cópia é corrigida na execução seguinte, em vez de deixar o nginx servindo
um certificado velho até a próxima janela de renovação.

### O acme.sh se auto-atualiza a cada execução

A imagem `neilpang/acme.sh` vem com auto-upgrade ligado, então toda execução
consulta o GitHub e, quando há versão nova, baixa e instala o acme.sh master
dentro de `acme-state/` antes de renovar:

```
[...] Downloading https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
[...] Automatically upgraded to: 3.1.5
```

Nas execuções seguintes isso vira `Already up to date!` e nada é baixado. Duas
consequências práticas: a renovação depende do GitHub estar acessível, e a versão
do acme.sh usada não é a fixada na tag da imagem, mas a atual do repositório
upstream. Para um deploy entre amigos isso é aceitável e é o padrão da imagem;
se algum dia incomodar, `--auto-upgrade 0` congela a versão — ao custo de ter que
atualizar manualmente quando o protocolo ACME mudar.

### Agendamento

O script é idempotente e barato, então roda todo dia:

```bash
( crontab -l 2>/dev/null; echo '17 4 * * * cd /caminho/para/concord-mvp/infrastructure && ./duckdns/renew.sh >> "$HOME/.local/state/concordmvp/duckdns-renew.log" 2>&1' ) | crontab -
mkdir -p "$HOME/.local/state/concordmvp"
```

Ajuste o caminho do repositório. O log fica fora da árvore do repositório de
propósito, para não poluir o `git status` nem exigir mais uma regra de ignore.

Em WSL2, isso depende de `systemd=true` em `/etc/wsl.conf` e do `cron.service`
ativo (`systemctl is-active cron`). Sem systemd, o cron não sobe sozinho e a
renovação nunca roda. O cron também só dispara com o WSL em execução — o que é
verdade por construção aqui, já que é o mesmo WSL que hospeda os containers.

### Verificação

```bash
crontab -l | grep renew.sh                      # o agendamento existe?
./duckdns/renew.sh                              # deve dizer "No change" e não reiniciar nada
systemctl is-active cron                        # deve dizer "active"
```

E contra o deploy vivo, de fora:

```bash
echo | openssl s_client -connect concordmvp.duckdns.org:45678 \
  -servername concordmvp.duckdns.org 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

`issuer` deve ser Let's Encrypt (não o `CN` do próprio domínio, que indicaria o
certificado self-signed antigo) e `notAfter` deve estar a mais de 30 dias.

## Solução de problemas

**`can't open '/acme.sh/account.conf': Permission denied`** — o estado foi criado
por uma execução como root e `renew.sh` roda com o seu uid. O script detecta isso
antes de chamar o acme.sh e imprime o comando exato; é:

```bash
sudo chown -R "$(id -u):$(id -g)" infrastructure/duckdns/acme-state
```

**`Could not find an issued certificate`** — a emissão inicial nunca rodou, ou
rodou para outro subdomínio. Confira `ls duckdns/acme-state/`.

**O navegador continua alertando** — o certificado foi renovado mas não
implantado, ou o nginx não recarregou. Rode `./duckdns/renew.sh` e confira a
linha final, que imprime o `subject` e o `notAfter` do certificado efetivamente
implantado.

## Nomes dos arquivos

`renew.sh` copia o par para `nginx/certs/selfsigned.crt` e `selfsigned.key`.
Os nomes ficaram herdados do caminho self-signed e hoje são enganosos: em
produção esses arquivos guardam o certificado Let's Encrypt real. Estão mantidos
porque `livekit/livekit.yaml` referencia esses caminhos exatos em
`turn.cert_file`/`turn.key_file`, e `certbot/deploy-hook.sh` faz o mesmo no
caminho do `DEPLOY.md` — renomear exigiria mudar os três de uma vez, sem ganho
funcional.
