package com.concordmvp.messages;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageAttachmentRepository extends JpaRepository<MessageAttachment, UUID> {

    /**
     * Loads the attachments of a whole page of messages in one query, ordered so that a caller
     * can group consecutive rows by message without re-sorting. Batching matters here: the
     * history endpoint returns up to 100 messages, and a per-message lookup would mean 100
     * queries.
     */
    List<MessageAttachment> findByMessageIdInOrderByMessageIdAscPositionAsc(Collection<UUID> messageIds);

    /** Resolves a served file's URL back to the message/channel it belongs to, for authorization. */
    Optional<MessageAttachment> findByUrl(String url);
}
