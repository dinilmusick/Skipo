import {describe, expect, it, vi, beforeEach} from "vitest";
import {z} from "zod";

const transcribeMock = vi.fn(async () => "thirty two");

vi.mock("@dinilmusick/gutts", () => ({
  Whistle: class {
    async transcribe(opts: {audio: Uint8Array; language?: string}) {
      return transcribeMock(opts as any);
    }
  },
}));

const resolveFrnlInputMock = vi.fn(async (contract: any, input: string, sharedContext?: any) => {
  if (!input || !input.trim()) {
    return {
      status: "invalid",
      value: undefined,
      candidates: [],
      modelOutput: undefined,
      ...(contract.preserveRawInput ? {rawInput: input} : {}),
    };
  }
  const rawValue = input === "thirty two" ? 32 : input === "invalid text" ? -50 : input;
  const parsed = contract.validator ? contract.validator.safeParse(rawValue) : {success: true, data: rawValue};
  if (!parsed.success) {
    return {
      status: "invalid",
      value: undefined,
      candidates: [],
      modelOutput: rawValue,
      ...(contract.preserveRawInput ? {rawInput: input} : {}),
    };
  }
  return {
    status: "resolved",
    value: parsed.data,
    candidates: [],
    modelOutput: rawValue,
    ...(contract.preserveRawInput ? {rawInput: input} : {}),
  };
});

vi.mock("@ultrst-armada/frnlts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ultrst-armada/frnlts")>();
  return {
    ...actual,
    resolveFrnlInput: (...args: unknown[]) => resolveFrnlInputMock(...args as [any, string, any?]),
  };
});

import {resolveSkipoInput, transcribeVoiceInput, type SkipoInputContract} from "./semantic-input.js";

describe("Skipo universal semantic input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. treats voice strictly as a transcription transport feeding the universal pipeline", async () => {
    const audioBytes = new Uint8Array([10, 20, 30]);
    const transcript = await transcribeVoiceInput(audioBytes, "en");
    expect(transcript).toBe("thirty two");

    const contract: SkipoInputContract<number> = {
      name: "age",
      label: "Age",
      schema: {type: "integer", minimum: 0},
      validator: z.number().int().min(0),
      context: {page: "Registration", field: "age"},
    };

    const result = await resolveSkipoInput(contract, {audio: audioBytes, language: "en"});
    expect(result.status).toBe("resolved");
    expect(result.value).toBe(32);
    expect(result.rawInput).toBeUndefined(); // default preserveRawInput = false
    expect(resolveFrnlInputMock).toHaveBeenCalledTimes(1);
    expect(resolveFrnlInputMock).toHaveBeenCalledWith(contract, "thirty two", {
      application: undefined,
      workspace: undefined,
    });
  });

  it("2. voice inputs cannot bypass Zod validation", async () => {
    transcribeMock.mockResolvedValueOnce("invalid text");

    const contract: SkipoInputContract<number> = {
      name: "age",
      label: "Age",
      schema: {type: "integer", minimum: 0},
      validator: z.number().int().min(0), // Fails for -50
    };

    const result = await resolveSkipoInput(contract, {audio: new Uint8Array([1, 2])});
    expect(result.status).toBe("invalid");
    expect(result.value).toBeUndefined();
  });

  it("3. threads application, workspace, and page context into the resolver", async () => {
    const contract: SkipoInputContract<number> = {
      name: "itemCount",
      label: "Count",
      schema: {type: "integer"},
      validator: z.number(),
      application: "InventoryApp",
      workspace: "ws-primary",
      context: {page: "Stock", section: "Warehouse"},
    };

    await resolveSkipoInput(contract, {text: "thirty two"});
    expect(resolveFrnlInputMock).toHaveBeenCalledWith(
      contract,
      "thirty two",
      {
        application: "InventoryApp",
        workspace: "ws-primary",
      }
    );
  });

  it("4. raw input is omitted by default and preserved only when opted in", async () => {
    const defaultContract: SkipoInputContract<number> = {
      name: "count",
      label: "Count",
      schema: {type: "integer"},
      validator: z.number().int(),
    };

    const preserveContract: SkipoInputContract<number> = {
      name: "count",
      label: "Count",
      schema: {type: "integer"},
      validator: z.number().int(),
      preserveRawInput: true,
    };

    const res1 = await resolveSkipoInput(defaultContract, {text: "thirty two"});
    expect(res1.rawInput).toBeUndefined();

    const res2 = await resolveSkipoInput(preserveContract, {text: "thirty two"});
    expect(res2.rawInput).toBe("thirty two");
  });

  it("5. empty or whitespace voice transcription returns invalid status safely", async () => {
    transcribeMock.mockResolvedValueOnce("   ");

    const contract: SkipoInputContract<number> = {
      name: "count",
      label: "Count",
      schema: {type: "integer"},
      validator: z.number(),
    };

    const result = await resolveSkipoInput(contract, {audio: new Uint8Array([])});
    expect(result.status).toBe("invalid");
  });
});
