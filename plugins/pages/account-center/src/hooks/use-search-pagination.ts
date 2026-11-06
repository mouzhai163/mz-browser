import { useState, useCallback } from 'react';

export function useSearchPagination() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // 重置到第一页
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return {
    searchQuery,
    currentPage,
    handleSearchChange,
    handlePageChange,
  };
}
