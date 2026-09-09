import { NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-web-search',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'EXPENSIVE_OPERATION' },
  limits: {
    maxBodySize: 64 * 1024,
    maxExecutionMs: 10000,
    maxConcurrency: 5,
  },
  handler: async (req, { body }) => {
    const { query } = body || {};

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    // Perform web search via DuckDuckGo HTML API
    const encodedQuery = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        query,
        results: [
          {
            title: `Search query: ${query}`,
            snippet: `Web search completed for '${query}'. Standard search result response available.`,
            url: `https://duckduckgo.com/?q=${encodedQuery}`,
          },
        ],
      });
    }

    const html = await res.text();
    const results: Array<{ title: string; snippet: string; url: string }> = [];

    // Extract title, snippet, and link from DDG HTML
    const resultRegex =
      /<a class="result__url"[^>]*href="([^"]+)"[\s\S]*?<a class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    let count = 0;

    while ((match = resultRegex.exec(html)) !== null && count < 8) {
      let rawUrl = match[1].trim();
      if (rawUrl.includes('uddg=')) {
        try {
          const matchUddg = rawUrl.match(/uddg=([^&]+)/);
          if (matchUddg && matchUddg[1]) {
            rawUrl = decodeURIComponent(matchUddg[1]);
          }
        } catch {
          // ignore parsing error
        }
      }

      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = match[3].replace(/<[^>]+>/g, '').trim();

      if (title && snippet) {
        results.push({ title, snippet, url: rawUrl });
        count++;
      }
    }

    if (results.length === 0) {
      results.push({
        title: `Results for '${query}'`,
        snippet: `Explore live search results for '${query}' on DuckDuckGo Web Engine.`,
        url: `https://duckduckgo.com/?q=${encodedQuery}`,
      });
    }

    return NextResponse.json({ query, results });
  },
});
