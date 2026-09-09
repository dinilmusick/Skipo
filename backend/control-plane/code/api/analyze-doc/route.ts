import { NextResponse } from "next/server";
import { extractTagsFromText, getNlp, calculateTagSimilarity } from "@/lib/tag-extractor";
import { createSecureRoute } from "@/lib/api-governance";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-analyze-doc',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'EXPENSIVE_OPERATION' },
  limits: {
    maxBodySize: 256 * 1024, // 256 KB max text payload
    maxExecutionMs: 10000,
    maxConcurrency: 5,
  },
  handler: async (req, { body }) => {
    const { title, content, fileType, currentCategories } = body || {};

    const textToAnalyze = `${title || ''}. ${content || ''}`.trim();
    const tags = extractTagsFromText(textToAnalyze, 5);

    let summary = `Document "${title || 'Untitled'}" (${fileType || 'file'}).`;

    const nlp = getNlp();
    if (nlp && textToAnalyze.length > 10) {
      try {
        const doc = nlp.readDoc(textToAnalyze);
        const sentences = doc.sentences().out();
        if (Array.isArray(sentences) && sentences.length > 0) {
          const topSentences = sentences.slice(0, 2).join(' ');
          summary = topSentences.length > 250 ? topSentences.slice(0, 247) + '...' : topSentences;
        } else if (content) {
          summary = content.slice(0, 200).trim() + (content.length > 200 ? '...' : '');
        }
      } catch {
        if (content) {
          summary = content.slice(0, 180).trim() + '...';
        }
      }
    } else if (content) {
      summary = content.slice(0, 180).trim() + '...';
    }

    // Wink NLP Category Matching
    let matchedCategoryId: string | null = null;
    if (currentCategories && currentCategories.length > 0) {
      let bestSim = 0;
      for (const cat of currentCategories) {
        const catTitle = cat.title || '';
        let highestTagSim = 0;
        for (const tag of tags) {
          const sim = calculateTagSimilarity(tag, catTitle);
          if (sim > highestTagSim) highestTagSim = sim;
        }
        if (highestTagSim > bestSim && highestTagSim >= 0.2) {
          bestSim = highestTagSim;
          matchedCategoryId = cat.id;
        }
      }
    }

    return NextResponse.json({
      engine: 'wink-nlp',
      summary: `[Wink NLP] ${summary}`,
      tags: tags.length > 0 ? tags : [fileType || 'DOCUMENT', 'ANALYZED'],
      categorySuggestion: matchedCategoryId ? { matchedId: matchedCategoryId } : null,
    });
  },
});
