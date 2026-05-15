'use client';

import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Grid3X3, LayoutGrid, Square } from 'lucide-react';
import type { ViewMode } from '@/types';
import styles from '@/app/styles/search-toolbar.module.css';

const viewModes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'small', icon: <Grid3X3 />, label: 'Small' },
  { mode: 'medium', icon: <LayoutGrid />, label: 'Medium' },
  { mode: 'large', icon: <Square />, label: 'Large' },
];

export function SearchToolbar() {
  const searchQuery = useIconStore(s => s.searchQuery);
  const setSearchQuery = useIconStore(s => s.setSearchQuery);
  const icons = useIconStore(s => s.icons);
  const { viewMode, setViewMode } = useWorkspaceStore();

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} />
        <Input
          placeholder="Search icons..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>
      <span className={styles.count}>{icons.length} icons</span>
      <div className={styles.viewModes}>
        {viewModes.map(v => (
          <Button
            key={v.mode}
            variant={viewMode === v.mode ? 'secondary' : 'ghost'}
            size="sm"
            className={styles.viewModeButton}
            onClick={() => setViewMode(v.mode)}
            title={v.label}
          >
            {v.icon}
          </Button>
        ))}
      </div>
    </div>
  );
}
