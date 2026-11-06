import { useState, useCallback } from 'react';

interface UseSearchPaginationReturn {
  searchQuery: string;
  proxyType: string;
  currentPage: number;
  setSearchQuery: (value: string) => void;
  setProxyType: (value: string) => void;
  setCurrentPage: (page: number) => void;
  handleSearchChange: (value: string) => void;
  handleProxyTypeChange: (value: string) => void;
  handlePageChange: (page: number) => void;
}

/**
 * 搜索和分页状态管理 Hook
 */
export function useSearchPagination(): UseSearchPaginationReturn {
  const [searchQuery, setSearchQueryState] = useState('');
  const [proxyType, setProxyTypeState] = useState('all');
  const [currentPage, setCurrentPageState] = useState(1);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQueryState(value);
    setCurrentPageState(1);
  }, []);

  const handleProxyTypeChange = useCallback((value: string) => {
    setProxyTypeState(value);
    setCurrentPageState(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPageState(page);
  }, []);

  return {
    searchQuery,
    proxyType,
    currentPage,
    setSearchQuery: setSearchQueryState,
    setProxyType: setProxyTypeState,
    setCurrentPage: setCurrentPageState,
    handleSearchChange,
    handleProxyTypeChange,
    handlePageChange,
  };
}
