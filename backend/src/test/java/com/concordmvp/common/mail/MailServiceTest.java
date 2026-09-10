package com.concordmvp.common.mail;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class MailServiceTest {

    private final JavaMailSender sender = mock(JavaMailSender.class);

    private MailService mailService(boolean enabled) {
        return new MailService(sender, "concord@example.com", enabled);
    }

    private SimpleMailMessage captureSent() {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        return captor.getValue();
    }

    @Test
    void sendsTheVerificationLinkToTheRightAddress() {
        mailService(true).sendVerificationEmail("alice@example.com", "Alice", "https://app/verify-email?token=abc");

        SimpleMailMessage sent = captureSent();
        assertThat(sent.getTo()).containsExactly("alice@example.com");
        assertThat(sent.getFrom()).isEqualTo("concord@example.com");
        assertThat(sent.getText()).contains("Alice").contains("https://app/verify-email?token=abc");
    }

    @Test
    void sendsThePasswordResetLinkToTheRightAddress() {
        mailService(true).sendPasswordResetEmail("bob@example.com", "Bob", "https://app/reset-password?token=xyz");

        SimpleMailMessage sent = captureSent();
        assertThat(sent.getTo()).containsExactly("bob@example.com");
        assertThat(sent.getText()).contains("Bob").contains("https://app/reset-password?token=xyz");
    }

    @Test
    void swallowsDeliveryFailures() {
        doThrow(new MailSendException("smtp unreachable")).when(sender).send(any(SimpleMailMessage.class));

        // A signup must not be undone because an email bounced: the account already works, and
        // the banner offers a resend. Surfacing this would invite a retry of a request that
        // already succeeded.
        assertThatCode(() -> mailService(true).sendVerificationEmail("a@b.com", "A", "link"))
                .doesNotThrowAnyException();
    }

    @Test
    void sendsNothingWhenMailIsDisabled() {
        mailService(false).sendVerificationEmail("a@b.com", "A", "link");

        verify(sender, never()).send(any(SimpleMailMessage.class));
    }
}
