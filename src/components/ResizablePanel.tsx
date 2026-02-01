import { useState, useRef, useCallback, useEffect, ReactNode } from "react";

interface ResizablePanelProps {
  children: ReactNode;
  side: "left" | "right";
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  className?: string;
  floatable?: boolean;
}

export function ResizablePanel({
  children,
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  isOpen,
  onToggle,
  title,
  className = "",
  floatable = false,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [floatingSize, setFloatingSize] = useState({ width: defaultWidth, height: 400 });

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 });

  // Handle resize for docked panel
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      width: isFloating ? floatingSize.width : width,
      height: floatingSize.height,
      x: e.clientX,
      y: e.clientY,
    };
  }, [width, isFloating, floatingSize]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isFloating) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        setFloatingSize({
          width: Math.max(minWidth, Math.min(maxWidth, resizeStart.current.width + deltaX)),
          height: Math.max(200, Math.min(800, resizeStart.current.height + deltaY)),
        });
      } else {
        const delta = side === "left"
          ? e.clientX - resizeStart.current.x
          : resizeStart.current.x - e.clientX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.current.width + delta));
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, side, minWidth, maxWidth, isFloating]);

  // Handle drag for floating panel
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isFloating) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [isFloating, position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      const maxX = window.innerWidth - floatingSize.width;
      const maxY = window.innerHeight - 100;

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, floatingSize.width]);

  // Toggle floating mode
  const toggleFloating = useCallback(() => {
    if (!floatable) return;

    if (!isFloating && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: rect.top });
      setFloatingSize({ width, height: Math.min(rect.height, 500) });
    }
    setIsFloating(!isFloating);
  }, [floatable, isFloating, width]);

  // Render floating panel
  if (isFloating && isOpen) {
    return (
      <div
        ref={panelRef}
        className="fixed z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: floatingSize.width,
          height: floatingSize.height,
        }}
      >
        {/* Header - draggable */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-dark-700 border-b border-dark-600 cursor-move select-none flex-shrink-0"
          onMouseDown={handleDragStart}
        >
          <span className="text-sm font-medium text-white">{title}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFloating}
              className="p-1 text-dark-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
              title="Panele Sabitle"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
            <button
              onClick={onToggle}
              className="p-1 text-dark-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
              title="Kapat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-4 h-4 text-dark-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      </div>
    );
  }

  // Render nothing if closed and not floating
  if (!isOpen) {
    return null;
  }

  // Render docked panel
  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 flex flex-col overflow-hidden ${className}`}
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-dark-700 border-b border-dark-600 flex-shrink-0">
        <span className="text-sm font-medium text-white">{title}</span>
        <div className="flex items-center gap-1">
          {floatable && (
            <button
              onClick={toggleFloating}
              className="p-1 text-dark-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
              title="Serbest Pencere Yap"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="5" width="14" height="14" rx="2" />
                <path d="M12 5V2M12 22v-3M5 12H2M22 12h-3" />
              </svg>
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 text-dark-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
            title="Gizle"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {side === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Resize handle */}
      <div
        className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-500/50 active:bg-primary-500 transition-colors ${
          side === "left" ? "right-0" : "left-0"
        }`}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}

// Toggle button for collapsed sidebars
interface SidebarToggleProps {
  side: "left" | "right";
  isOpen: boolean;
  onToggle: () => void;
  title: string;
}

export function SidebarToggle({ side, isOpen, onToggle, title }: SidebarToggleProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onToggle}
      className={`absolute top-1/2 -translate-y-1/2 z-30 bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-white p-1.5 border border-dark-600 transition-all shadow-lg ${
        side === "left" ? "left-0 rounded-r border-l-0" : "right-0 rounded-l border-r-0"
      }`}
      title={title}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {side === "left" ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
      </svg>
    </button>
  );
}
