import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Gallery from "@/pages/gallery";
import PhotoDetail from "@/pages/photo-detail";
import Clubs from "@/pages/clubs";
import ClubDetail from "@/pages/club-detail";
import Themes from "@/pages/themes";
import Photographers from "@/pages/photographers";
import PhotographerDetail from "@/pages/photographer-detail";
import Upload from "@/pages/upload";
import Manage from "@/pages/manage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/photos" component={Gallery} />
        <Route path="/photos/:id" component={PhotoDetail} />
        <Route path="/clubs" component={Clubs} />
        <Route path="/clubs/:id" component={ClubDetail} />
        <Route path="/themes" component={Themes} />
        <Route path="/photographers" component={Photographers} />
        <Route path="/photographers/:id" component={PhotographerDetail} />
        <Route path="/upload" component={Upload} />
        <Route path="/manage" component={Manage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
