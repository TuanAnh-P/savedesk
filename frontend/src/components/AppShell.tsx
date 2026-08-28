import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  TransitionChild,
} from '@headlessui/react'
import {
  Bars3Icon,
  ChartBarSquareIcon,
  InboxStackIcon,
  MoonIcon,
  SunIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import { useTheme } from '../hooks/useTheme'

const navigation = [
  { name: 'Queue', to: '/', icon: InboxStackIcon, end: true },
  { name: 'Model', to: '/model', icon: ChartBarSquareIcon, end: false },
]

function Brand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-md bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
        s
      </span>
      <span className="text-sm font-semibold text-zinc-950 dark:text-white">
        savedesk
      </span>
    </div>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {navigation.map((item) => (
        <li key={item.name}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group flex gap-x-3 rounded-md p-2 text-sm font-medium',
                isActive
                  ? 'bg-zinc-100 text-zinc-950 dark:bg-white/10 dark:text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  aria-hidden="true"
                  className={clsx(
                    'size-5 shrink-0',
                    isActive
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white',
                  )}
                />
                {item.name}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const Icon = theme === 'dark' ? SunIcon : MoonIcon

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
    >
      <Icon aria-hidden="true" className="size-5 shrink-0 text-zinc-400" />
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-zinc-950/5 bg-white px-6 dark:border-white/10 dark:bg-zinc-900">
      <Brand />
      <nav className="flex flex-1 flex-col">
        <NavItems onNavigate={onNavigate} />
        <div className="mt-auto border-t border-zinc-950/5 py-4 dark:border-white/10">
          <ThemeToggle />
        </div>
      </nav>
    </div>
  )
}

/**
 * Sidebar layout with a mobile drawer.
 *
 * The drawer is written against the Headless UI v2 API (Dialog + DialogBackdrop
 * + DialogPanel) rather than the v1 pattern in the Tailwind Plus snippet, since
 * Catalyst requires v2.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Dialog
        open={sidebarOpen}
        onClose={setSidebarOpen}
        className="relative z-50 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-zinc-900/50 transition-opacity duration-300 data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transition duration-300 data-[closed]:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute top-0 left-full flex w-16 justify-center pt-5 duration-300 data-[closed]:opacity-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="-m-2.5 p-2.5"
                >
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon aria-hidden="true" className="size-6 text-white" />
                </button>
              </div>
            </TransitionChild>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-60 lg:flex-col">
        <SidebarContent />
      </div>

      <div className="sticky top-0 z-40 flex items-center gap-x-4 border-b border-zinc-950/5 bg-white px-4 py-3 sm:px-6 lg:hidden dark:border-white/10 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-m-2.5 p-2.5 text-zinc-700 dark:text-zinc-400"
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon aria-hidden="true" className="size-6" />
        </button>
        <span className="text-sm font-semibold text-zinc-950 dark:text-white">
          savedesk
        </span>
      </div>

      <main className="lg:pl-60">
        <div className="px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
