import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { logger } from '../core/logger'
import { Button } from './Button'
import { Modal } from './Modal'

/* --------------------------------- Toasts -------------------------------- */

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  push: (kind: ToastKind, message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TOAST_ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-success" />,
  error: <AlertTriangle size={16} className="text-danger" />,
  info: <Info size={16} className="text-info" />,
}

/* --------------------------------- Confirm -------------------------------- */

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

/** Resolves the user's yes/no answer as a promise. */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside <FeedbackProvider>')
  return confirm
}

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <FeedbackProvider>')
  return toast
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const push = useCallback((kind: ToastKind, message: string) => {
    nextId.current += 1
    const id = nextId.current
    setToasts((current) => [...current.slice(-3), { id, kind, message }])
    logger.info('toast', { kind, id })
    const timer = setTimeout(() => {
      timers.current.delete(id)
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 4200)
    timers.current.set(id, timer)
  }, [])

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => clearTimeout(timer))
      map.clear()
    }
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPendingConfirm({ options, resolve })
      }),
    [],
  )

  const settle = (value: boolean) => {
    pendingConfirm?.resolve(value)
    setPendingConfirm(null)
  }

  /**
   * Referentially stable API: consumers (like App's hydration effect) may key
   * effects on it — an inline `{ push }` object would re-run them on every
   * toast and re-race the persistence layer.
   */
  const toastApi = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="tf-card pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 text-sm shadow-lg"
            >
              <span className="mt-0.5 shrink-0">{TOAST_ICON[toast.kind]}</span>
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
                className="rounded p-0.5 text-faint hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <Modal
          open={pendingConfirm !== null}
          title={pendingConfirm?.options.title ?? ''}
          onClose={() => settle(false)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => settle(false)}>
                {pendingConfirm?.options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={pendingConfirm?.options.destructive ? 'danger' : 'primary'}
                onClick={() => settle(true)}
              >
                {pendingConfirm?.options.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-muted">{pendingConfirm?.options.message}</p>
        </Modal>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
