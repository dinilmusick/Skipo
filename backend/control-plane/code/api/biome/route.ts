import { NextRequest, NextResponse } from 'next/server';
import { BiomeType, ThemeMode } from '@/lib/types';
import { publishRealtimeEvent } from '@/lib/realtime-events';

let currentBiome: BiomeType = 'forest';
let currentTheme: ThemeMode = 'dark';

export async function GET() {
  return NextResponse.json({
    success: true,
    biome: currentBiome,
    theme: currentTheme,
    timestamp: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const { biome, theme } = await req.json();
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
