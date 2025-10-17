// components/MiniLink.tsx
'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { openInMini, fcPreferMini } from '@/lib/miniapp';

export default function MiniLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const onClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    const target = fcPreferMini(href); // prefer MINIAPP_URL inside Warpcast
    const handled = await openInMini(target);
    if (!handled) {
      // web fallback
      if (target.startsWith('http')) window.open(target, '_self');
      else window.location.href = target;
    }
  }, [href]);

  // Render a normal <Link/> so SSR & SEO still see a real anchor
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
