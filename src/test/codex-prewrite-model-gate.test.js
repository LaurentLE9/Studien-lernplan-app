import { describe, expect, it } from "vitest";
import {
  directCodexSwitchMessage,
  evaluateDirectCodexPreWriteGate,
  requiredModelForDirectCodexBlock,
} from "../../scripts/codex-prewrite-model-gate.mjs";

describe("Temporary Manual Codex Pre-Write Gate", () => {
  it("allows Luna for one bounded low-risk file", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ current: "gpt-5.6-luna", files: 1, complexity: "low" }),
    ).toMatchObject({ status: "CONTINUE", requiredModel: "luna" });
  });

  it("requires Terra before multi-file implementation", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ current: "luna", files: 4, complexity: "low" }),
    ).toMatchObject({ status: "MODEL_SWITCH_REQUIRED", requiredModel: "terra" });
    expect(directCodexSwitchMessage("terra")).toBe("Jetzt brauchen wir Terra.");
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

  it("lets Terra continue for medium/multi-file work but not Sol-only work", () => {
    expect(
      evaluateDirectCodexPreWriteGate({ current: "terra", files: 3, complexity: "medium" }),
    ).toMatchObject({ status: "CONTINUE", requiredModel: "terra" });
    expect(
      evaluateDirectCodexPreWriteGate({ current: "terra", files: 1, complexity: "low", security: true }),
    ).toMatchObject({ status: "MODEL_SWITCH_REQUIRED", requiredModel: "sol" });
  });
});
