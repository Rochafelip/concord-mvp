# Unread Messages Feature Specification

## Overview

This specification defines the implementation of unread message tracking for the Concord MVP. The feature allows users to see which channels have unread messages and provides visual indicators to draw attention to new content.

## Goals

1. Track which channels have unread messages for each user
2. Provide visual indicators for channels with unread messages
3. Allow users to mark channels as read
4. Maintain accurate unread counts across sessions
5. Integrate seamlessly with existing message flow

## Non-Goals

1. Read receipts (showing who has read a specific message)
2. Per-message read/unread status
3. Cross-device synchronization of read states (initial implementation)
4. Unread message counts in server-level indicators
5. Push notifications for unread messages

## Architecture

### Database Schema

#### New Table: `channel_read_states`

```sql
CREATE TABLE channel_read_states (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_user_channel UNIQUE (user_id, channel_id)
);

CREATE INDEX idx_channel_read_states_user ON channel_read_states(user_id);
CREATE INDEX idx_channel_read_states_channel ON channel_read_states(channel_id);
CREATE INDEX idx_channel_read_states_user_channel ON channel_read_states(user_id, channel_id);
```

**Schema Decisions:**

- `last_read_message_id`: References the last message the user has read. Used for cursor-based read state tracking.
- `last_read_at`: Timestamp of when the user last marked the channel as read. Used for fallback calculations.
- `unread_count`: Cached count of unread messages. Updated incrementally for performance.
- `ON DELETE CASCADE`: Automatically cleans up read states when users or channels are deleted.
- Unique constraint on `(user_id, channel_id)`: Ensures one read state per user-channel pair.

### Backend Components

#### 1. Entity: `ChannelReadState`

**Location:** `backend/src/main/java/com/concordmvp/messages/ChannelReadState.java`

```java
@Entity
@Table(name = "channel_read_states")
public class ChannelReadState {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(name = "last_read_message_id")
    private UUID lastReadMessageId;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;

    @Column(name = "unread_count", nullable = false)
    private Integer unreadCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // Standard JPA lifecycle callbacks and getters/setters
}
```

#### 2. Repository: `ChannelReadStateRepository`

**Location:** `backend/src/main/java/com/concordmvp/messages/ChannelReadStateRepository.java`

```java
public interface ChannelReadStateRepository extends JpaRepository<ChannelReadState, UUID> {
    Optional<ChannelReadState> findByUserIdAndChannelId(UUID userId, UUID channelId);

    List<ChannelReadState> findByUserId(UUID userId);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.unreadCount = s.unreadCount + 1 WHERE s.userId = :userId AND s.channelId = :channelId")
    int incrementUnreadCount(@Param("userId") UUID userId, @Param("channelId") UUID channelId);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.unreadCount = 0, s.lastReadMessageId = :messageId, s.lastReadAt = :timestamp WHERE s.userId = :userId AND s.channelId = :channelId")
    int markAsRead(@Param("userId") UUID userId, @Param("channelId") UUID channelId, @Param("messageId") UUID messageId, @Param("timestamp") Instant timestamp);
}
```

#### 3. Service: `ChannelReadStateService`

**Location:** `backend/src/main/java/com/concordmvp/messages/ChannelReadStateService.java`

**Responsibilities:**

- Initialize read state when user joins a server
- Increment unread count when new messages are sent
- Mark channels as read when user accesses them
- Get unread status for channels
- Handle edge cases (deleted messages, channel deletions, etc.)

**Key Methods:**

```java
@Service
public class ChannelReadStateService {
    // Initialize read state for user in a channel
    public ChannelReadState initializeReadState(UUID userId, UUID channelId);

    // Increment unread count for all members of a channel
    public void incrementUnreadForChannelMembers(UUID channelId, UUID excludeUserId);

    // Mark channel as read for a specific user
    public ChannelReadState markChannelAsRead(UUID userId, UUID channelId, UUID lastReadMessageId);

    // Get read state for a user-channel pair
    public Optional<ChannelReadState> getReadState(UUID userId, UUID channelId);

    // Get all read states for a user
    public List<ChannelReadState> getUserReadStates(UUID userId);

    // Recalculate unread count from scratch (for data consistency)
    public void recalculateUnreadCount(UUID userId, UUID channelId);
}
```

#### 4. Controller: `ChannelReadStateController`

**Location:** `backend/src/main/java/com/concordmvp/messages/ChannelReadStateController.java`

**Endpoints:**

```java
@RestController
@RequestMapping("/api/v1/channels")
public class ChannelReadStateController {

    // Mark channel as read
    @PostMapping("/{channelId}/read")
    public ResponseEntity<Void> markChannelAsRead(
        @PathVariable UUID channelId,
        @RequestBody MarkChannelReadRequest request
    );

    // Get read state for a channel
    @GetMapping("/{channelId}/read-state")
    public ChannelReadStateResponse getReadState(@PathVariable UUID channelId);
}
```

**Request/Response DTOs:**

```java
public record MarkChannelReadRequest(UUID lastReadMessageId) {}

public record ChannelReadStateResponse(
    UUID channelId,
    UUID lastReadMessageId,
    Instant lastReadAt,
    Integer unreadCount
) {}
```

#### 5. Integration with MessageService

**Location:** `backend/src/main/java/com/concordmvp/messages/MessageService.java`

**Changes:**

- After persisting a new message, call `ChannelReadStateService.incrementUnreadForChannelMembers()`
- Pass the author's userId to exclude them from unread increment
- Handle transaction rollback scenarios (if message creation fails, unread increment should also fail)

**Implementation:**

```java
@Transactional
public Message sendMessage(UUID channelId, String content, String imageUrl, String fileName, Long fileSize, UUID authorId) {
    // ... existing validation and message creation logic ...

    Message saved = messageRepository.save(message);

    // Increment unread count for all channel members except author
    channelReadStateService.incrementUnreadForChannelMembers(channelId, authorId);

    // ... existing broadcast logic ...

    return saved;
}
```

#### 6. Integration with ChannelService

**Location:** `backend/src/main/java/com/concordmvp/channels/ChannelService.java`

**Changes:**

- When a user joins a server, initialize read states for all channels in that server
- When a new channel is created, initialize read states for all server members

**Implementation:**

```java
// In server join logic
public ServerMember joinServer(UUID serverId, UUID userId) {
    // ... existing join logic ...

    // Initialize read states for all channels in the server
    List<Channel> channels = channelRepository.findByServerId(serverId);
    for (Channel channel : channels) {
        channelReadStateService.initializeReadState(userId, channel.getId());
    }

    return serverMember;
}
```

### Frontend Components

#### 1. Type Updates

**Location:** `frontend/src/types/channel.ts`

```typescript
export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number; // New field
}
```

#### 2. API Layer

**Location:** `frontend/src/features/channels/api.ts`

```typescript
export async function markChannelAsRead(channelId: string, lastReadMessageId: string): Promise<void> {
  await apiClient.post(`/api/v1/channels/${channelId}/read`, {
    lastReadMessageId,
  });
}

export async function getChannelReadState(channelId: string): Promise<ChannelReadStateResponse> {
  return apiClient.get(`/api/v1/channels/${channelId}/read-state`);
}

export interface ChannelReadStateResponse {
  channelId: string;
  lastReadMessageId: string | null;
  lastReadAt: string;
  unreadCount: number;
}
```

#### 3. Channel Sidebar Updates

**Location:** `frontend/src/features/channels/ChannelSidebar.tsx`

**Changes:**

- Add unread indicator (blue dot) next to channel names
- Show unread count badge if count > 0
- Call `markChannelAsRead` when channel is selected

**Implementation:**

```tsx
// In the channel link rendering
<Link
  to={`/app/servers/${serverId}/channels/${channel.id}`}
  onClick={() => handleChannelClick(channel)}
  className={channelLinkClassName(channel.id === channelId)}
>
  <span aria-hidden="true">#</span>
  {channel.name}
  {channel.unreadCount > 0 && (
    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium text-white">
      {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
    </span>
  )}
</Link>

// Handler for marking as read
const handleChannelClick = (channel: Channel) => {
  if (channel.unreadCount > 0) {
    markChannelAsRead(channel.id, latestMessageId).catch(console.error);
  }
  onNavigate?.();
};
```

#### 4. Real-time Updates

**Location:** `frontend/src/services/websocketClient.ts`

**Changes:**

- Listen for `MESSAGE_CREATE` events
- Increment unread count locally when new message arrives in non-active channel
- Update channel list state

**Implementation:**

```typescript
case 'MESSAGE_CREATE':
  if (payload.channelId !== currentChannelId) {
    // Increment unread count for the channel
    setChannels(prevChannels =>
      prevChannels.map(channel =>
        channel.id === payload.channelId
          ? { ...channel, unreadCount: (channel.unreadCount || 0) + 1 }
          : channel
      )
    );
  }
  break;
```

#### 5. React Query Integration

**Location:** `frontend/src/features/channels/hooks.ts`

**Changes:**

- Add hook for marking channel as read
- Invalidate queries after marking as read
- Optimistic updates for better UX

**Implementation:**

```typescript
export function useMarkChannelAsRead() {
  return useMutation({
    mutationFn: ({ channelId, lastReadMessageId }: { channelId: string; lastReadMessageId: string }) =>
      markChannelAsRead(channelId, lastReadMessageId),
    onSuccess: (_, { channelId }) => {
      // Invalidate channels query to refresh unread counts
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
```

### Migration Strategy

#### Migration File

**Location:** `backend/src/main/resources/db/migration/V16__create_channel_read_states.sql`

```sql
-- Create channel_read_states table
CREATE TABLE channel_read_states (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_user_channel UNIQUE (user_id, channel_id)
);

-- Create indexes for performance
CREATE INDEX idx_channel_read_states_user ON channel_read_states(user_id);
CREATE INDEX idx_channel_read_states_channel ON channel_read_states(channel_id);
CREATE INDEX idx_channel_read_states_user_channel ON channel_read_states(user_id, channel_id);

-- Initialize read states for existing user-channel pairs
-- This ensures existing users start with clean read states
INSERT INTO channel_read_states (id, user_id, channel_id, last_read_at, unread_count)
SELECT 
    gen_random_uuid(),
    sm.user_id,
    c.id,
    now(),
    0
FROM server_members sm
JOIN channels c ON c.server_id = sm.server_id
ON CONFLICT (user_id, channel_id) DO NOTHING;
```

### Testing Strategy

#### Backend Tests

**Location:** `backend/src/test/java/com/concordmvp/messages/ChannelReadStateServiceTest.java`

**Test Cases:**

1. **Initialization:**
   - Initialize read state for new user-channel pair
   - Handle duplicate initialization (idempotent)
   - Initialize read states for all channels when user joins server

2. **Unread Count Increment:**
   - Increment unread count when message is sent
   - Exclude message author from unread increment
   - Handle non-existent read states (auto-create)

3. **Mark as Read:**
   - Mark channel as read with specific message ID
   - Reset unread count to zero
   - Update last_read_at timestamp
   - Handle marking already-read channel

4. **Edge Cases:**
   - Handle deleted messages
   - Handle deleted channels
   - Handle deleted users
   - Recalculate unread count from scratch

5. **Integration with MessageService:**
   - Verify unread count increments when message is sent
   - Verify transaction rollback on message creation failure

#### Frontend Tests

**Location:** `frontend/src/features/channels/ChannelSidebar.test.tsx`

**Test Cases:**

1. **Unread Indicator Display:**
   - Show blue dot when unreadCount > 0
   - Show no indicator when unreadCount = 0
   - Show count badge with correct number
   - Show "99+" for counts >= 100

2. **Mark as Read Interaction:**
   - Call API when channel with unread messages is clicked
   - Update local state after successful API call
   - Handle API errors gracefully

3. **Real-time Updates:**
   - Increment unread count when MESSAGE_CREATE event received
   - Don't increment for active channel
   - Update channel list state correctly

#### Integration Tests

**Test Scenarios:**

1. **Full Flow:**
   - User joins server → read states initialized
   - Another user sends message → unread count increments
   - First user sees unread indicator
   - First user clicks channel → unread count resets
   - API returns updated state

2. **Multiple Users:**
   - Message sent → unread increments for all members except author
   - Each user can independently mark as read
   - Read states don't interfere with each other

### Performance Considerations

1. **Database Indexes:**
   - Indexes on `user_id`, `channel_id`, and composite `(user_id, channel_id)` ensure fast lookups
   - Indexes support common query patterns

2. **Incremental Updates:**
   - Unread count is incremented rather than recalculated from scratch
   - Reduces database load on new messages

3. **Batch Operations:**
   - When initializing read states for server join, use batch inserts
   - When incrementing for channel members, use bulk update

4. **Caching:**
   - Consider caching read states in memory for frequently accessed users
   - Cache invalidation on state changes

### Security Considerations

1. **Authorization:**
   - Users can only mark their own channels as read
   - Users can only view their own read states
   - Server membership validation required

2. **Data Isolation:**
   - Read states are scoped to user-channel pairs
   - Users cannot access other users' read states

3. **Input Validation:**
   - Validate channel IDs and message IDs
   - Prevent SQL injection in dynamic queries

### Error Handling

1. **Database Errors:**
   - Handle constraint violations gracefully
   - Log errors for debugging
   - Return user-friendly error messages

2. **API Errors:**
   - Handle network failures
   - Implement retry logic for mark-as-read calls
   - Optimistic updates with rollback on failure

3. **Edge Cases:**
   - Handle missing read states (auto-create)
   - Handle deleted messages/channels/users
   - Handle concurrent updates

### Monitoring and Observability

1. **Metrics:**
   - Track unread count increments
   - Track mark-as-read operations
   - Monitor read state query performance

2. **Logging:**
   - Log read state initialization
   - Log unread count increments
   - Log errors and edge cases

3. **Debugging:**
   - Provide admin endpoints to inspect read states
   - Provide tools to recalculate inconsistent states

## Implementation Order

1. **Phase 1: Backend Foundation**
   - Create migration file
   - Implement ChannelReadState entity
   - Implement ChannelReadStateRepository
   - Implement ChannelReadStateService
   - Write backend unit tests

2. **Phase 2: Backend Integration**
   - Integrate with MessageService
   - Integrate with ChannelService
   - Implement ChannelReadStateController
   - Write integration tests

3. **Phase 3: Frontend Foundation**
   - Update TypeScript types
   - Implement API layer
   - Implement React Query hooks
   - Write frontend unit tests

4. **Phase 4: Frontend UI**
   - Update ChannelSidebar with unread indicators
   - Implement mark-as-read on channel click
   - Implement real-time updates
   - Write frontend integration tests

5. **Phase 5: Testing and Refinement**
   - End-to-end testing
   - Performance testing
   - Edge case handling
   - Documentation updates

## Success Criteria

1. ✅ Users can see which channels have unread messages
2. ✅ Unread counts are accurate and update in real-time
3. ✅ Marking a channel as read works correctly
4. ✅ Performance is acceptable (no significant slowdowns)
5. ✅ Edge cases are handled gracefully
6. ✅ Tests cover critical functionality
7. ✅ Documentation is updated

## Future Enhancements (Out of Scope for MVP)

1. Cross-device synchronization of read states
2. Read receipts (who has read a specific message)
3. Unread message counts in server-level indicators
4. Push notifications for unread messages
5. Mention highlighting (unread count for @mentions only)
6. Thread-level unread tracking
