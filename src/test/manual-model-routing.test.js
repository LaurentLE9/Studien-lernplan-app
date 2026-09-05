import { describe, expect, it, vi } from "vitest";
import {
  capabilityForProviderModel,
  evaluateManualPreWriteGate,
  manualSwitchMessage,
  normalizeProvider,
  providerModelSpecForCapability,
  requiredCapabilityForManualBlock,
  runCli,
} from "../../scripts/manual-prewrite-model-gate.mjs";

describe("Temporary Manual Provider-Neutral Model Routing", () => {
  it("classifies work independently from the provider", () => {
    expect(requiredCapabilityForManualBlock({ files: 1, complexity: "low" })).toBe("low");
    expect(requiredCapabilityForManualBlock({ files: 3, complexity: "medium" })).toBe("medium");
    expect(requiredCapabilityForManualBlock({ files: 1, complexity: "low", security: true })).toBe("high");
  });

  it("resolves provider aliases", () => {
    expect(normalizeProvider("codex")).toBe("openai");
    expect(normalizeProvider("claude")).toBe("anthropic");
    expect(normalizeProvider("claude-code")).toBe("anthropic");
  });

  it("maps Claude capabilities to the configured current models", () => {
    expect(providerModelSpecForCapability("anthropic", "low")).toMatchObject({
      id: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5",
    });
    expect(providerModelSpecForCapability("claude", "medium")).toMatchObject({
      id: "claude-sonnet-5",
      label: "Claude Sonnet 5",
    });
    expect(providerModelSpecForCapability("claude-code", "high")).toMatchObject({
      id: "claude-opus-5",
      label: "Claude Opus 5",
    });
  });

  it("recognizes Claude model IDs, labels and aliases", () => {
    expect(capabilityForProviderModel("anthropic", "claude-haiku-4-5-20251001")).toBe("low");
    expect(capabilityForProviderModel("claude", "Claude Sonnet 5")).toBe("medium");
    expect(capabilityForProviderModel("claude-code", "opus")).toBe("high");
  });

  it("requests the correct Claude target model for a medium task", () => {
    const decision = evaluateManualPreWriteGate({
      provider: "claude",
      activeModel: "claude-haiku-4-5-20251001",
      files: 3,
      complexity: "medium",
    });

    expect(decision).toMatchObject({
      status: "MODEL_SWITCH_REQUIRED",
      activeCapability: "low",
      requiredCapability: "medium",
      targetModel: "Claude Sonnet 5",
      targetModelId: "claude-sonnet-5",
    });
    expect(manualSwitchMessage("medium", "claude")).toBe("Jetzt brauchen wir Claude Sonnet 5.");
  });

  it("requests Claude Opus 5 for high-risk work", () => {
    expect(manualSwitchMessage("high", "anthropic")).toBe("Jetzt brauchen wir Claude Opus 5.");
  });

  it("falls back to a capability-only message for an unmapped provider", () => {
    expect(manualSwitchMessage("high", "future-provider")).toBe(
      "Jetzt brauchen wir ein Modell der Stufe HIGH.",
    );
  });

  it("prints only the exact mapped Claude switch line in the CLI", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(
        runCli([
          "--provider",
          "claude",
          "--active-model",
          "claude-haiku-4-5-20251001",
          "--files",
          "3",
          "--complexity",
          "medium",
        ]),
      ).toBe(42);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith("Jetzt brauchen wir Claude Sonnet 5.\n");
    } finally {
      write.mockRestore();
    }
  });
});
