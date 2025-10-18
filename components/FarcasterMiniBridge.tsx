'use client'
import Link from 'next/link'
import { openInMini } from '@/lib/miniapp'

export default function MiniLink({ href = '#', children, className = '', ...rest }) {
  const onClick = async (e) => {
    // Only intercept left-clicks without modifier keys
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    await openInMini(href)
  }
  return (
    <Link href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </Link>
  )
}
