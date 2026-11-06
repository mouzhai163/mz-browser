import { useState, useCallback } from 'react';

interface UseSearchPaginationReturn {
  searchQuery: string;
  currentPage: number;
  setSearchQuery: (query: string) => void;
  setCurrentPage: (page: number) => void;
  handleSearchChange: (value: string) => void;
  handlePageChange: (page: number) => void;
}

/**
 * 搜索和分页状态管理 Hook
 */
export function useSearchPagination(): UseSearchPaginationReturn {
  const [searchQuery, setSearchQueryState] = useState('');
  const [currentPage, setCurrentPageState] = useState(1);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQueryState(value);
    setCurrentPageState(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPageState(page);
  }, []);

  return {
    searchQuery,
    currentPage,
    setSearchQuery: setSearchQueryState,
    setCurrentPage: setCurrentPageState,
    handleSearchChange,
    handlePageChange,
  };
}
