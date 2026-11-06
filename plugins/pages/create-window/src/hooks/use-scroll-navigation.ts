import { useState, useRef, useEffect, useCallback, RefObject } from 'react';

export interface Section {
  id: string;
  key: string;
}

export interface UseScrollNavigationReturn {
  activeSection: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  sectionRefs: RefObject<{ [key: string]: HTMLDivElement | null }>;
  scrollToSection: (sectionId: string) => void;
}

/**
 * 滚动导航 Hook
 * 处理滚动监听和导航高亮
 */
export function useScrollNavigation(sectionIds: string[]): UseScrollNavigationReturn {
  const [activeSection, setActiveSection] = useState<string>(sectionIds[0] || '');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const debounceTimerRef = useRef<number | null>(null);

  // 滚动监听
  useEffect(() => {
    const scrollAreaRoot = scrollContainerRef.current;
    if (!scrollAreaRoot) return;

    const container = scrollAreaRoot.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    if (!container) return;

    const updateActiveSection = () => {
      const scrollTop = container.scrollTop;
      const threshold = 100;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const sectionId = sectionIds[i];
        const element = sectionRefs.current[sectionId];
        if (element) {
          const elementTop = element.offsetTop;
          if (scrollTop + threshold >= elementTop) {
            setActiveSection(sectionId);
            return;
          }
        }
      }

      if (sectionIds.length > 0) {
        setActiveSection(sectionIds[0]);
      }
    };

    const handleScroll = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(updateActiveSection, 150);
    };

    container.addEventListener('scroll', handleScroll);
    updateActiveSection();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sectionIds]);

  // 跳转到指定部分
  const scrollToSection = useCallback((sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    const scrollAreaRoot = scrollContainerRef.current;
    if (!element || !scrollAreaRoot) return;

    const container = scrollAreaRoot.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    if (!container) return;

    const scrollPosition = element.offsetTop - 16;
    setActiveSection(sectionId);

    container.scrollTo({
      top: scrollPosition,
      behavior: 'smooth',
    });
  }, []);

  return {
    activeSection,
    scrollContainerRef,
    sectionRefs,
    scrollToSection,
  };
}
