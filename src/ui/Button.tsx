import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'tf-btn-primary',
  secondary: 'tf-btn-secondary',
  ghost: 'tf-btn-ghost',
  danger: 'tf-btn-danger',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'tf-btn-sm',
  md: '',
  lg: 'tf-btn-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`tf-btn ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
