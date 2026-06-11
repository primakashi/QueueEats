"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, []);
  return null;
}
