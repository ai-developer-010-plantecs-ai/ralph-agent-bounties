import { z } from "zod";

import { createAgentApp } from "@lucid-agents/hono";

import { createAgent } from "@lucid-agents/core";
import { http } from "@lucid-agents/http";
import { createAxLLMClient } from "@lucid-agents/core/axllm";
import { payments, paymentsFromEnv } from "@lucid-agents/payments";

const agent = await createAgent({
  name: process.env.AGENT_NAME ?? "my-agent",
  version: process.env.AGENT_VERSION ?? "0.1.0",
  description: process.env.AGENT_DESCRIPTION,
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const axClient = createAxLLMClient({
  logger: {
    warn(message, error) {
      if (error) {
        console.warn(`[agent] ${message}`, error);
      } else {
        console.warn(`[agent] ${message}`);
      }
    },
  },
});

if (!axClient.isConfigured()) {
  console.warn(
    "[agent] Ax LLM provider not configured — falling back to scripted output."
  );
}

const { app, addEntrypoint } = await createAgentApp(agent);

const inputSchema = z.object({
  text: z.string().min(1, "Please provide some text."),
});

addEntrypoint({
  key: "echo",
  description: "Echo input text",
  input: inputSchema,
  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    return {
      output: {
        text: input.text,
      },
    };
  },
});

export { app };