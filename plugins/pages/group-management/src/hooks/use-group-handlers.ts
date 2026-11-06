import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Group, GroupFormData } from '../types';
import { useGroupOperations } from './use-group-operations';
import { useGroupSelection } from './use-group-selection';

interface UseGroupHandlersProps {
  groups: Group[];
  paginatedGroups: Group[];
  onRefresh: () => Promise<void>;
}

interface UseGroupHandlersReturn {
  // 对话框状态
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  assignToTeamDialogOpen: boolean;
  deleteDialogOpen: boolean;
  batchDeleteDialogOpen: boolean;

  // 表单数据
  newGroup: GroupFormData;
  editGroup: GroupFormData;
  editingGroup: Group | null;
  assigningGroup: Group | null;
  deletingGroup: { id: string; uuid: string; name: string; description?: string } | null;
  selectedTeamId: string;

  // 操作
  operations: ReturnType<typeof useGroupOperations>;

  // 选择
  selection: ReturnType<typeof useGroupSelection>;

  // 事件处理
  handleCreateGroup: () => void;
  handleSubmitCreate: () => Promise<void>;
  handleEditGroup: (group: Group) => void;
  handleSubmitEdit: () => Promise<void>;
  handleAssignToTeam: (group: Group) => void;
  handleSubmitAssignToTeam: () => Promise<void>;
  handleDeleteGroup: (group: Group) => void;
  handleConfirmDelete: () => Promise<void>;
  handleBatchDelete: () => void;
  handleConfirmBatchDelete: () => Promise<void>;

  // 状态更新
  setCreateDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  setAssignToTeamDialogOpen: (open: boolean) => void;
  setDeleteDialogOpen: (open: boolean) => void;
  setBatchDeleteDialogOpen: (open: boolean) => void;
  setNewGroup: (data: GroupFormData) => void;
  setEditGroup: (data: GroupFormData) => void;
  setSelectedTeamId: (teamId: string) => void;
}

/**
 * 分组操作事件处理 Hook
 * 整合所有分组相关的操作和事件处理逻辑
 */
export function useGroupHandlers({
  groups: _groups,
  paginatedGroups,
  onRefresh,
}: UseGroupHandlersProps): UseGroupHandlersReturn {
  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignToTeamDialogOpen, setAssignToTeamDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  // 表单数据
  const [newGroup, setNewGroup] = useState<GroupFormData>({ name: '', description: '' });
  const [editGroup, setEditGroup] = useState<GroupFormData>({ name: '', description: '' });
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [assigningGroup, setAssigningGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<{
    id: string;
    uuid: string;
    name: string;
    description?: string;
  } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // 操作逻辑
  const operations = useGroupOperations(() => {
    void onRefresh();
  });

  // 选择管理
  const selection = useGroupSelection(paginatedGroups);

  // 创建分组
  const handleCreateGroup = useCallback(() => {
    setNewGroup({ name: '', description: '' });
    setCreateDialogOpen(true);
  }, []);

  const handleSubmitCreate = useCallback(async () => {
    if (!newGroup.name.trim()) {
      toast.warning('请输入分组名称');
      return;
    }
    try {
      await operations.createGroup(newGroup);
      toast.success('创建分组成功');
      setCreateDialogOpen(false);
      setNewGroup({ name: '', description: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建分组失败');
    }
  }, [newGroup, operations]);

  // 编辑分组
  const handleEditGroup = useCallback((group: Group) => {
    setEditingGroup(group);
    setEditGroup({ name: group.name, description: group.description || '' });
    setEditDialogOpen(true);
  }, []);

  const handleSubmitEdit = useCallback(async () => {
    if (!editingGroup || !editGroup.name.trim()) {
      toast.warning('请输入分组名称');
      return;
    }
    try {
      await operations.updateGroup(editingGroup.uuid, editGroup);
      toast.success('更新分组成功');
      setEditDialogOpen(false);
      setEditingGroup(null);
      setEditGroup({ name: '', description: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新分组失败');
    }
  }, [editingGroup, editGroup, operations]);

  // 划分到团队
  const handleAssignToTeam = useCallback((group: Group) => {
    setAssigningGroup(group);
    setSelectedTeamId('');
    setAssignToTeamDialogOpen(true);
  }, []);

  const handleSubmitAssignToTeam = useCallback(async () => {
    if (!selectedTeamId || !assigningGroup) {
      toast.warning('请选择团队');
      return;
    }
    try {
      await operations.assignToTeam(assigningGroup.uuid, selectedTeamId);
      toast.success('划分到团队成功');
      setAssignToTeamDialogOpen(false);
      setAssigningGroup(null);
      setSelectedTeamId('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '划分失败');
    }
  }, [selectedTeamId, assigningGroup, operations]);

  // 删除分组
  const handleDeleteGroup = useCallback((group: Group) => {
    setDeletingGroup({
      id: group.id,
      uuid: group.uuid,
      name: group.name,
      description: group.description,
    });
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingGroup) return;
    try {
      await operations.deleteGroup(deletingGroup.uuid);
      toast.success('删除分组成功');
      setDeleteDialogOpen(false);
      setDeletingGroup(null);
      // 从选择中移除
      selection.select(deletingGroup.uuid, false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除分组失败');
    }
  }, [deletingGroup, operations, selection]);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (selection.selectedIds.size === 0) return;
    setBatchDeleteDialogOpen(true);
  }, [selection.selectedIds.size]);

  const handleConfirmBatchDelete = useCallback(async () => {
    try {
      const ids = Array.from(selection.selectedIds);
      await operations.batchDeleteGroups(ids);
      toast.success('批量删除成功');
      selection.clearSelection();
      setBatchDeleteDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量删除失败');
    }
  }, [selection, operations]);

  return {
    createDialogOpen,
    editDialogOpen,
    assignToTeamDialogOpen,
    deleteDialogOpen,
    batchDeleteDialogOpen,
    newGroup,
    editGroup,
    editingGroup,
    assigningGroup,
    deletingGroup,
    selectedTeamId,
    operations,
    selection,
    handleCreateGroup,
    handleSubmitCreate,
    handleEditGroup,
    handleSubmitEdit,
    handleAssignToTeam,
    handleSubmitAssignToTeam,
    handleDeleteGroup,
    handleConfirmDelete,
    handleBatchDelete,
    handleConfirmBatchDelete,
    setCreateDialogOpen,
    setEditDialogOpen,
    setAssignToTeamDialogOpen,
    setDeleteDialogOpen,
    setBatchDeleteDialogOpen,
    setNewGroup,
    setEditGroup,
    setSelectedTeamId,
  };
}
