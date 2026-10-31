import {describe, expect, it, vi} from "vitest";

vi.mock("@dinilmusick/gutts", () => ({
  Whistle: class { async transcribe() { return "thirty two"; } },
  resolveSemanticInput: vi.fn(async ({input}: {input: string}) => ({
    status: "resolved",
    value: input === "thirty two" ? 32 : input,
    candidates: [],
    modelOutput: 32,
  })),
}));

import {resolveSkipoInput, transcribeVoiceInput} from "./semantic-input.js";

describe("Skipo universal semantic input", () => {
  it("treats voice as a transcription transport", async () => {
    expect(await transcribeVoiceInput(new Uint8Array([1, 2]))).toBe("thirty two");
  });

  it("passes page context and schema into the universal resolver", async () => {
    const result = await resolveSkipoInput({
      text: "thirty two",
      schema: {type: "integer"},
      context: {page: "Registration", field: "Age"},
    });
    expect(result.value).toBe(32);
  });
});
