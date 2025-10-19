// components/FarcasterMiniBridge.tsx
'use client'
import Link from 'next/link'
import { openInMini } from '@/lib/miniapp'
import * as React from 'react';

type Props = {
  href?: string;
  children?: React.ReactNode;
  className?: string;
  [x: string]: any;
};

export default function FarcasterMiniBridge({ href = '#', children, className = '', ...rest }: Props) {
  const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    await openInMini(href);
  };
  return (
    <Link href={href} onClick={onClick} className={className} {...rest}>
      {children ?? href}
    </Link>
  );
}
