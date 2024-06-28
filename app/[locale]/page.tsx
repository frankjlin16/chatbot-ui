"use client"

import { useTheme } from "next-themes"
import { redirect } from "next/navigation"

export default function HomePage() {
  const { theme } = useTheme()

  return redirect("/login")
}
