package com.concordmvp.common.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * The two transactional emails this application sends.
 *
 * Plain text on purpose: HTML would mean a template engine and cross-client rendering checks for
 * no functional gain on a link the user just needs to click.
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
        send(to, "Confirme seu e-mail no Concord", """
                Olá, %s!

                Confirme seu e-mail para proteger sua conta no Concord:

                %s

                O link vale por 24 horas. Se não foi você quem criou esta conta, ignore esta mensagem.
                """.formatted(displayName, link));
    }

    @Async("mailExecutor")
    public void sendPasswordResetEmail(String to, String displayName, String link) {
        send(to, "Redefinir sua senha no Concord", """
                Olá, %s!

                Recebemos um pedido para redefinir sua senha. Use o link abaixo:

                %s

                O link vale por 1 hora e só pode ser usado uma vez. Se não foi você quem pediu,
                ignore esta mensagem: sua senha atual continua valendo.
                """.formatted(displayName, link));
    }

    private void send(String to, String subject, String body) {
        if (!enabled) {
            log.info("Mail disabled; would have sent '{}' to {}", subject, to);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
        } catch (Exception e) {
            log.error("Failed to send '{}' to {}", subject, to, e);
        }
    }
}
