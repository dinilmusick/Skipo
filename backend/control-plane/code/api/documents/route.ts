import { NextRequest, NextResponse } from 'next/server';
import {
  loadDocumentsFromFS,
  saveDocumentToFS,
  loadDocumentsFromFSAsync,
  saveDocumentToFSAsync,
  deleteDocumentFromFS,
} from '@/lib/workspaceFS';
import { DocumentItem } from '@/lib/types';
import { extractTagsFromText } from '@/lib/tag-extractor';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { publishRealtimeEvent } from '@/lib/realtime-events';

export async function GET(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const docId = req.nextUrl.searchParams.get('id');
    const catId = req.nextUrl.searchParams.get('categoryId');
    const tag = req.nextUrl.searchParams.get('tag');

    const allDocs = await loadDocumentsFromFSAsync();

    if (docId) {
      const doc = allDocs.find((d) => d.id === docId);
      if (!doc) {
        return NextResponse.json({ success: false, error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        document: doc,
        storageType: 'PHYSICAL_FILE_SYSTEM_VAULT',
      });
    }

    let filtered = allDocs;
    if (catId) filtered = filtered.filter((d) => d.categoryId === catId);
    if (tag) filtered = filtered.filter((d) => d.tags.includes(tag));

    return NextResponse.json({
      success: true,
      total: filtered.length,
      documents: filtered,
      storageType: 'PHYSICAL_FILE_SYSTEM_VAULT',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'FAILED_GET_DOCS' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = await req.json();
    const docTitle = payload.title || 'UNTITLED_DOC.MD';
    const docDesc = payload.description || '';
    const docContent = payload.content || '';

    // Auto-extract tags using wink-nlp from title + content + description
    const fullText = `${docTitle} ${docDesc} ${docContent}`;
    const autoExtracted = extractTagsFromText(fullText, 5);
    const combinedTags = Array.from(new Set([...(payload.tags || []), ...autoExtracted]));

    const newDoc: DocumentItem = {
      id: payload.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      categoryId: payload.categoryId || 'cat-inbox',
      title: docTitle,
      description: docDesc || 'New document created in workspace vault',
      content: docContent || '# NEW DOCUMENT\nCreated via DocuStack workspace UI.',
      fileType: payload.fileType || 'text',
      fileSize: payload.fileSize || '1 KB',
      uploadedAt: payload.uploadedAt || new Date().toISOString().split('T')[0],
      tags: combinedTags.length > 0 ? combinedTags : ['WORKSPACE', 'REAL_FS'],
      aiSummary: payload.aiSummary,
    };

    const savedDoc = await saveDocumentToFSAsync(newDoc);

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'POST',
      endpoint: '/api/documents',
      action: 'DOCUMENT_CREATED',
      details: `Created document "${savedDoc.title}"`,
      payload: savedDoc,
    });

    return NextResponse.json(
      {
        success: true,
        document: savedDoc,
        message: 'DOCUMENT WRITTEN TO PHYSICAL FILE SYSTEM WITH AUTO TAGS',
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = await req.json();
    if (!payload.id) {
      return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });
    }

    const currentDocs = await loadDocumentsFromFSAsync();
    const existing = currentDocs.find((d) => d.id === payload.id);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
    }

    const docTitle = payload.title !== undefined ? payload.title : existing.title;
    const docContent = payload.content !== undefined ? payload.content : existing.content;
    const docDesc = payload.description !== undefined ? payload.description : existing.description;

    let finalTags: string[];
    if (payload.tags !== undefined && Array.isArray(payload.tags)) {
      finalTags = payload.tags;
    } else {
      const fullText = `${docTitle} ${docDesc || ''} ${docContent || ''}`;
      const autoExtracted = extractTagsFromText(fullText, 5);
      finalTags = Array.from(new Set([...(existing.tags || []), ...autoExtracted]));
    }

    const updatedDoc: DocumentItem = {
      ...existing,
      ...payload,
      tags: finalTags,
    };

    const savedDoc = await saveDocumentToFSAsync(updatedDoc);

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'PUT',
      endpoint: '/api/documents',
      action: 'DOCUMENT_UPDATED',
      details: `Updated document "${savedDoc.title}"`,
      payload: savedDoc,
    });

    return NextResponse.json({
      success: true,
      document: savedDoc,
      message: 'DOCUMENT UPDATED ON PHYSICAL FILE SYSTEM WITH AUTO TAGS',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    let id = req.nextUrl.searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });
    }

    deleteDocumentFromFS(id);

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'DELETE',
      endpoint: '/api/documents',
      action: 'DOCUMENT_DELETED',
      details: `Deleted document ID ${id}`,
      payload: { id },
    });

    return NextResponse.json({
      success: true,
      purgedId: id,
      message: 'DOCUMENT UNLINKED FROM PHYSICAL DISK',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'FAILED_DELETE_DOC' }, { status: 500 });
  }
}
