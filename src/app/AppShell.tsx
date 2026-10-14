import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { SectionId } from '../core/types'
import { SECTIONS } from './Navigation'
import { Button } from '../ui/Button'

export interface AppShellProps {
  active: SectionId
  onNavigate: (section: SectionId) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  children: ReactNode
}

function NavButton({
  active,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: {
  active: boolean
  label: string
  icon: React.ComponentType<{ size?: number | string }>
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent-soft text-accent'
          : 'text-muted hover:bg-surface-2 hover:text-ink'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <Icon size={18} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

function SidebarContent({
  active,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  theme,
  onToggleTheme,
  onNavigateDone,
}: Omit<AppShellProps, 'children'> & { onNavigateDone?: () => void }) {
  return (
    <div className={`flex h-full flex-col gap-1 ${collapsed ? 'px-2' : 'px-3'} py-4`}>
      <div className={`mb-4 flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
          <span className="text-sm font-bold">T</span>
        </div>
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight">TaskFlow</span>}
      </div>

      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
        {SECTIONS.map((section) => (
          <NavButton
            key={section.id}
            active={section.id === active}
            label={section.label}
            icon={section.icon}
            collapsed={collapsed}
            onClick={() => {
              onNavigate(section.id)
              onNavigateDone?.()
            }}
          />
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3">
        <NavButton
          active={false}
          label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          icon={theme === 'dark' ? Sun : Moon}
          collapsed={collapsed}
          onClick={onToggleTheme}
        />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:flex ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
        {!collapsed && (
          <p className="px-3 pt-2 text-[11px] leading-relaxed text-faint">
            Local-first · data stays in this browser
          </p>
        )}
      </div>
    </div>
  )
}

export function AppShell(props: AppShellProps) {
  const { children, active, collapsed, onNavigate, onToggleCollapsed, theme, onToggleTheme } = props
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const activeMeta = SECTIONS.find((s) => s.id === active)

  return (
    <div className="flex h-full overflow-hidden bg-app">
      <aside
        aria-label="Sidebar"
        className={`hidden shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <SidebarContent
          active={active}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <h1 className="truncate text-[15px] font-semibold">{activeMeta?.label}</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">{children}</main>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileOpen(false)
          }}
        >
          <div className="h-full w-64 border-r border-line bg-surface shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <Button variant="ghost" size="sm" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                <X size={16} />
              </Button>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <SidebarContent
                active={active}
                onNavigate={onNavigate}
                collapsed={false}
                onToggleCollapsed={onToggleCollapsed}
                theme={theme}
                onToggleTheme={onToggleTheme}
                onNavigateDone={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
