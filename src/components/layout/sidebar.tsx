'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { EditorTab } from '@/types';
import clsx from 'clsx';
import { Edit, Eye, LayoutGrid, Package, PanelLeft, PanelLeftClose, Settings } from 'lucide-react';
import styles from './sidebar.module.css';

const navItems: { tab: EditorTab; icon: React.ReactNode; label: string }[] = [
  { tab: 'icons', icon: <LayoutGrid />, label: 'Icons' },
  { tab: 'editor', icon: <Edit />, label: 'Editor' },
  { tab: 'preview', icon: <Eye />, label: 'Preview' },
  { tab: 'generate', icon: <Package />, label: 'Generate' },
];

export function Sidebar() {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen } = useWorkspaceStore();

  return (
    <div className={clsx(styles.sidebar, sidebarOpen ? styles.open : styles.closed)}>
      <div className={styles.toggle}>
        <Button
          variant="outline"
          size="sm"
          className={styles.toggleButton}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
        </Button>
      </div>

      <nav className={styles.nav}>
        {navItems.map(item => (
          <Button
            key={item.tab}
            variant={activeTab === item.tab ? 'secondary' : 'outline'}
            size="sm"
            className={sidebarOpen ? styles.navButton : styles.navButtonCollapsed}
            onClick={() => setActiveTab(item.tab)}
          >
            {item.icon}
            {sidebarOpen && <span className={styles.navLabel}>{item.label}</span>}
          </Button>
        ))}
      </nav>

      <Separator />

      <div className={styles.footer}>
        <Button
          variant="outline"
          size="sm"
          className={sidebarOpen ? styles.navButton : styles.navButtonCollapsed}
          onClick={() => setActiveTab('preview')}
        >
          <Settings />
          {sidebarOpen && <span className={styles.navLabel}>Settings</span>}
        </Button>
      </div>
    </div>
  );
}
