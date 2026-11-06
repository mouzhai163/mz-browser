import { useState } from 'react';

interface UseSearchPaginationReturn {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  handleSearchChange: (value: string) => void;
  handlePageChange: (page: number) => void;
}

/**
 * 搜索和分页状态管理 Hook
 */
export function useSearchPagination(): UseSearchPaginationReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    handlePageChange,
  };
}
