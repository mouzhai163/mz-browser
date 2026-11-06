import { create } from 'zustand';
import type { Environment } from '../../types';

interface DialogState {
  // 导入对话框
  importDialogOpen: boolean;
  importJson: string;

  // 移动到分组对话框
  moveToGroupDialogOpen: boolean;
  selectedGroupId: string;

  // 分配标签对话框
  assignTagDialogOpen: boolean;
  selectedTagIds: string[];

  // 标签管理对话框
  manageTagsDialogOpen: boolean;

  // 单个环境配置标签对话框
  assignSingleTagDialogOpen: boolean;
  assigningEnvironment: Environment | null;
  singleSelectedTagId: string;

  // 单个环境配置分组对话框
  assignSingleGroupDialogOpen: boolean;
  assigningEnvironmentForGroup: Environment | null;
  singleSelectedGroupId: string;

  // 创建标签对话框
  createTagDialogOpen: boolean;
  newTagName: string;
  newTagColor: string;

  // 编辑标签对话框
  editTagDialogOpen: boolean;
  editingTag: { uuid: string; name: string; color: string } | null;
  editTagName: string;
  editTagColor: string;

  // 创建分组对话框
  createGroupDialogOpen: boolean;
  newGroupName: string;
  newGroupDescription: string;

  // 选择账号对话框
  selectAccountDialogOpen: boolean;
  selectAccountEnvironment: Environment | null;

  // 创建账号对话框
  createAccountDialogOpen: boolean;

  // 选择代理对话框
  selectProxyDialogOpen: boolean;
  selectProxyEnvironment: Environment | null;

  // 创建代理对话框
  createProxyDialogOpen: boolean;

  // 删除环境确认对话框
  deleteConfirmDialogOpen: boolean;
  deleteConfirmEnvironment: Environment | null;

  // 恢复环境确认对话框
  restoreConfirmDialogOpen: boolean;
  restoreConfirmEnvironment: Environment | null;

  // 永久删除环境确认对话框
  permanentDeleteConfirmDialogOpen: boolean;
  permanentDeleteConfirmEnvironment: Environment | null;

  // 编辑名称对话框
  editNameDialogOpen: boolean;
  editNameEnvironment: Environment | null;

  // 编辑备注对话框
  editNoteDialogOpen: boolean;
  editNoteEnvironment: Environment | null;

  // 编辑 Cookies 对话框
  editCookiesDialogOpen: boolean;
  editCookiesEnvironment: Environment | null;

  // 清除缓存确认对话框
  clearCacheDialogOpen: boolean;
  clearCacheEnvironment: Environment | null;

  // 编辑 URL 对话框
  editUrlDialogOpen: boolean;
  editUrlEnvironment: Environment | null;

  // 批量删除确认对话框
  batchDeleteConfirmDialogOpen: boolean;
  batchDeleteCount: number;

  // 批量永久删除确认对话框
  batchPermanentDeleteConfirmDialogOpen: boolean;
  batchPermanentDeleteCount: number;
}

interface DialogActions {
  // 导入对话框
  setImportDialogOpen: (open: boolean) => void;
  setImportJson: (json: string) => void;
  openImportDialog: () => void;
  closeImportDialog: () => void;

  // 移动到分组对话框
  setMoveToGroupDialogOpen: (open: boolean) => void;
  setSelectedGroupId: (groupId: string) => void;
  openMoveToGroupDialog: () => void;
  closeMoveToGroupDialog: () => void;

  // 分配标签对话框
  setAssignTagDialogOpen: (open: boolean) => void;
  setSelectedTagIds: (tagIds: string[]) => void;
  toggleTagId: (tagId: string) => void;
  openAssignTagDialog: () => void;
  closeAssignTagDialog: () => void;

  // 标签管理对话框
  setManageTagsDialogOpen: (open: boolean) => void;
  openManageTagsDialog: () => void;
  closeManageTagsDialog: () => void;

  // 单个环境配置标签对话框
  setAssignSingleTagDialogOpen: (open: boolean) => void;
  setAssigningEnvironment: (env: Environment | null) => void;
  setSingleSelectedTagId: (tagId: string) => void;
  openAssignSingleTagDialog: (env: Environment) => void;
  closeAssignSingleTagDialog: () => void;

  // 单个环境配置分组对话框
  setAssignSingleGroupDialogOpen: (open: boolean) => void;
  setAssigningEnvironmentForGroup: (env: Environment | null) => void;
  setSingleSelectedGroupId: (groupId: string) => void;
  openAssignSingleGroupDialog: (env: Environment) => void;
  closeAssignSingleGroupDialog: () => void;

  // 创建标签对话框
  setCreateTagDialogOpen: (open: boolean) => void;
  setNewTagName: (name: string) => void;
  setNewTagColor: (color: string) => void;
  openCreateTagDialog: () => void;
  closeCreateTagDialog: () => void;

  // 编辑标签对话框
  setEditTagDialogOpen: (open: boolean) => void;
  setEditingTag: (tag: { uuid: string; name: string; color: string } | null) => void;
  setEditTagName: (name: string) => void;
  setEditTagColor: (color: string) => void;
  openEditTagDialog: (tag: { uuid: string; name: string; color: string }) => void;
  closeEditTagDialog: () => void;

  // 创建分组对话框
  setCreateGroupDialogOpen: (open: boolean) => void;
  setNewGroupName: (name: string) => void;
  setNewGroupDescription: (description: string) => void;
  openCreateGroupDialog: () => void;
  closeCreateGroupDialog: () => void;

  // 选择账号对话框
  setSelectAccountDialogOpen: (open: boolean) => void;
  setSelectAccountEnvironment: (env: Environment | null) => void;
  openSelectAccountDialog: (env: Environment) => void;
  closeSelectAccountDialog: () => void;

  // 创建账号对话框
  setCreateAccountDialogOpen: (open: boolean) => void;
  openCreateAccountDialog: () => void;
  closeCreateAccountDialog: () => void;

  // 选择代理对话框
  setSelectProxyDialogOpen: (open: boolean) => void;
  setSelectProxyEnvironment: (env: Environment | null) => void;
  openSelectProxyDialog: (env: Environment) => void;
  closeSelectProxyDialog: () => void;

  // 创建代理对话框
  setCreateProxyDialogOpen: (open: boolean) => void;
  openCreateProxyDialog: () => void;
  closeCreateProxyDialog: () => void;

  // 删除环境确认对话框
  setDeleteConfirmDialogOpen: (open: boolean) => void;
  setDeleteConfirmEnvironment: (env: Environment | null) => void;
  openDeleteConfirmDialog: (env: Environment) => void;
  closeDeleteConfirmDialog: () => void;

  // 恢复环境确认对话框
  setRestoreConfirmDialogOpen: (open: boolean) => void;
  setRestoreConfirmEnvironment: (env: Environment | null) => void;
  openRestoreConfirmDialog: (env: Environment) => void;
  closeRestoreConfirmDialog: () => void;

  // 永久删除环境确认对话框
  setPermanentDeleteConfirmDialogOpen: (open: boolean) => void;
  setPermanentDeleteConfirmEnvironment: (env: Environment | null) => void;
  openPermanentDeleteConfirmDialog: (env: Environment) => void;
  closePermanentDeleteConfirmDialog: () => void;

  // 编辑名称对话框
  setEditNameDialogOpen: (open: boolean) => void;
  setEditNameEnvironment: (env: Environment | null) => void;
  openEditNameDialog: (env: Environment) => void;
  closeEditNameDialog: () => void;

  // 编辑备注对话框
  setEditNoteDialogOpen: (open: boolean) => void;
  setEditNoteEnvironment: (env: Environment | null) => void;
  openEditNoteDialog: (env: Environment) => void;
  closeEditNoteDialog: () => void;

  // 编辑 Cookies 对话框
  setEditCookiesDialogOpen: (open: boolean) => void;
  setEditCookiesEnvironment: (env: Environment | null) => void;
  openEditCookiesDialog: (env: Environment) => void;
  closeEditCookiesDialog: () => void;

  // 清除缓存确认对话框
  setClearCacheDialogOpen: (open: boolean) => void;
  setClearCacheEnvironment: (env: Environment | null) => void;
  openClearCacheDialog: (env: Environment) => void;
  closeClearCacheDialog: () => void;

  // 编辑 URL 对话框
  setEditUrlDialogOpen: (open: boolean) => void;
  setEditUrlEnvironment: (env: Environment | null) => void;
  openEditUrlDialog: (env: Environment) => void;
  closeEditUrlDialog: () => void;

  // 批量删除确认对话框
  setBatchDeleteConfirmDialogOpen: (open: boolean) => void;
  setBatchDeleteCount: (count: number) => void;
  openBatchDeleteConfirmDialog: (count: number) => void;
  closeBatchDeleteConfirmDialog: () => void;

  // 批量永久删除确认对话框
  setBatchPermanentDeleteConfirmDialogOpen: (open: boolean) => void;
  setBatchPermanentDeleteCount: (count: number) => void;
  openBatchPermanentDeleteConfirmDialog: (count: number) => void;
  closeBatchPermanentDeleteConfirmDialog: () => void;
}

/**
 * 环境对话框状态 Store
 * 管理所有对话框的开关状态和表单数据
 */
export const useEnvironmentDialogStore = create<DialogState & DialogActions>((set) => ({
  // 初始状态
  importDialogOpen: false,
  importJson: '',
  moveToGroupDialogOpen: false,
  selectedGroupId: '',
  assignTagDialogOpen: false,
  selectedTagIds: [],
  manageTagsDialogOpen: false,
  assignSingleTagDialogOpen: false,
  assigningEnvironment: null,
  singleSelectedTagId: '',
  assignSingleGroupDialogOpen: false,
  assigningEnvironmentForGroup: null,
  singleSelectedGroupId: '',
  createTagDialogOpen: false,
  newTagName: '',
  newTagColor: 'slate',
  editTagDialogOpen: false,
  editingTag: null,
  editTagName: '',
  editTagColor: 'slate',
  createGroupDialogOpen: false,
  newGroupName: '',
  newGroupDescription: '',
  selectAccountDialogOpen: false,
  selectAccountEnvironment: null,
  createAccountDialogOpen: false,
  selectProxyDialogOpen: false,
  selectProxyEnvironment: null,
  createProxyDialogOpen: false,
  deleteConfirmDialogOpen: false,
  deleteConfirmEnvironment: null,
  restoreConfirmDialogOpen: false,
  restoreConfirmEnvironment: null,
  permanentDeleteConfirmDialogOpen: false,
  permanentDeleteConfirmEnvironment: null,
  editNameDialogOpen: false,
  editNameEnvironment: null,
  editNoteDialogOpen: false,
  editNoteEnvironment: null,
  editCookiesDialogOpen: false,
  editCookiesEnvironment: null,
  clearCacheDialogOpen: false,
  clearCacheEnvironment: null,
  editUrlDialogOpen: false,
  editUrlEnvironment: null,
  batchDeleteConfirmDialogOpen: false,
  batchDeleteCount: 0,
  batchPermanentDeleteConfirmDialogOpen: false,
  batchPermanentDeleteCount: 0,

  // 导入对话框
  setImportDialogOpen: (open) => set({ importDialogOpen: open }),
  setImportJson: (json) => set({ importJson: json }),
  openImportDialog: () => set({ importDialogOpen: true }),
  closeImportDialog: () => set({ importDialogOpen: false, importJson: '' }),

  // 移动到分组对话框
  setMoveToGroupDialogOpen: (open) => set({ moveToGroupDialogOpen: open }),
  setSelectedGroupId: (groupId) =>
    set((state) => ({
      selectedGroupId: state.selectedGroupId === groupId ? '' : groupId,
    })),
  openMoveToGroupDialog: () => set({ moveToGroupDialogOpen: true }),
  closeMoveToGroupDialog: () => set({ moveToGroupDialogOpen: false, selectedGroupId: '' }),

  // 分配标签对话框
  setAssignTagDialogOpen: (open) => set({ assignTagDialogOpen: open }),
  setSelectedTagIds: (tagIds) => set({ selectedTagIds: tagIds }),
  toggleTagId: (tagId) =>
    set((state) => {
      const isSelected = state.selectedTagIds.includes(tagId);
      return {
        selectedTagIds: isSelected
          ? state.selectedTagIds.filter((id) => id !== tagId)
          : [...state.selectedTagIds, tagId],
      };
    }),
  openAssignTagDialog: () => set({ assignTagDialogOpen: true }),
  closeAssignTagDialog: () => set({ assignTagDialogOpen: false, selectedTagIds: [] }),

  // 标签管理对话框
  setManageTagsDialogOpen: (open) => set({ manageTagsDialogOpen: open }),
  openManageTagsDialog: () => set({ manageTagsDialogOpen: true }),
  closeManageTagsDialog: () => set({ manageTagsDialogOpen: false }),

  // 单个环境配置标签对话框
  setAssignSingleTagDialogOpen: (open) => set({ assignSingleTagDialogOpen: open }),
  setAssigningEnvironment: (env) => set({ assigningEnvironment: env }),
  setSingleSelectedTagId: (tagId) => set({ singleSelectedTagId: tagId }),
  openAssignSingleTagDialog: (env) =>
    set({ assignSingleTagDialogOpen: true, assigningEnvironment: env, singleSelectedTagId: '' }),
  closeAssignSingleTagDialog: () =>
    set({ assignSingleTagDialogOpen: false, assigningEnvironment: null, singleSelectedTagId: '' }),

  // 单个环境配置分组对话框
  setAssignSingleGroupDialogOpen: (open) => set({ assignSingleGroupDialogOpen: open }),
  setAssigningEnvironmentForGroup: (env) => set({ assigningEnvironmentForGroup: env }),
  setSingleSelectedGroupId: (groupId) =>
    set((state) => ({
      singleSelectedGroupId: state.singleSelectedGroupId === groupId ? '' : groupId,
    })),
  openAssignSingleGroupDialog: (env) =>
    set({
      assignSingleGroupDialogOpen: true,
      assigningEnvironmentForGroup: env,
      singleSelectedGroupId: '',
    }),
  closeAssignSingleGroupDialog: () =>
    set({
      assignSingleGroupDialogOpen: false,
      assigningEnvironmentForGroup: null,
      singleSelectedGroupId: '',
    }),

  // 创建标签对话框
  setCreateTagDialogOpen: (open) => set({ createTagDialogOpen: open }),
  setNewTagName: (name) => set({ newTagName: name }),
  setNewTagColor: (color) => set({ newTagColor: color }),
  openCreateTagDialog: () => set({ createTagDialogOpen: true }),
  closeCreateTagDialog: () =>
    set({ createTagDialogOpen: false, newTagName: '', newTagColor: 'slate' }),

  // 编辑标签对话框
  setEditTagDialogOpen: (open) => set({ editTagDialogOpen: open }),
  setEditingTag: (tag) => set({ editingTag: tag }),
  setEditTagName: (name) => set({ editTagName: name }),
  setEditTagColor: (color) => set({ editTagColor: color }),
  openEditTagDialog: (tag) =>
    set({
      editTagDialogOpen: true,
      editingTag: tag,
      editTagName: tag.name,
      editTagColor: tag.color,
    }),
  closeEditTagDialog: () =>
    set({ editTagDialogOpen: false, editingTag: null, editTagName: '', editTagColor: 'slate' }),

  // 创建分组对话框
  setCreateGroupDialogOpen: (open) => set({ createGroupDialogOpen: open }),
  setNewGroupName: (name) => set({ newGroupName: name }),
  setNewGroupDescription: (description) => set({ newGroupDescription: description }),
  openCreateGroupDialog: () => set({ createGroupDialogOpen: true }),
  closeCreateGroupDialog: () =>
    set({ createGroupDialogOpen: false, newGroupName: '', newGroupDescription: '' }),

  // 选择账号对话框
  setSelectAccountDialogOpen: (open) => set({ selectAccountDialogOpen: open }),
  setSelectAccountEnvironment: (env) => set({ selectAccountEnvironment: env }),
  openSelectAccountDialog: (env) =>
    set({ selectAccountDialogOpen: true, selectAccountEnvironment: env }),
  closeSelectAccountDialog: () =>
    set({ selectAccountDialogOpen: false, selectAccountEnvironment: null }),

  // 创建账号对话框
  setCreateAccountDialogOpen: (open) => set({ createAccountDialogOpen: open }),
  openCreateAccountDialog: () => set({ createAccountDialogOpen: true }),
  closeCreateAccountDialog: () => set({ createAccountDialogOpen: false }),

  // 选择代理对话框
  setSelectProxyDialogOpen: (open) => set({ selectProxyDialogOpen: open }),
  setSelectProxyEnvironment: (env) => set({ selectProxyEnvironment: env }),
  openSelectProxyDialog: (env) => set({ selectProxyDialogOpen: true, selectProxyEnvironment: env }),
  closeSelectProxyDialog: () => set({ selectProxyDialogOpen: false, selectProxyEnvironment: null }),

  // 创建代理对话框
  setCreateProxyDialogOpen: (open) => set({ createProxyDialogOpen: open }),
  openCreateProxyDialog: () => set({ createProxyDialogOpen: true }),
  closeCreateProxyDialog: () => set({ createProxyDialogOpen: false }),

  // 删除环境确认对话框
  setDeleteConfirmDialogOpen: (open) => set({ deleteConfirmDialogOpen: open }),
  setDeleteConfirmEnvironment: (env) => set({ deleteConfirmEnvironment: env }),
  openDeleteConfirmDialog: (env) =>
    set({ deleteConfirmDialogOpen: true, deleteConfirmEnvironment: env }),
  closeDeleteConfirmDialog: () =>
    set({ deleteConfirmDialogOpen: false, deleteConfirmEnvironment: null }),

  // 恢复环境确认对话框
  setRestoreConfirmDialogOpen: (open) => set({ restoreConfirmDialogOpen: open }),
  setRestoreConfirmEnvironment: (env) => set({ restoreConfirmEnvironment: env }),
  openRestoreConfirmDialog: (env) =>
    set({ restoreConfirmDialogOpen: true, restoreConfirmEnvironment: env }),
  closeRestoreConfirmDialog: () =>
    set({ restoreConfirmDialogOpen: false, restoreConfirmEnvironment: null }),

  // 永久删除环境确认对话框
  setPermanentDeleteConfirmDialogOpen: (open) => set({ permanentDeleteConfirmDialogOpen: open }),
  setPermanentDeleteConfirmEnvironment: (env) => set({ permanentDeleteConfirmEnvironment: env }),
  openPermanentDeleteConfirmDialog: (env) =>
    set({ permanentDeleteConfirmDialogOpen: true, permanentDeleteConfirmEnvironment: env }),
  closePermanentDeleteConfirmDialog: () =>
    set({ permanentDeleteConfirmDialogOpen: false, permanentDeleteConfirmEnvironment: null }),

  // 编辑名称对话框
  setEditNameDialogOpen: (open) => set({ editNameDialogOpen: open }),
  setEditNameEnvironment: (env) => set({ editNameEnvironment: env }),
  openEditNameDialog: (env) => set({ editNameDialogOpen: true, editNameEnvironment: env }),
  closeEditNameDialog: () => set({ editNameDialogOpen: false, editNameEnvironment: null }),

  // 编辑备注对话框
  setEditNoteDialogOpen: (open) => set({ editNoteDialogOpen: open }),
  setEditNoteEnvironment: (env) => set({ editNoteEnvironment: env }),
  openEditNoteDialog: (env) => set({ editNoteDialogOpen: true, editNoteEnvironment: env }),
  closeEditNoteDialog: () => set({ editNoteDialogOpen: false, editNoteEnvironment: null }),

  // 编辑 Cookies 对话框
  setEditCookiesDialogOpen: (open) => set({ editCookiesDialogOpen: open }),
  setEditCookiesEnvironment: (env) => set({ editCookiesEnvironment: env }),
  openEditCookiesDialog: (env) => set({ editCookiesDialogOpen: true, editCookiesEnvironment: env }),
  closeEditCookiesDialog: () => set({ editCookiesDialogOpen: false, editCookiesEnvironment: null }),

  // 清除缓存确认对话框
  setClearCacheDialogOpen: (open) => set({ clearCacheDialogOpen: open }),
  setClearCacheEnvironment: (env) => set({ clearCacheEnvironment: env }),
  openClearCacheDialog: (env) => set({ clearCacheDialogOpen: true, clearCacheEnvironment: env }),
  closeClearCacheDialog: () => set({ clearCacheDialogOpen: false, clearCacheEnvironment: null }),

  // 编辑 URL 对话框
  setEditUrlDialogOpen: (open) => set({ editUrlDialogOpen: open }),
  setEditUrlEnvironment: (env) => set({ editUrlEnvironment: env }),
  openEditUrlDialog: (env) => set({ editUrlDialogOpen: true, editUrlEnvironment: env }),
  closeEditUrlDialog: () => set({ editUrlDialogOpen: false, editUrlEnvironment: null }),

  // 批量删除确认对话框
  setBatchDeleteConfirmDialogOpen: (open) => set({ batchDeleteConfirmDialogOpen: open }),
  setBatchDeleteCount: (count) => set({ batchDeleteCount: count }),
  openBatchDeleteConfirmDialog: (count) =>
    set({ batchDeleteConfirmDialogOpen: true, batchDeleteCount: count }),
  closeBatchDeleteConfirmDialog: () =>
    set({ batchDeleteConfirmDialogOpen: false, batchDeleteCount: 0 }),

  // 批量永久删除确认对话框
  setBatchPermanentDeleteConfirmDialogOpen: (open) =>
    set({ batchPermanentDeleteConfirmDialogOpen: open }),
  setBatchPermanentDeleteCount: (count) => set({ batchPermanentDeleteCount: count }),
  openBatchPermanentDeleteConfirmDialog: (count) =>
    set({ batchPermanentDeleteConfirmDialogOpen: true, batchPermanentDeleteCount: count }),
  closeBatchPermanentDeleteConfirmDialog: () =>
    set({ batchPermanentDeleteConfirmDialogOpen: false, batchPermanentDeleteCount: 0 }),
}));
