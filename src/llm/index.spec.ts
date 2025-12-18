import { describe, expect, test } from 'bun:test';
import { Output, generateText } from 'ai';
import z from 'zod';
import { createLLM } from '.';

describe('llm', () => {
  const shouldRun = process.env.RUN_LLM_TESTS === '1' && !!process.env.ANTHROPIC_API_KEY;

  (shouldRun ? test : test.skip)('generates object', async () => {
    const llm = createLLM();
    expect(llm).not.toBeNull();
    const res = await generateText({
      model: llm,
      output: Output.object({ schema: z.object({ text: z.string() }) }),
      prompt: 'Hello, world!',
    });
    expect(res.output.text).toBeTruthy();
  });
});
