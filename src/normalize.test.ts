import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMentionedOrReplied, normalizeDelivery } from "./normalize.js";

describe("normalizeDelivery and isMentionedOrReplied", () => {
  it("extracts text, mentions, and quotes from delivery payload", () => {
    const payload = {
      event_name: "message.text.received",
      message: {
        message_id: "m-123",
        text: "@bot hello there",
        chat: { id: "chat-1", chat_type: "GROUP" },
        from: { id: "user-1", display_name: "Alice", is_bot: false },
        mentions: [{ uid: "bot-id-1", pos: 0, len: 4 }],
        quote: {
          message_id: "m-prev",
          from: { id: "bot-id-1", is_bot: true },
          text: "previous reply",
        },
      },
    };

    const msg = normalizeDelivery(payload);
    assert.ok(msg);
    assert.equal(msg.text, "@bot hello there");
    assert.equal(msg.mentions.length, 1);
    assert.equal(msg.mentions[0].uid, "bot-id-1");
    assert.ok(msg.quote);
    assert.equal(msg.quote.messageId, "m-prev");
    assert.equal(msg.quote.isBot, true);

    // Should detect mentioned or replied
    assert.equal(isMentionedOrReplied(msg, "bot-id-1"), true);
  });

  it("identifies private messages as always mentioned", () => {
    const payload = {
      event_name: "message.text.received",
      message: {
        message_id: "m-2",
        text: "hello private",
        chat: { id: "user-1", chat_type: "PRIVATE" },
        from: { id: "user-1", display_name: "Alice", is_bot: false },
      },
    };

    const msg = normalizeDelivery(payload);
    assert.ok(msg);
    assert.equal(isMentionedOrReplied(msg), true);
  });

  it("returns false for group message without mention, reply, or @", () => {
    const payload = {
      event_name: "message.text.received",
      message: {
        message_id: "m-3",
        text: "just chatting with family",
        chat: { id: "group-1", chat_type: "GROUP" },
        from: { id: "user-2", display_name: "Bob", is_bot: false },
      },
    };

    const msg = normalizeDelivery(payload);
    assert.ok(msg);
    assert.equal(isMentionedOrReplied(msg, "bot-id-1"), false);
  });

  it("recognizes @ in text for group message if mentions array is empty", () => {
    const payload = {
      event_name: "message.text.received",
      message: {
        message_id: "m-4",
        text: "@Bot help me",
        chat: { id: "group-1", chat_type: "GROUP" },
        from: { id: "user-2", display_name: "Bob", is_bot: false },
      },
    };

    const msg = normalizeDelivery(payload);
    assert.ok(msg);
    assert.equal(isMentionedOrReplied(msg), true);
  });

  it("recognizes reply to bot message even without text mentions", () => {
    const payload = {
      event_name: "message.text.received",
      message: {
        message_id: "m-5",
        text: "yes please",
        chat: { id: "group-1", chat_type: "GROUP" },
        from: { id: "user-2", display_name: "Bob", is_bot: false },
        quote: {
          message_id: "bot-msg",
          from: { id: "my-bot-id", is_bot: true },
        },
      },
    };

    const msg = normalizeDelivery(payload);
    assert.ok(msg);
    assert.equal(isMentionedOrReplied(msg, "my-bot-id"), true);
  });
});
