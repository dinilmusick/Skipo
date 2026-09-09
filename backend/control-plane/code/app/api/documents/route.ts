import { NextResponse } from 'next/server';
import {
  loadDocumentsFromFSAsync,
  saveDocumentToFSAsync,
  deleteDocumentFromFSAsync,
} from '@/lib/workspaceFS';
import { DocumentItem } from '@/lib/types';
import { extractTagsFromText } from '@/lib/tag-extractor';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { createSecureRoute, clampPaginationLimit } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-documents-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { query }) => {
    await resolveRequestContextVault(req);
    const docId = query.get('id');
    const catId = query.get('categoryId');
    const tag = query.get('tag');
    const includeContent = query.get('includeContent') === 'true';
    const limit = clampPaginationLimit(query.get('limit'), 100);

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

    // Clamp pagination limit
    if (filtered.length > limit) {
      filtered = filtered.slice(0, limit);
    }

    // Lazy load optimization: strip large markdown bodies from metadata listing
    const sanitizedDocs = includeContent
      ? filtered
      : filtered.map(({ content, ...meta }) => ({
          ...meta,
          hasContent: Boolean(content && content.length > 0),
          contentLength: content ? content.length : 0,
        }));

    return NextResponse.json({
      success: true,
      total: sanitizedDocs.length,
      documents: sanitizedDocs,
      storageType: 'PHYSICAL_FILE_SYSTEM_VAULT',
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-documents-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: {
    maxBodySize: 2 * 1024 * 1024, // 2MB max doc payload
    maxExecutionMs: 15000,
  },
  handler: async (req, { body }) => {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = body || {};
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
  },
});

export const PUT = createSecureRoute({
  id: 'api-documents-put',
  method: 'PUT',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: {
    maxBodySize: 2 * 1024 * 1024,
    maxExecutionMs: 15000,
  },
  handler: async (req, { body }) => {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = body || {};
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
  },
});

export const DELETE = createSecureRoute({
  id: 'api-documents-delete',
  method: 'DELETE',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { body, query }) => {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const id = query.get('id') || body?.id;

    if (!id) {
      return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });
    }

    await deleteDocumentFromFSAsync(id);

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
  },
});
