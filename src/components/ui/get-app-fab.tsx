"use client";

import Link from 'next/link';
import React from 'react';

export function GetAppFab() {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
      <Link href="/install-app" className="inline-flex items-center gap-3 bg-primary text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium active:scale-95 transition">
        <span>📱</span>
        <span>Get Finva</span>
      </Link>
    </div>
  );
}

export default GetAppFab;
