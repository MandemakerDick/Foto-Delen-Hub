import { useEffect, useRef } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";

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
import LikedPhotos from "@/pages/liked-photos";
import Following from "@/pages/following";
import ThemeDetail from "@/pages/theme-detail";
import Search from "@/pages/search";
import NotFound from "@/pages/not-found";
import Join from "@/pages/join";
import AdminLogin from "@/pages/admin-login";

// TanStack Query client — 5-minute stale time, single retry on failure.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

// Resolve the Clerk publishable key — publishableKeyFromHost checks the domain
// first (for Replit's managed Clerk tenant) then falls back to the env var.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// Replit proxies Clerk requests through /api/__clerk so auth works on the
// shared *.replit.dev domain without a custom domain.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

// BASE_URL is set by Vite to the artifact's preview path (e.g. "/photoclub").
// Trailing slash is stripped so it can be safely prepended to route strings.
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Strip the basePath prefix from a URL returned by Clerk's router callbacks.
 * Clerk includes the full path (with prefix) in push/replace calls; wouter
 * only understands paths relative to its own base.
 */
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// Match the app's dark theme inside Clerk's modal / embedded components.
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
    cardBox: "bg-[#111110] border border-[#2e2d2c] rounded-xl w-[min(440px,calc(100vw-1.5rem))] max-w-full overflow-hidden",
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
    modalBackdrop: "p-3 sm:p-6",
    modalContent: "w-[calc(100vw-1.5rem)] max-w-[440px] max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto",
    modalCloseButton: "m-1",
    userButtonPopoverCard: "bg-[#111110] border border-[#2e2d2c] rounded-lg shadow-xl",
    userButtonPopoverMain: "bg-[#111110]",
    userButtonPopoverActionButton: "!text-[#e8e3dc] hover:bg-[#2e2d2c]",
    userButtonPopoverActionButtonText: "!text-[#e8e3dc]",
    userButtonPopoverActionButtonIcon: "!text-[#8a8480]",
    userButtonPopoverFooter: "border-t border-[#2e2d2c]",
    userPreviewMainIdentifier: "!text-[#e8e3dc]",
    userPreviewSecondaryIdentifier: "!text-[#8a8480]",
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

/**
 * Clears the TanStack Query cache whenever the signed-in Clerk user changes
 * (sign-in or sign-out). This ensures no stale per-user data (e.g. "My Photos")
 * leaks between accounts without needing to manually invalidate every query.
 *
 * Renders nothing — pure side-effect component.
 */
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
        <Route path="/manage">
          <ErrorBoundary>
            <Manage />
          </ErrorBoundary>
        </Route>
        <Route path="/my-photos" component={MyPhotos} />
        <Route path="/liked-photos" component={LikedPhotos} />
        <Route path="/following" component={Following} />
        <Route path="/join/:token?" component={Join} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

/**
 * Wraps the app with ClerkProvider and QueryClientProvider.
 *
 * ClerkProvider needs access to wouter's setLocation so it can drive
 * Clerk's internal routing (sign-in redirects, etc.) through the same
 * router the rest of the app uses.
 */
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      afterSignOutUrl={basePath + "/"}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your PhotoMatrix account" } },
        signUp: { start: { title: "Join PhotoMatrix", subtitle: "Create your photographer account" } },
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
  useEffect(() => {
    const block = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === "IMG") e.preventDefault();
    };
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  return (
    <HelmetProvider>
      {/* WouterRouter is initialised with the basePath so all <Route> paths are
          relative to the artifact's preview path, not the document root. */}
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </HelmetProvider>
  );
}

export default App;
