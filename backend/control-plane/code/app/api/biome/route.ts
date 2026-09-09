import { NextResponse } from 'next/server';
import { BiomeType, ThemeMode } from '@/lib/types';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let currentBiome: BiomeType = 'forest';
let currentTheme: ThemeMode = 'dark';

export const GET = createSecureRoute({
  id: 'api-biome-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async () => {
    return NextResponse.json({
      success: true,
      biome: currentBiome,
      theme: currentTheme,
      timestamp: Date.now(),
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-biome-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 32 * 1024 },
  handler: async (req, { body }) => {
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const { biome, theme } = body || {};
    if (biome) currentBiome = biome;
    if (theme) currentTheme = theme;

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'POST',
      endpoint: '/api/biome',
      action: 'BIOME_CHANGED',
      details: `Theme set to "${currentTheme}", Biome set to "${currentBiome}"`,
      payload: { biome: currentBiome, theme: currentTheme },
    });

    return NextResponse.json({
      success: true,
      biome: currentBiome,
      theme: currentTheme,
      updatedAt: Date.now(),
    });
  },
});
