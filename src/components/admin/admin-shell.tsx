"use client"

import { FileUp, FlaskConical, Package, Printer, Shapes } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { TdcLogo } from "@/components/tdc-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </SidebarProvider>
  )
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  const closeMobile = () => setOpenMobile(false)

  return (
    <>
      <Sidebar>
        <SidebarHeader className="hidden px-4 py-5 md:block">
          <TdcLogo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/printers")} size="lg">
                    <Link href="/admin/printers" onClick={closeMobile}>
                      <Printer />
                      Printere
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/import")} size="lg">
                    <Link href="/admin/import" onClick={closeMobile}>
                      <FileUp />
                      Deltakere
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/smooth-print")} size="lg">
                    <Link href="/admin/smooth-print" onClick={closeMobile}>
                      <Package />
                      Smooth Print
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/testutskrift")} size="lg">
                    <Link href="/admin/testutskrift" onClick={closeMobile}>
                      <FlaskConical />
                      Testutskrift
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled size="lg" className="opacity-40" title="Ikke laget ennå">
                    <Shapes />
                    P-touch Editor
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center gap-2 border-b border-white/10 p-3 md:hidden">
          <SidebarTrigger />
          <TdcLogo />
        </div>
        {children}
      </SidebarInset>
    </>
  )
}
