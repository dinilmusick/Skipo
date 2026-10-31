import {
  Whistle,
  resolveSemanticInput,
  type SemanticInputContext,
  type SemanticInputSchema,
  type SemanticInputResolution,
} from "@dinilmusick/gutts";

export type SkipoInputContext = SemanticInputContext & {
  application?: string;
  workspace?: string;
};

export async function transcribeVoiceInput(
  audio: Uint8Array,
  language?: string,
): Promise<string> {
  const whistle = new Whistle();
  return whistle.transcribe({audio, language});
}

export async function resolveSkipoInput<T = unknown>(input: {
  text?: string;
  audio?: Uint8Array;
  language?: string;
  schema: SemanticInputSchema;
  context: SkipoInputContext;
  candidates?: readonly string[];
  preserveRawInput?: boolean;
}): Promise<SemanticInputResolution<T>> {
  const text = input.text ?? (input.audio ? await transcribeVoiceInput(input.audio, input.language) : "");
  if (!text.trim()) {
    return {
      status: "invalid",
      candidates: [],
      modelOutput: null,
      ...(input.preserveRawInput ? {rawInput: text} : {}),
    };
  }

  return resolveSemanticInput<T>({
    input: text,
    schema: input.schema,
    context: input.context,
    candidates: input.candidates,
    preserveRawInput: input.preserveRawInput ?? false,
  });
}
