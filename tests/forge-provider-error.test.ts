import { expect, it } from "vitest";
import { AIProviderRequestError } from "../src/utils/ai-core";
import { describeForgeProviderFailure } from "../src/utils/forge-generation";

it("shows OpenRouter's endpoint reason instead of a generic unavailable-model message", () => {
  const error = new AIProviderRequestError("No endpoints found for this model under your provider preferences", 404);
  expect(describeForgeProviderFailure(error, "openrouter", "quiz")).toContain(error.message);
});
