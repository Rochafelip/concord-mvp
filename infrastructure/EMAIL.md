# E-mail transacional e entregabilidade

A aplicação envia dois e-mails: confirmação de cadastro e recuperação de senha
(`backend/.../common/mail/MailService.java`). Este documento registra como o
envio está configurado, o que foi medido sobre a entrega, e o que precisa mudar
no dia em que o projeto tiver um domínio registrado.

## Configuração atual

SMTP do Gmail, autenticando como uma conta Gmail comum, com `From` no mesmo
endereço. Variáveis em `.env` (veja `.env.example`):

| Variável | Papel |
|---|---|
| `MAIL_HOST` / `MAIL_PORT` | `smtp.gmail.com:587`, STARTTLS |
| `MAIL_USERNAME` | a conta autenticada |
| `MAIL_PASSWORD` | **App Password** de 16 caracteres, não a senha da conta (exige verificação em duas etapas ativa) |
| `MAIL_FROM` | endereço no cabeçalho `From` |
| `MAIL_FROM_NAME` | nome de exibição, `Concord` |
| `MAIL_REPLY_TO` | opcional; vazio faz as respostas irem para `MAIL_FROM` |
| `MAIL_ENABLED` | `false` registra em log em vez de enviar |

## O estado da autenticação hoje

Medido em 2026-09-15 consultando o DNS:

```
gmail.com                TXT   v=spf1 redirect=_spf.google.com
_dmarc.gmail.com         TXT   v=DMARC1; p=none; sp=quarantine; rua=...
concordmvp.duckdns.org   TXT   (nenhum registro)
```

Como o `From` é `@gmail.com` e quem envia é o próprio Google, **SPF, DKIM e
DMARC já passam e já estão alinhados**. Não há autenticação quebrada para
consertar. Se um e-mail cai no spam, não é por falta de SPF/DKIM/DMARC.

## Por que não dá para configurar SPF/DKIM/DMARC neste domínio

A API do DuckDNS escreve registros A/AAAA e **um único** TXT no ápice do
subdomínio — e esse TXT é justamente o que a renovação DNS-01 do certificado
consome ([`DUCKDNS.md`](./DUCKDNS.md)). Ela não cria labels filhos, e DKIM exige
`<seletor>._domainkey.<domínio>` enquanto DMARC exige `_dmarc.<domínio>`.

Não é configuração malfeita: é um limite da plataforma. Publicar SPF, DKIM ou
DMARC em `concordmvp.duckdns.org` é impossível enquanto o hostname for do
DuckDNS.

## O que realmente pesa contra a entrega, em ordem

1. **Os links apontam para `https://concordmvp.duckdns.org:45678/...`.** Host de
   DNS dinâmico em porta não-padrão. `duckdns.org` é muito usado em phishing e
   aparece em blocklists de URI (Spamhaus DBL, SURBL). Este é o sinal de maior
   peso, e **não tem solução sem um domínio registrado**.
2. Conta Gmail de consumidor enviando transacional, sem reputação de envio
   própria e sem histórico de volume.
3. Ausência de nome de exibição, `Reply-To` e cabeçalhos de automação —
   individualmente fracos, mas corrigíveis. Foi o que se fez aqui:
   `MAIL_FROM_NAME`, `MAIL_REPLY_TO`, `Auto-Submitted: auto-generated`, e
   `mail.from` no JavaMail para o `Message-ID` não sair com o id do container.

Ou seja: a melhoria possível hoje é real mas parcial. Enquanto o link for
`duckdns.org:45678`, parte dos provedores vai continuar classificando como spam,
e nenhuma mudança de código altera isso.

## Como testar

1. **Autenticação, por provedor.** Registre uma conta com um endereço Gmail e
   outro Outlook/Hotmail. No Gmail, abra o e-mail → ⋮ → **Mostrar original** e
   confira o bloco `Authentication-Results`: espera-se `spf=pass`, `dkim=pass` e
   `dmarc=pass`. No Outlook, **Exibir origem da mensagem**, mesmo cabeçalho.
2. **Onde caiu.** Anote a pasta de entrega (Entrada / Promoções / Spam) em cada
   provedor, para os dois e-mails — ativação e recuperação de senha.
3. **Pontuação geral.** Envie uma ativação para o endereço descartável gerado em
   [mail-tester.com](https://www.mail-tester.com/) e veja a nota. Espere perder
   pontos pelo domínio do link; esse é exatamente o item que não dá para
   resolver aqui.
4. Repita depois de qualquer mudança em `MAIL_*` ou no serviço de envio.

## Se o projeto ganhar um domínio registrado

É o que destrava tudo acima. Com o domínio em um DNS que aceite registros
arbitrários (Cloudflare, Registro.br com zona própria, etc.), e um serviço de
envio transacional que assine DKIM com o seu domínio — Resend e Brevo têm
plano gratuito suficiente para o volume deste projeto:

1. **Registre o domínio no serviço de envio** e publique os registros DKIM que
   ele fornecer. São sempre CNAMEs ou TXT em labels próprios, algo como:

   ```
   resend._domainkey.SEUDOMINIO   TXT   p=MIGfMA0GCSq...   (fornecido pelo serviço)
   ```

2. **SPF**, um único registro TXT no ápice, autorizando o serviço de envio:

   ```
   SEUDOMINIO   TXT   v=spf1 include:<host-do-servico> -all
   ```

   Nunca publique dois registros SPF no mesmo nome — isso é um erro de sintaxe
   que faz o SPF falhar por inteiro. Se já houver um, some os `include:`.

3. **DMARC**, começando permissivo e com relatórios, para observar antes de
   endurecer:

   ```
   _dmarc.SEUDOMINIO   TXT   v=DMARC1; p=none; rua=mailto:dmarc@SEUDOMINIO; pct=100
   ```

   Depois de algumas semanas de relatórios mostrando 100% de alinhamento, suba
   para `p=quarantine` e então `p=reject`.

4. **Atualize `.env`**: `MAIL_FROM=nao-responda@SEUDOMINIO`, `MAIL_HOST`/
   `MAIL_USERNAME`/`MAIL_PASSWORD` para as credenciais SMTP do serviço, e
   `APP_BASE_URL` para o domínio — é esta última que tira o link `duckdns` dos
   e-mails, a mudança de maior impacto.

5. **Emita o certificado para o domínio novo** pelo caminho do
   [`DEPLOY.md`](./DEPLOY.md) (certbot) e aposente o
   [`DUCKDNS.md`](./DUCKDNS.md).

**Não** mantenha o Gmail gratuito com um `From` no domínio novo. O Gmail
gratuito assina como `d=gmail.com` e usa `Return-Path` `@gmail.com`; com o
`From` em outro domínio, SPF e DKIM deixam de alinhar e o **DMARC falha** —
resultado pior do que a situação atual, em que tudo alinha. Um `From` no seu
domínio só funciona com um serviço que assine DKIM com o seu domínio (Resend,
Brevo, Google Workspace pago, etc.).

## Não é problema

`concordmvp.duckdns.org` responde com `MX 50 concordmvp.duckdns.org`, criado
automaticamente pelo DuckDNS e apontando para o IP do próprio deploy, onde nada
escuta na porta 25. Isso não afeta o envio, que sai de `@gmail.com`, e não é
causa de spam. Está registrado aqui para que ninguém gaste tempo perseguindo.
