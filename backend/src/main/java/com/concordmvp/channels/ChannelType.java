package com.concordmvp.channels;

/**
 * The kind of a {@link Channel}. Values match the {@code chk_channels_type} CHECK constraint on
 * the {@code channels} table (V4__create_channels.sql, widened by V7 to add ONBOARDING) exactly.
 */
public enum ChannelType {
    TEXT,
    VOICE,
    ONBOARDING
}
