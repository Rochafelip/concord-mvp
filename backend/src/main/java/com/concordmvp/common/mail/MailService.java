package com.concordmvp.common.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * The two transactional emails this application sends.
 *
 * Every send is async and every failure is swallowed after logging. A signup or a reset request
 * must never fail because SMTP was unreachable -- the user's account works either way and there
 * is a resend button, so surfacing a delivery error would only invite them to retry a request
 * that already succeeded.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final String from;
    private final boolean enabled;

    public MailService(
            JavaMailSender sender,
            @Value("${app.mail.from:}") String from,
            @Value("${app.mail.enabled:true}") boolean enabled
    ) {
        this.sender = sender;
        this.from = from;
        this.enabled = enabled;
    }

    @Async("mailExecutor")
    public void sendVerificationEmail(String to, String displayName, String link) {
        sendHtml(to, "Confirme seu e-mail no Concord", displayName, link,
                "Confirme seu e-mail", "Este link é válido por 24 horas.");
    }

    @Async("mailExecutor")
    public void sendPasswordResetEmail(String to, String displayName, String link) {
        sendHtml(to, "Redefinir sua senha no Concord", displayName, link,
                "Redefinir minha senha", "Este link é válido por 1 hora e só pode ser usado uma vez.");
    }

    private void sendHtml(String to, String subject, String displayName, String link,
                          String buttonLabel, String expiryMessage) {
        if (!enabled) {
            log.info("Mail disabled; would have sent '{}' to {}", subject, to);
            return;
        }

        try {
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plainText(displayName, link, expiryMessage),
                    html(displayName, link, buttonLabel, expiryMessage));
            sender.send(message);
        } catch (Exception e) {
            log.error("Failed to send '{}' to {}", subject, to, e);
        }
    }

    private String plainText(String displayName, String link, String expiryMessage) {
        return """
                Olá, %s!

                %s

                %s

                Se o botão não funcionar, copie e cole este endereço no navegador:
                %s

                Se não foi você quem solicitou esta ação, ignore esta mensagem.
                """.formatted(displayName, "Acesse o Concord usando o link abaixo:", expiryMessage, link);
    }

    private String html(String displayName, String link, String buttonLabel, String expiryMessage) {
        return """
                <!doctype html>
                <html lang="pt-BR">
                  <body style="margin:0;background:#f5f5fa;color:#23243a;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f5fa;padding:32px 16px;">
                      <tr><td align="center">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d9dbe7;border-radius:16px;overflow:hidden;">
                          <tr><td style="background:#6d4ffa;padding:28px 32px;text-align:center;">
                            <div style="color:#ffffff;font-size:26px;font-weight:700;letter-spacing:.4px;">Concord</div>
                            <div style="color:#e9e5ff;font-size:13px;margin-top:6px;">Comunicação simples, do seu jeito.</div>
                          </td></tr>
                          <tr><td style="padding:36px 32px 32px;">
                            <h1 style="margin:0 0 18px;color:#23243a;font-size:24px;line-height:1.25;">Olá, %s!</h1>
                            <p style="margin:0 0 24px;color:#6b6f85;font-size:16px;line-height:1.6;">
                              %s
                            </p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                              <tr><td align="center" style="padding:4px 0 28px;">
                                <a href="%s" style="display:inline-block;background:#6d4ffa;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;">
                                  %s
                                </a>
                              </td></tr>
                            </table>
                            <p style="margin:0 0 12px;color:#6b6f85;font-size:14px;line-height:1.5;">%s</p>
                            <p style="margin:0;color:#6b6f85;font-size:13px;line-height:1.5;">
                              Se o botão não funcionar, <a href="%s" style="color:#5b3ee0;">acesse este link</a>.
                            </p>
                          </td></tr>
                          <tr><td style="background:#f5f5fa;padding:20px 32px;text-align:center;">
                            <p style="margin:0;color:#6b6f85;font-size:12px;line-height:1.5;">
                              Se você não solicitou esta ação, pode ignorar este e-mail com segurança.
                            </p>
                          </td></tr>
                        </table>
                      </td></tr>
                    </table>
                  </body>
                </html>
                """.formatted(escape(displayName), escape(expiryMessage), escape(link),
                escape(buttonLabel), escape(expiryMessage), escape(link));
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
