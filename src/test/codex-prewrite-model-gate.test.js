import { describe, expect, it, vi } from "vitest";
import {
  directCodexSwitchMessage,
  evaluateDirectCodexPreWriteGate,
  requiredModelForDirectCodexBlock,
  runCli,
} from "../../scripts/codex-prewrite-model-gate.mjs";

describe("Temporary Manual Codex Compatibility Gate", () => {
  it("allows Luna for one bounded low-risk file", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ active: "gpt-5.6-luna", files: 1, complexity: "low" }),
    ).toMatchObject({ status: "CONTINUE", requiredModel: "luna", activeCapability: "low" });
  });

  it("does not require active-model metadata to calculate a low-risk Luna block", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ files: 1, complexity: "low" }),
    ).toMatchObject({ status: "CONTINUE", requiredModel: "luna", activeCapability: "unknown" });
  });

  it("requires explicit scope inputs before the CLI can return CONTINUE", () => {
    expect(() => runCli([])).toThrow("--files is required");
    expect(() => runCli(["--files", "1"])).toThrow("--complexity is required");
  });

  it("requires Terra before multi-file implementation when Luna is known active", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ active: "luna", files: 4, complexity: "low" }),
    ).toMatchObject({ status: "MODEL_SWITCH_REQUIRED", requiredModel: "terra" });
    expect(directCodexSwitchMessage("terra")).toBe("Jetzt brauchen wir Terra.");
  });

  it("returns ACTIVE_CAPABILITY_UNKNOWN when a stronger model is required but runtime metadata is unavailable", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ files: 4, complexity: "low" }),
    ).toMatchObject({
      status: "ACTIVE_CAPABILITY_UNKNOWN",
      requiredModel: "terra",
      activeCapability: "unknown",
    });
  });

  it("requires Terra before integration logic even in one file", () => {
    expect(requiredModelForDirectCodexBlock({ files: 1, complexity: "low", integration: true })).toBe("terra");
  });

  it("requires Sol before security, auth, RLS, migration or data-loss work", () => {
    for (const signal of ["security", "auth", "rls", "secrets", "migration", "dataLoss", "architecture"]) {
      expect(requiredModelForDirectCodexBlock({ files: 1, complexity: "low", [signal]: true })).toBe("sol");
    }
    expect(directCodexSwitchMessage("sol")).toBe("Jetzt brauchen wir Sol.");
  });

  it("routes large/high refactors, strong coupling and repeated failures to Sol", () => {
    expect(
      requiredModelForDirectCodexBlock({ files: 100, complexity: "high", refactor: true }),
    ).toBe("sol");
    expect(
      requiredModelForDirectCodexBlock({ files: 3, complexity: "medium", strongCoupling: true }),
    ).toBe("sol");
    expect(
      requiredModelForDirectCodexBlock({ files: 2, complexity: "medium", failedAttempts: 2 }),
    ).toBe("sol");
    expect(
      requiredModelForDirectCodexBlock({ files: 2, complexity: "medium", terraInsufficient: true }),
    ).toBe("sol");
  });

  it("lets Terra continue for medium/multi-file work but not Sol-only work", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ active: "terra", files: 3, complexity: "medium" }),
    ).toMatchObject({ status: "CONTINUE", requiredModel: "terra" });
    expect(
      evaluateDirectCodexPreWriteGate({ active: "terra", files: 1, complexity: "low", security: true }),
    ).toMatchObject({ status: "MODEL_SWITCH_REQUIRED", requiredModel: "sol" });
  });

  it("keeps --current as a compatibility alias for --active", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ current: "terra", files: 3, complexity: "medium" }),
    ).toMatchObject({ status: "CONTINUE", requiredModel: "terra", activeCapability: "medium" });
  });

  it("prints only the exact switch line for a blocked known-active CLI decision", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(
        runCli(["--provider", "openai", "--active", "luna", "--files", "4", "--complexity", "medium"]),
      ).toBe(42);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith("Jetzt brauchen wir Terra.\n");
    } finally {
      write.mockRestore();
    }
  });

  it("infers OpenAI for legacy prefixed model names", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(
        runCli(["--active", "gpt-5.6-luna", "--files", "2", "--complexity", "medium"]),
      ).toBe(42);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith("Jetzt brauchen wir Terra.\n");
    } finally {
      write.mockRestore();
    }
  });

  it("prints the required target model even when active capability is unknown", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(runCli(["--provider", "openai", "--files", "1", "--complexity", "low", "--security"])).toBe(42);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith("Jetzt brauchen wir Sol.\n");
    } finally {
      write.mockRestore();
    }
  });
});
