import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applicationInstructions, buildMessages, requestAnswer, type Turn } from './core';

const makeTurn = (question = 'Explain this widget'): Turn => ({
  id: 'turn',
  question,
  context: {
    version: 1,
    route: '/en/dashboard',
    locale: 'en',
    capturedAt: '2026-11-11T12:00:00Z',
    data: null,
  },
});

void test('request includes instructions, complete historical pairs, and the question once', () => {
  const previous = { ...makeTurn('Earlier question'), answer: 'Earlier answer' };
  const messages = buildMessages([previous, makeTurn('Failed question')], makeTurn());
  assert.equal(messages[0].content, applicationInstructions);
  assert.deepEqual(
    messages.map((message) => message.role),
    ['system', 'user', 'assistant', 'user'],
  );
  assert.equal(
    messages.filter((message) => message.content.includes('Explain this widget')).length,
    1,
  );
  assert.equal(
    (JSON.parse(messages[1].content) as { currentApplicationContext: { capturedAt: string } })
      .currentApplicationContext.capturedAt,
    previous.context.capturedAt,
  );
});

void test('history budget trims complete pairs while preserving current context', () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    ...makeTurn(`old-${index}`),
    answer: 'x'.repeat(7000),
  }));
  const messages = buildMessages(history, makeTurn('current'));
  assert.ok(messages.reduce((size, message) => size + message.content.length, 0) <= 32000);
  assert.equal((messages.length - 2) % 2, 0);
  assert.equal(
    (JSON.parse(messages.at(-1)?.content ?? '{}') as { userMessage: string }).userMessage,
    'current',
  );
});

void test('rejects oversized questions and contexts before sending', () => {
  assert.throws(() => buildMessages([], makeTurn('x'.repeat(4001))), /tooLarge/);
  const turn = makeTurn();
  turn.context.route = 'x'.repeat(16000);
  assert.throws(() => buildMessages([], turn), /tooLarge/);
});

void test('fixed transport sends the key only in authorization and bounds output', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(input, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.credentials, 'omit');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fake-test-key');
    assert.equal(typeof init?.body, 'string');
    const rawBody = init?.body as string;
    const body = JSON.parse(rawBody) as { max_tokens: number };
    assert.equal(body.max_tokens, 1500);
    assert.ok(!rawBody.includes('fake-test-key'));
    return Promise.resolve(Response.json({ choices: [{ message: { content: 'Test answer' } }] }));
  };
  try {
    assert.equal(
      await requestAnswer(
        'fake-test-key',
        'openrouter/free',
        buildMessages([], makeTurn()),
        new AbortController().signal,
      ),
      'Test answer',
    );
  } finally {
    globalThis.fetch = original;
  }
});

void test('provider errors are classified without exposing provider bodies', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, message] of [
      [401, 'credentials'],
      [402, 'credits'],
      [429, 'rateLimit'],
      [400, 'modelError'],
      [500, 'network'],
    ] as const) {
      globalThis.fetch = () =>
        Promise.resolve(new Response('sensitive provider error', { status }));
      await assert.rejects(
        requestAnswer('fake', 'openrouter/free', [], new AbortController().signal),
        { message },
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});

void test('malformed responses and cancellation have safe errors', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = () => Promise.resolve(Response.json({ choices: [] }));
    await assert.rejects(
      requestAnswer('fake', 'openrouter/free', [], new AbortController().signal),
      /malformed/,
    );
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = () => Promise.reject(new Error('private network details'));
    await assert.rejects(
      requestAnswer('fake', 'openrouter/free', [], controller.signal),
      /stopped/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
