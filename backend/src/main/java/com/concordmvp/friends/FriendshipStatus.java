package com.concordmvp.friends;

/**
 * The state of a {@link Friendship}. Values match the {@code chk_friendships_status} CHECK
 * constraint on the {@code friendships} table (V19__create_friendships.sql) exactly. There is no
 * {@code DECLINED} value — a declined or cancelled request simply deletes the row, and a removed
 * friendship does the same.
 */
public enum FriendshipStatus {
    PENDING,
    ACCEPTED
}
