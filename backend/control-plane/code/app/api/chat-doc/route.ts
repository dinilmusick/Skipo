import { NextResponse } from "next/server";
import { getNlp, extractTagsFromText } from "@/lib/tag-extractor";
import { createSecureRoute } from "@/lib/api-governance";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-chat-doc',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'EXPENSIVE_OPERATION' },
  limits: {
    maxBodySize: 256 * 1024,
    maxExecutionMs: 10000,
    maxConcurrency: 5,
  },
  handler: async (req, { body }) => {
    const { documentTitle, documentContent, messages } = body || {};

    const userMessage = messages && messages.length > 0 ? messages[messages.length - 1]?.text || "" : "";
    if (!userMessage.trim()) {
      return NextResponse.json({
        text: `[Wink NLP Engine] Please enter a keyword or query about "${documentTitle || 'document'}".`,
      });
    }

    const docText = documentContent || "";
    const nlp = getNlp();

    // Extract query keywords using Wink NLP
    const queryTags = extractTagsFromText(userMessage, 10).map((t) => t.toLowerCase());

    if (!docText || docText.trim().length === 0) {
      return NextResponse.json({
        text: `[Wink NLP Engine] Document "${documentTitle || 'Untitled'}" has no extractable text content to query.`,
      });
    }

    let matchingExcerpts: string[] = [];

    if (nlp) {
      try {
        const doc = nlp.readDoc(docText);
        const sentences = doc.sentences().out();

        if (Array.isArray(sentences) && sentences.length > 0) {
          const scored = sentences.map((sentence: string) => {
            const lowerSent = sentence.toLowerCase();
            let score = 0;
            for (const qTag of queryTags) {
              if (lowerSent.includes(qTag)) score += 3;
            }
            // Also bonus for exact words from user query
            const rawWords = userMessage.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
            for (const w of rawWords) {
              if (lowerSent.includes(w)) score += 1;
            }
            return { sentence, score };
          });

          scored.sort((a, b) => b.score - a.score);
          const topHits = scored.filter((s) => s.score > 0).slice(0, 3);

          if (topHits.length > 0) {
            matchingExcerpts = topHits.map((h) => h.sentence.trim());
          } else {
            matchingExcerpts = sentences.slice(0, 2);
          }
        }
      } catch (e) {
        console.warn("Wink NLP sentence scoring fallback:", e);
      }
    }

    // Fallback sentence extraction if Wink NLP score didn't find specific matches
    if (matchingExcerpts.length === 0) {
      const paragraphs = docText.split(/\n+/).filter((p: string) => p.trim().length > 0);
      matchingExcerpts = paragraphs.slice(0, 2);
    }

    const extractedEntities = extractTagsFromText(docText, 6).join(', ');

    const resultText = `[Wink NLP Query Result]
Document: "${documentTitle || 'Document'}"
Extracted NLP Keywords/Entities: [${extractedEntities || 'None'}]

Relevant Excerpts:
${matchingExcerpts.map((m, idx) => `${idx + 1}. "${m}"`).join('\n')}`;

    return NextResponse.json({
      text: resultText,
      engine: 'wink-nlp',
    });
  },
});
