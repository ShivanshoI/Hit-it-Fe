import { useEffect } from 'react';

/**
 * Locks document body scroll while the component is mounted.
 * Restores the original overflow on cleanup.
 */
export function useScrollLock() {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);
}
