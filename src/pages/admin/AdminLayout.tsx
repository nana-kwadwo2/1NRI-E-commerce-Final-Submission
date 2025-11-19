import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function AdminLayout() {
  return (
    <AdminGuard>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          
          <div className="flex-1 flex flex-col">
            {/* Admin Header */}
            <header className="h-14 border-b flex items-center px-4 gap-4 bg-background sticky top-0 z-10">
              <SidebarTrigger />
              <div className="flex-1">
                <h1 className="text-lg font-semibold">1nri Admin</h1>
              </div>
              <Link to="/">
                <Button variant="outline" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Store
                </Button>
              </Link>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 bg-muted/30">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminGuard>
  );
}
