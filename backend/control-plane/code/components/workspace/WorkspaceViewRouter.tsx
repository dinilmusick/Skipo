import React, { RefObject } from 'react';
import {
  DocumentItem,
  DocCategory,
  GraphNode,
  GraphEdge,
  GraphGroup,
  ThemeMode,
  WorkspaceTab,
} from '../../lib/types';
import SearchBar from '../SearchBar';
import KanbanBoard from '../KanbanBoard';
import ForceGraphView from '../ForceGraphView';
import WorkSpaceView from '../WorkSpaceView';
import TagForceGraphView from '../TagForceGraphView';
import SearchView from '../SearchView';

export interface WorkspaceViewRouterProps {
  viewMode: 'graph' | 'kanban' | 'work' | 'tags' | 'search';
  theme: ThemeMode;
  motionEnabled: boolean;
  onToggleMotion: () => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  categories: DocCategory[];
  documents: DocumentItem[];
  workspaces: WorkspaceTab[];
  activeWorkspaceId: string;
  focusTarget: { type: 'node' | 'group'; id: string; timestamp: number } | null;
  appWallpaper: string | null;
  canvasWallpaperInputRef: RefObject<HTMLInputElement | null>;
  handleRemoveCanvasWallpaper: () => void;
  handleUploadCanvasWallpaperFile: (file: File) => void;
  
  // Navigation / Mode switches
  setActiveCollectionId: (id: string) => void;
  setActiveCollectionTitle: (title: string) => void;
  transitionToViewMode: (mode: 'graph' | 'kanban' | 'work' | 'tags' | 'search') => void;
  
  // Graph actions
  handleAddGraphNode: (node: GraphNode, edge?: GraphEdge) => void;
  handleUpdateGraphNode: (node: GraphNode) => void;
  requestDeleteGraphNode: (nodeId: string) => void;
  executeDeleteMultipleGraphNodes: (nodeIds: string[]) => void;
  setEditingNode: (node: GraphNode | null) => void;
  handleSaveGroups: (groups: GraphGroup[]) => void;
  handleOpenWorkspaceFolder: () => void;
  
  // Kanban actions
  activeCollectionId: string;
  activeBoardCategories: DocCategory[];
  filteredDocs: DocumentItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  allTags: string[];
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  dragOverCategoryId: string | null;
  setDragOverCategoryId: (id: string | null) => void;
  setEditingCategory: (cat: DocCategory | 'NEW' | null) => void;
  handleDeleteDoc: (id: string) => void;
  handleQuickNlpAnalyze: (doc: DocumentItem, options?: any) => void;
  setContextMenuState: (state: { doc: DocumentItem; x: number; y: number } | null) => void;
  setDraggedCardId: (id: string | null) => void;
  handleFileUpload: (files: FileList | null, catId?: string) => void;
  requestDeleteCategory: (catId: string) => void;
  handleAddStackToWorkspace: (cat: DocCategory) => void;
  handleSetCategoryWallpaperFile: (category: DocCategory, file: File) => void;
  triggerWorkspaceMutationSave: () => void;
  setDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  
  // Document selection
  setActiveDoc: (doc: DocumentItem | null) => void;
  setActiveDocSearchQuery: (q: string) => void;
  handleUpdateDoc: (id: string, updates: Partial<DocumentItem>) => void;
  
  // Work view actions
  handleUpdateWorkspaces: (workspaces: WorkspaceTab[]) => void;
  handleSelectWorkspaceId: (id: string) => void;
  handleAddDocFromWeb: (doc: DocumentItem) => void;
  
  // Tag cloud actions
  handleCollapseTags: (oldTags: string[], replacement: string) => void;
  
  // Search actions
  setFocusTarget: (target: { type: 'node' | 'group'; id: string; timestamp: number } | null) => void;
}

export default function WorkspaceViewRouter({
  viewMode,
  theme,
  motionEnabled,
  onToggleMotion,
  nodes,
  edges,
  groups,
  categories,
  documents,
  workspaces,
  activeWorkspaceId,
  focusTarget,
  appWallpaper,
  canvasWallpaperInputRef,
  handleRemoveCanvasWallpaper,
  handleUploadCanvasWallpaperFile,
  setActiveCollectionId,
  setActiveCollectionTitle,
  transitionToViewMode,
  handleAddGraphNode,
  handleUpdateGraphNode,
  requestDeleteGraphNode,
  executeDeleteMultipleGraphNodes,
  setEditingNode,
  handleSaveGroups,
  handleOpenWorkspaceFolder,
  activeCollectionId,
  activeBoardCategories,
  filteredDocs,
  searchQuery,
  setSearchQuery,
  allTags,
  selectedTag,
  setSelectedTag,
  dragOverCategoryId,
  setDragOverCategoryId,
  setEditingCategory,
  handleDeleteDoc,
  handleQuickNlpAnalyze,
  setContextMenuState,
  setDraggedCardId,
  handleFileUpload,
  requestDeleteCategory,
  handleAddStackToWorkspace,
  handleSetCategoryWallpaperFile,
  triggerWorkspaceMutationSave,
  setDocuments,
  setActiveDoc,
  setActiveDocSearchQuery,
  handleUpdateDoc,
  handleUpdateWorkspaces,
  handleSelectWorkspaceId,
  handleAddDocFromWeb,
  handleCollapseTags,
  setFocusTarget,
}: WorkspaceViewRouterProps) {
  return (
    <>
      {viewMode === 'graph' && (
        <ForceGraphView
          nodes={nodes}
          edges={edges}
          groups={groups}
          theme={theme}
          motionEnabled={motionEnabled}
          onToggleMotion={onToggleMotion}
          onOpenCollection={(colId, title) => {
            setActiveCollectionId(colId);
            setActiveCollectionTitle(title);
            transitionToViewMode('kanban');
          }}
          onAddNode={handleAddGraphNode}
          onUpdateNode={handleUpdateGraphNode}
          onDeleteNode={requestDeleteGraphNode}
          onDeleteMultipleNodes={executeDeleteMultipleGraphNodes}
          onEditNode={(node) => setEditingNode(node)}
          onSaveGroups={handleSaveGroups}
          onOpenWorkspaceFolder={handleOpenWorkspaceFolder}
          focusTarget={focusTarget}
          hasAppWallpaper={Boolean(appWallpaper)}
          onSetCanvasWallpaper={() => canvasWallpaperInputRef.current?.click()}
          onRemoveCanvasWallpaper={handleRemoveCanvasWallpaper}
        />
      )}

      <input
        ref={canvasWallpaperInputRef}
        type="file"
        accept="image/*,video/*,.mp4,.webm,.gif,.png,.jpg,.jpeg,.webp,.svg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleUploadCanvasWallpaperFile(e.target.files[0]);
          }
          if (e.target) e.target.value = '';
        }}
      />

      {viewMode === 'kanban' && (
        <>
          <SearchBar
            theme={theme}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            tags={allTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
          />

          <KanbanBoard
            categories={activeBoardCategories}
            documents={filteredDocs}
            theme={theme}
            activeCollectionId={activeCollectionId}
            onSelectCollection={(colId, title) => {
              setActiveCollectionId(colId);
              if (title) setActiveCollectionTitle(title);
            }}
            onOpenCreateCategory={() => setEditingCategory('NEW')}
            onEditBoard={() => {
              const target = nodes.find(
                (n) => n.collectionId === activeCollectionId || n.id === activeCollectionId
              );
              if (target) {
                setEditingNode(target);
              }
            }}
            dragOverCategoryId={dragOverCategoryId}
            onStackDragOver={(e, catId) => {
              e.preventDefault();
              if (dragOverCategoryId !== catId) setDragOverCategoryId(catId);
            }}
            onStackDragLeave={() => setDragOverCategoryId(null)}
            onStackDrop={(e, catId) => {
              e.preventDefault();
              setDragOverCategoryId(null);
              const docId = e.dataTransfer.getData('text/plain');
              if (docId) {
                setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, categoryId: catId } : d)));
                fetch('/api/documents', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: docId, categoryId: catId }),
                }).catch(() => {});
                triggerWorkspaceMutationSave();
              }
              if (e.dataTransfer.files?.length) {
                handleFileUpload(e.dataTransfer.files, catId);
              }
            }}
            onSelectDoc={(doc) => {
              setActiveDocSearchQuery('');
              setActiveDoc(doc);
              setDraggedCardId(null);
            }}
            onDeleteDoc={handleDeleteDoc}
            onQuickAnalyzeDoc={handleQuickNlpAnalyze}
            onContextMenuDoc={(doc, e) => {
              setContextMenuState({ doc, x: e.clientX, y: e.clientY });
            }}
            onCardDragStart={(e, id) => {
              e.dataTransfer.setData('text/plain', id);
              setDraggedCardId(id);
            }}
            onCardDragEnd={() => setDraggedCardId(null)}
            onEditCategory={(cat) => setEditingCategory(cat)}
            onUploadToStack={(catId) => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.onchange = (e: any) => handleFileUpload(e.target.files, catId);
              input.click();
            }}
            onDeleteCategory={requestDeleteCategory}
            onAddStackToWorkspace={handleAddStackToWorkspace}
            onSetCategoryWallpaperFile={handleSetCategoryWallpaperFile}
          />
        </>
      )}

      {viewMode === 'work' && (
        <WorkSpaceView
          documents={documents}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          theme={theme}
          onUpdateWorkspaces={handleUpdateWorkspaces}
          onSelectWorkspaceId={handleSelectWorkspaceId}
          onUpdateDoc={(updatedDoc) => handleUpdateDoc(updatedDoc.id, updatedDoc)}
          onAddDocFromWeb={handleAddDocFromWeb}
          onOpenDocument={(doc, query) => {
            setActiveDocSearchQuery(query || '');
            setActiveDoc(doc);
          }}
        />
      )}

      {viewMode === 'tags' && (
        <TagForceGraphView
          documents={documents}
          nodes={nodes}
          categories={categories}
          theme={theme}
          onSelectDoc={(doc) => setActiveDoc(doc)}
          onSelectNode={(nodeId) => {
            const targetNode = nodes.find((n) => n.id === nodeId);
            if (targetNode) {
              if (targetNode.type === 'collection') {
                setActiveCollectionId(targetNode.collectionId || targetNode.id);
                setActiveCollectionTitle(targetNode.title);
                transitionToViewMode('kanban');
              } else {
                setEditingNode(targetNode);
              }
            }
          }}
          onCollapseTags={handleCollapseTags}
        />
      )}

      {viewMode === 'search' && (
        <SearchView
          documents={documents}
          categories={categories}
          nodes={nodes}
          groups={groups}
          theme={theme}
          onOpenDocument={(doc, query) => {
            setActiveDocSearchQuery(query || '');
            setActiveDoc(doc);
          }}
          onOpenKanban={(cat) => {
            setActiveCollectionId(cat.boardId || cat.id);
            setActiveCollectionTitle(cat.title);
            transitionToViewMode('kanban');
          }}
          onFocusGroup={(group) => {
            setFocusTarget({ type: 'group', id: group.id, timestamp: Date.now() });
            transitionToViewMode('graph');
          }}
          onFocusNode={(node) => {
            setFocusTarget({ type: 'node', id: node.id, timestamp: Date.now() });
            transitionToViewMode('graph');
          }}
        />
      )}
    </>
  );
}
