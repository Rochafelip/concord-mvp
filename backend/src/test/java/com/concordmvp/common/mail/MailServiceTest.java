package com.concordmvp.common.mail;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.Session;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Properties;
import java.io.ByteArrayOutputStream;

class MailServiceTest {

    private final JavaMailSender sender = mock(JavaMailSender.class);

    private MailService mailService(boolean enabled) {
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        return new MailService(sender, "concord@example.com", enabled);
    }

    private MimeMessage captureSent() {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        return captor.getValue();
    }

    private String rawMessage(MimeMessage message) throws Exception {
        var output = new ByteArrayOutputStream();
        message.writeTo(output);
        return output.toString(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Test
    void sendsTheVerificationLinkToTheRightAddress() throws Exception {
        mailService(true).sendVerificationEmail("alice@example.com", "Alice", "https://app/verify-email?token=abc");

        MimeMessage sent = captureSent();
        assertThat(sent.getRecipients(MimeMessage.RecipientType.TO)[0].toString()).isEqualTo("alice@example.com");
        assertThat(sent.getFrom()[0].toString()).isEqualTo("concord@example.com");
        assertThat(rawMessage(sent)).contains("Alice").contains("verify-email").contains("token")
                .contains("Confirme seu e-mail");
    }

    @Test
    void sendsThePasswordResetLinkToTheRightAddress() throws Exception {
        mailService(true).sendPasswordResetEmail("bob@example.com", "Bob", "https://app/reset-password?token=xyz");

        MimeMessage sent = captureSent();
        assertThat(sent.getRecipients(MimeMessage.RecipientType.TO)[0].toString()).isEqualTo("bob@example.com");
        assertThat(rawMessage(sent)).contains("Bob").contains("reset-password").contains("token")
                .contains("Redefinir minha senha");
    }

    @Test
    void swallowsDeliveryFailures() {
        doThrow(new MailSendException("smtp unreachable")).when(sender).send(any(MimeMessage.class));

        // A signup must not be undone because an email bounced: the account already works, and
        // the banner offers a resend. Surfacing this would invite a retry of a request that
        // already succeeded.
        assertThatCode(() -> mailService(true).sendVerificationEmail("a@b.com", "A", "link"))
                .doesNotThrowAnyException();
    }

    @Test
    void sendsNothingWhenMailIsDisabled() {
        mailService(false).sendVerificationEmail("a@b.com", "A", "link");

        verify(sender, never()).send(any(MimeMessage.class));
    }
}
