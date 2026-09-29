import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useImagePreloader } from "@/hooks/useImagePreloader";
import LevelUpOverlay from "@/components/features/LevelUpOverlay";
import { useLang } from "@/hooks/useLang";

const queryClient = new QueryClient();

// Toasts render outside the per-screen dir wrappers, so mirror them for Arabic here
function LangToaster() {
  const { lang } = useLang();
  return <Sonner position="top-center" className={lang === 'ar' ? 'toaster group toaster-rtl' : 'toaster group'} />;
}

function AppInner() {
  useImagePreloader();
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <LevelUpOverlay />
      <Routes>
        <Route path="/" element={<Index />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <LangToaster />
      <AppInner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
