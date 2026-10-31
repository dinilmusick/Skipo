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
  contract: SkipoInputContract<T>,
  input: {text?: string; audio?: Uint8Array; language?: string},
): Promise<FrnlResolvedInput<T>> {
  const text = input.text ?? (input.audio ? await transcribeVoiceInput(input.audio, input.language) : "");
  return resolveFrnlInput(contract, text);
}
