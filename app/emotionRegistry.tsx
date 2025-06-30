'use client';

import React, { useState } from 'react';
import { CacheProvider } from '@emotion/react';
import createEmotionCache from './emotionCache';

export default function EmotionRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cache] = useState(() => createEmotionCache());
  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
