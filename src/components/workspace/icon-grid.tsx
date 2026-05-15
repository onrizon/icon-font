'use client';

import { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useIconStore } from '@/stores/icon-store';
import { IconCard } from './icon-card';
import type { IconGlyph, ViewMode } from '@/types';
import styles from '@/app/styles/icon-grid.module.css';

const gridClass: Record<ViewMode, string> = {
  small: styles.gridSmall,
  medium: styles.gridMedium,
  large: styles.gridLarge,
};

function SortableIconCard({
  icon,
  selected,
  viewMode,
  onClick,
  onDoubleClick,
}: {
  icon: IconGlyph;
  selected: boolean;
  viewMode: ViewMode;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: icon.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <IconCard
        icon={icon}
        selected={selected}
        viewMode={viewMode}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

export function IconGrid() {
  const allIcons = useIconStore(s => s.icons);
  const searchQuery = useIconStore(s => s.searchQuery);
  const reorderIcons = useIconStore(s => s.reorderIcons);

  const icons = useMemo(() => {
    if (!searchQuery) return allIcons;
    const q = searchQuery.toLowerCase();
    return allIcons.filter(
      icon => icon.name.toLowerCase().includes(q) || icon.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [allIcons, searchQuery]);
  const { selectedIds, viewMode, select, toggleSelect, rangeSelect, setEditingIconId } =
    useWorkspaceStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allIds = icons.map(i => i.id);

  const handleClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (e.shiftKey) {
        rangeSelect(id, allIds);
      } else if (e.metaKey || e.ctrlKey) {
        toggleSelect(id);
      } else {
        select(id);
      }
    },
    [allIds, rangeSelect, toggleSelect, select]
  );

  const handleDoubleClick = useCallback(
    (id: string) => {
      setEditingIconId(id);
    },
    [setEditingIconId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = allIds.indexOf(active.id as string);
      const newIndex = allIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...allIds];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      reorderIcons(newOrder);
    },
    [allIds, reorderIcons]
  );

  if (icons.length === 0) {
    return null;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={allIds} strategy={rectSortingStrategy}>
        <div className={clsx(styles.grid, gridClass[viewMode])}>
          {icons.map(icon => (
            <SortableIconCard
              key={icon.id}
              icon={icon}
              selected={selectedIds.has(icon.id)}
              viewMode={viewMode}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
