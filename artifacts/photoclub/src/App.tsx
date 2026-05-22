import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

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
import MyPhotos from "@/pages/my-photos";
import ThemeDetail from "@/pages/theme-detail";
import Search from "@/pages/search";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#e63e2e",
    colorForeground: "#e8e3dc",
    colorMutedForeground: "#8a8480",
    colorDanger: "#e63e2e",
    colorBackground: "#111110",
    colorInput: "#1c1c1b",
    colorInputForeground: "#e8e3dc",
    colorNeutral: "#2e2d2c",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.375rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111110] border border-[#2e2d2c] rounded-xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#e8e3dc] font-serif",
    headerSubtitle: "text-[#8a8480]",
    socialButtonsBlockButtonText: "text-[#e8e3dc]",
    formFieldLabel: "text-[#8a8480]",
    footerActionLink: "text-[#e63e2e] hover:text-[#e63e2e]/80",
    footerActionText: "text-[#8a8480]",
    dividerText: "text-[#8a8480]",
    identityPreviewEditButton: "text-[#e63e2e]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#e8e3dc]",
    logoBox: "mb-2",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border-[#2e2d2c] bg-[#1c1c1b] hover:bg-[#2e2d2c] text-[#e8e3dc]",
    formButtonPrimary: "bg-[#e63e2e] hover:bg-[#c93525] text-white",
    formFieldInput: "bg-[#1c1c1b] border-[#2e2d2c] text-[#e8e3dc]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#2e2d2c]",
    alert: "border-[#2e2d2c] bg-[#1c1c1b]",
    otpCodeFieldInput: "bg-[#1c1c1b] border-[#2e2d2c] text-[#e8e3dc]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

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
        <Route path="/themes/:id" component={ThemeDetail} />
        <Route path="/photographers" component={Photographers} />
        <Route path="/photographers/:id" component={PhotographerDetail} />
        <Route path="/search" component={Search} />
        <Route path="/upload" component={Upload} />
        <Route path="/manage" component={Manage} />
        <Route path="/my-photos" component={MyPhotos} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your PhotoClub account" } },
        signUp: { start: { title: "Join PhotoClub", subtitle: "Create your photographer account" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
