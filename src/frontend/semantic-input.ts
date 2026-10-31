import {Whistle} from "@dinilmusick/gutts";
import {
  resolveFrnlInput,
  type FrnlInputContract,
  type FrnlResolvedInput,
} from "@ultrst-armada/frnlts";

export type SkipoInputContract<T> = FrnlInputContract<T> & {
  application?: string;
  workspace?: string;
};

export async function transcribeVoiceInput(
  audio: Uint8Array,
  language?: string,
): Promise<string> {
  return new Whistle().transcribe({audio, language});
}

export async function resolveSkipoInput<T>(
  contract: SkipoInputContract<T> | null,
  input: {text?: string; audio?: Uint8Array; language?: string},
): Promise<FrnlResolvedInput<T>> {
  if (!contract) {
    return {
      status: "invalid",
      value: undefined,
      candidates: [],
      modelOutput: undefined,
    };
  }

  let text = input.text;
  if (text === undefined && input.audio) {
    try {
      text = await transcribeVoiceInput(input.audio, input.language);
    } catch {
      return {
        status: "invalid",
        value: undefined,
        candidates: [],
        modelOutput: undefined,
        ...(contract.preserveRawInput ? {rawInput: "[audio]"} : {}),
      };
    }
  }

  if (!text || !text.trim()) {
    return {
      status: "invalid",
      value: undefined,
      candidates: [],
      modelOutput: undefined,
      ...(contract.preserveRawInput ? {rawInput: text ?? ""} : {}),
    };
  }

  return resolveFrnlInput(contract, text, {
    application: contract.application,
    workspace: contract.workspace,
  });
}
