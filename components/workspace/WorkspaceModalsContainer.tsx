import React, { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  DocumentItem,
  DocCategory,
  GraphNode,
  ThemeMode,
  CustomThemeConfig,
  WorkspaceTab,
  UserAccount,
} from '../../lib/types';
import DocumentDetailModal from '../DocumentDetailModal';
import AiChatPanel from '../AiChatPanel';
import CategoryModal from '../CategoryModal';
import NodeEditModal from '../NodeEditModal';
import SettingsModal from '../SettingsModal';
import WorkspaceExplorerModal from '../WorkspaceExplorerModal';
import DeleteDropZone from '../DeleteDropZone';
import ActivityMonitor from '../ActivityMonitor';
import DocumentContextMenu from '../DocumentContextMenu';
import ConfirmationModal from '../ConfirmationModal';
import WindTransition from '../WindTransition';
import LoginModal from '../auth/LoginModal';
import MediaVaultModal from '../media/MediaVaultModal';
import WorkspaceFolderSelectorModal from './WorkspaceFolderSelectorModal';
import WorkspaceTilesMenu from './WorkspaceTilesMenu';
import AdminPanelModal from '../admin/AdminPanelModal';

export interface WorkspaceModalsContainerProps {
  theme: ThemeMode;
  themeConfig: CustomThemeConfig;
  savedThemes: CustomThemeConfig[];
  motionEnabled: boolean;
  appWallpaper: string | null;
  onToggleTheme: () => void;
  onChangeThemeConfig: (config: CustomThemeConfig) => void;
  onSaveCustomTheme: (config: CustomThemeConfig) => void;
  onDeleteCustomTheme: (id: string) => void;
  onToggleMotion: () => void;
  onChangeWallpaper: (wp: string | null) => void;
  
  // Auth & Admin
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
  userToken: string | null;
  isLoginOpen: boolean;
  setIsLoginOpen: (open: boolean) => void;
  isAdminPanelOpen: boolean;
  setIsAdminPanelOpen: (open: boolean) => void;
  isMediaVaultOpen: boolean;
  setIsMediaVaultOpen: (open: boolean) => void;
  isWorkspaceFolderSelectorOpen: boolean;
  setIsWorkspaceFolderSelectorOpen: (open: boolean) => void;
  isWorkspacesMenuOpen: boolean;
  setIsWorkspacesMenuOpen: (open: boolean) => void;
  handleLoginSuccess: (user: Omit<UserAccount, 'passwordHash'>, token: string) => void;
  handleLogout: () => void;
  handleEnterWorkspace: (ws: any) => void;
  loadUserWorkspaceData: () => void;
  setCurrentUser: React.Dispatch<React.SetStateAction<Omit<UserAccount, 'passwordHash'> | null>>;
  
  // Document context & detail
  contextMenuState: { doc: DocumentItem; x: number; y: number } | null;
  setContextMenuState: (state: { doc: DocumentItem; x: number; y: number } | null) => void;
  activeDoc: DocumentItem | null;
  setActiveDoc: (doc: DocumentItem | null) => void;
  activeDocSearchQuery: string;
  setActiveDocSearchQuery: (q: string) => void;
  chatDoc: DocumentItem | null;
  setChatDoc: (doc: DocumentItem | null) => void;
  handleAddToWorkSpace: (doc: DocumentItem) => void;
  handleQuickNlpAnalyze: (doc: DocumentItem, options?: any) => void;
  handleDeleteDoc: (id: string) => void;
  handleUpdateDoc: (id: string, updates: Partial<DocumentItem>) => void;
  handleChatSend: (msg: string) => Promise<string>;
  isAnalyzing: boolean;
  categories: DocCategory[];
  nodes: GraphNode[];
  
  // Category & Node editing
  editingCategory: DocCategory | 'NEW' | null;
  setEditingCategory: (cat: DocCategory | 'NEW' | null) => void;
  handleSaveCategory: (cat: Partial<DocCategory>) => void;
  requestDeleteCategory: (catId: string) => void;
  editingNode: GraphNode | null;
  setEditingNode: (node: GraphNode | null) => void;
  handleUpdateGraphNode: (node: GraphNode) => void;
  handleOpenWorkspaceFolder: () => void;
  
  // Settings & Explorer
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isVaultExplorerOpen: boolean;
  setIsVaultExplorerOpen: (open: boolean) => void;
  refreshDocuments: () => void;
  handleAssetPurged: (res: any) => void;
  
  // Delete drop zone & monitor
  draggedCardId: string | null;
  setDraggedCardId: (id: string | null) => void;
  viewMode: string;
  isMonitorOpen: boolean;
  setIsMonitorOpen: (open: boolean) => void;
  
  // Confirmation Modal
  confirmModalState: {
    isOpen: boolean;
    title?: string;
    itemName: string;
    itemType: 'stack' | 'folder' | 'node' | 'document';
    documentCount?: number;
    warningText?: string;
    onConfirm: () => void;
  } | null;
  setConfirmModalState: (state: any) => void;
  
  // Target workspace selection dialog
  docToAddToWorkspace: DocumentItem | null;
  setDocToAddToWorkspace: (doc: DocumentItem | null) => void;
  workspaces: WorkspaceTab[];
  handleConfirmAddToWorkspace: (wsId: string) => void;
  
  // File inputs
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileUpload: (files: FileList | null, catId?: string) => void;
  
  // Transition
  transitionKey: string | null;
  setTransitionKey: (key: string | null) => void;
  transitionTargetMode: any;
  setTransitionTargetMode: (mode: any) => void;
  setViewMode: (mode: any) => void;
}

export default function WorkspaceModalsContainer({
  theme,
  themeConfig,
  savedThemes,
  motionEnabled,
  appWallpaper,
  onToggleTheme,
  onChangeThemeConfig,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  onToggleMotion,
  onChangeWallpaper,
  currentUser,
  userToken,
  isLoginOpen,
  setIsLoginOpen,
  isAdminPanelOpen,
  setIsAdminPanelOpen,
  isMediaVaultOpen,
  setIsMediaVaultOpen,
  isWorkspaceFolderSelectorOpen,
  setIsWorkspaceFolderSelectorOpen,
  isWorkspacesMenuOpen,
  setIsWorkspacesMenuOpen,
  handleLoginSuccess,
  handleLogout,
  handleEnterWorkspace,
  loadUserWorkspaceData,
  setCurrentUser,
  contextMenuState,
  setContextMenuState,
  activeDoc,
  setActiveDoc,
  activeDocSearchQuery,
  setActiveDocSearchQuery,
  chatDoc,
  setChatDoc,
  handleAddToWorkSpace,
  handleQuickNlpAnalyze,
  handleDeleteDoc,
  handleUpdateDoc,
  handleChatSend,
  isAnalyzing,
  categories,
  nodes,
  editingCategory,
  setEditingCategory,
  handleSaveCategory,
  requestDeleteCategory,
  editingNode,
  setEditingNode,
  handleUpdateGraphNode,
  handleOpenWorkspaceFolder,
  isSettingsOpen,
  setIsSettingsOpen,
  isVaultExplorerOpen,
  setIsVaultExplorerOpen,
  refreshDocuments,
  handleAssetPurged,
  draggedCardId,
  setDraggedCardId,
  viewMode,
  isMonitorOpen,
  setIsMonitorOpen,
  confirmModalState,
  setConfirmModalState,
  docToAddToWorkspace,
  setDocToAddToWorkspace,
  workspaces,
  handleConfirmAddToWorkspace,
  fileInputRef,
  handleFileUpload,
  transitionKey,
  setTransitionKey,
  transitionTargetMode,
  setTransitionTargetMode,
  setViewMode,
}: WorkspaceModalsContainerProps) {
  const router = useRouter();

  return (
    <>
      {contextMenuState && (
        <DocumentContextMenu
          doc={contextMenuState.doc}
          x={contextMenuState.x}
          y={contextMenuState.y}
          theme={theme}
          onClose={() => setContextMenuState(null)}
          onAddToWorkSpace={(doc) => handleAddToWorkSpace(doc)}
          onSelectDoc={(doc) => setActiveDoc(doc)}
          onQuickAnalyzeDoc={(doc) => handleQuickNlpAnalyze(doc, {} as any)}
          onDeleteDoc={(id) => handleDeleteDoc(id)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {activeDoc && (
        <DocumentDetailModal
          doc={activeDoc}
          categories={categories}
          theme={theme}
          initialSearchQuery={activeDocSearchQuery}
          onClose={() => {
            setActiveDoc(null);
            setActiveDocSearchQuery('');
          }}
          onDelete={(id) => handleDeleteDoc(id)}
          onUpdate={handleUpdateDoc}
          onOpenChat={(d) => {
            setActiveDoc(null);
            setActiveDocSearchQuery('');
            setChatDoc(d);
          }}
          onRunAiAnalyze={(d) => handleQuickNlpAnalyze(d)}
          isAnalyzing={isAnalyzing}
        />
      )}

      {chatDoc && (
        <AiChatPanel
          doc={chatDoc}
          theme={theme}
          onClose={() => setChatDoc(null)}
          onSendMessage={handleChatSend}
        />
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory === 'NEW' ? null : editingCategory}
          theme={theme}
          onClose={() => setEditingCategory(null)}
          onSave={handleSaveCategory}
          onDelete={requestDeleteCategory}
        />
      )}

      {editingNode && (
        <NodeEditModal
          node={editingNode}
          theme={theme}
          onClose={() => setEditingNode(null)}
          onSave={(updated) => {
            handleUpdateGraphNode({ ...editingNode, ...updated });
            setEditingNode(null);
          }}
          onOpenWorkspaceFolder={handleOpenWorkspaceFolder}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeThemeConfig={themeConfig}
          onChangeThemeConfig={onChangeThemeConfig}
          savedThemes={savedThemes}
          onSaveCustomTheme={onSaveCustomTheme}
          onDeleteCustomTheme={onDeleteCustomTheme}
          motionEnabled={motionEnabled}
          onToggleMotion={onToggleMotion}
          workspaceName={currentUser?.workspaceName || nodes.find((n) => n.isWorkspaceRoot)?.title}
          workspacePath={currentUser?.workspacePath || nodes.find((n) => n.isWorkspaceRoot)?.workspacePath}
          currentUser={currentUser}
          userToken={userToken}
          onOpenWorkspaceFolder={handleOpenWorkspaceFolder}
          onOpenWorkspacesTilesMenu={() => {
            setIsSettingsOpen(false);
            setIsWorkspacesMenuOpen(true);
          }}
          onClose={() => setIsSettingsOpen(false)}
          appWallpaper={appWallpaper}
          onChangeWallpaper={onChangeWallpaper}
        />
      )}

      {isVaultExplorerOpen && (
        <WorkspaceExplorerModal
          theme={theme}
          onClose={() => setIsVaultExplorerOpen(false)}
          onRefreshAppDocs={refreshDocuments}
          onAssetPurged={handleAssetPurged}
        />
      )}

      <DeleteDropZone
        isVisible={Boolean(draggedCardId) && viewMode === 'kanban' && !activeDoc}
        onDropDelete={(id) => {
          handleDeleteDoc(id);
          setDraggedCardId(null);
        }}
      />

      <ActivityMonitor
        isOpen={isMonitorOpen}
        onClose={() => setIsMonitorOpen(false)}
        theme={theme}
      />

      {confirmModalState?.isOpen && (
        <ConfirmationModal
          isOpen={confirmModalState.isOpen}
          title={confirmModalState.title}
          itemName={confirmModalState.itemName}
          itemType={confirmModalState.itemType}
          documentCount={confirmModalState.documentCount}
          warningText={confirmModalState.warningText}
          theme={theme}
          onConfirm={confirmModalState.onConfirm}
          onCancel={() => setConfirmModalState(null)}
        />
      )}

      {/* Target Workspace Selection Modal Dialog */}
      {docToAddToWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className={`relative w-full max-w-md border-3 p-5 font-mono ${
            theme === 'dark'
              ? 'bg-[#1E1E24] text-[#F3EDE0] border-black shadow-[8px_8px_0px_#000000]'
              : 'bg-[#FAF6F0] text-[#21140E] border-[#2C1810] shadow-[8px_8px_0px_#2C1810]'
          }`}>
            <h3 className="text-sm font-black uppercase text-[#D4AF37] border-b-2 border-black pb-2 mb-4">
              [TARGET WORKSPACE SELECTION]
            </h3>
            <p className="text-xs font-semibold mb-4 leading-relaxed">
              SELECT THE TARGET WORKSPACE TO DEPLOY THE DOCUMENT TILE FOR:
              <span className="block mt-1 text-[#D4AF37] font-black uppercase">
                ' {docToAddToWorkspace.title} '
              </span>
            </p>

            <div className="space-y-2 max-h-[180px] overflow-y-auto mb-4 border border-black/20 p-2 bg-black/15">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleConfirmAddToWorkspace(ws.id)}
                  className="w-full text-left p-2.5 border border-black bg-black/20 hover:bg-[#D4AF37] hover:text-black transition-colors font-bold uppercase text-[11px] flex justify-between items-center"
                >
                  <span>{ws.name}</span>
                  <span className="opacity-50 text-[9px]">({ws.tiles?.length || 0} TILES)</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocToAddToWorkspace(null)}
                className="border-2 border-black bg-black/20 px-4 py-2 text-xs font-black hover:bg-black/40 transition-colors uppercase"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        userToken={userToken}
        currentUser={currentUser}
      />

      <MediaVaultModal
        isOpen={isMediaVaultOpen}
        onClose={() => setIsMediaVaultOpen(false)}
        currentUser={currentUser}
      />

      <WorkspaceFolderSelectorModal
        isOpen={isWorkspaceFolderSelectorOpen}
        onClose={() => setIsWorkspaceFolderSelectorOpen(false)}
        currentUser={currentUser}
        onWorkspaceConfigured={(updatedWorkspace) => {
          if (currentUser) {
            setCurrentUser({
              ...currentUser,
              workspacePath: updatedWorkspace.path,
              workspaceName: updatedWorkspace.name,
            });
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('docustack_workspace_path', updatedWorkspace.path);
            localStorage.setItem('docustack_workspace_name', updatedWorkspace.name);
          }
          loadUserWorkspaceData();
        }}
      />

      {isWorkspacesMenuOpen && currentUser && (
        <WorkspaceTilesMenu
          currentUser={currentUser}
          userToken={userToken}
          onEnterWorkspace={handleEnterWorkspace}
          onOpenSettings={() => {
            setIsWorkspacesMenuOpen(false);
            setIsSettingsOpen(true);
          }}
          onLogout={handleLogout}
          onOpenAdminPanel={() => {
            setIsWorkspacesMenuOpen(false);
            router.push('/admin');
          }}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
          onClose={() => setIsWorkspacesMenuOpen(false)}
          canClose={true}
        />
      )}

      <WindTransition
        triggerKey={transitionKey}
        onTransitionMiddle={() => {
          if (transitionTargetMode) {
            setViewMode(transitionTargetMode);
          }
        }}
        onComplete={() => {
          setTransitionTargetMode(null);
          setTransitionKey(null);
        }}
      />
    </>
  );
}
