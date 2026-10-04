import type { Page } from "@playwright/test";

export const library = Array.from({ length: 1200 }, (_, i) => ({
  id: i + 1, title: (i + 1) % 10 === 0 ? `Fox ${i + 1}` : `Photo ${i + 1}`,
  description: "Mocked larger-library photograph",
  imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='50'%3E%3Crect width='40' height='50' fill='%23324455'/%3E%3C/svg%3E",
  photographerId: i % 5 + 1, photographerName: `Photographer ${i % 5 + 1}`,
  clubId: i % 3 + 1, clubName: `Club ${i % 3 + 1}`,
  themeId: i % 4 + 1, themeName: `Theme ${i % 4 + 1}`,
  likeCount: i % 17, commentCount: i % 7, sortOrder: i,
  createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
}));

export async function mockGalleryLibrary(page: Page) {
  const requests: { path: string; bytes: number }[] = [];
  let failInitial = false;
  let failNext = false;
  let overlap = false;
  let failPhoto = false;
  let failFilters = false;
  await page.addInitScript(() => localStorage.setItem("photoclub.lang", "en"));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "text/javascript",
    body: `
      export const ClerkProvider = ({children}) => children;
      export const SignIn = () => null;
      export const SignUp = () => null;
      export const UserButton = () => null;
      export const useUser = () => ({isLoaded:true,isSignedIn:false,user:null});
      export const useAuth = () => ({isLoaded:true,isSignedIn:false,userId:null});
      export const useClerk = () => ({signOut:async()=>{},addListener:()=>()=>{}});
      export const Show = ({when,children,fallback}) => when === "signed-in" ? fallback ?? null : children;
      export const SignInButton = ({children}) => children;
      export const SignUpButton = ({children}) => children;
    `,
  }));
  await page.route("**/src/lib/clerk-config.ts*", route => route.fulfill({
    contentType: "text/javascript", body: `export const publishableKeyFromHost = () => "pk_test_fixture";`,
  }));
  await page.route("**/src/App.tsx*", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.__refreshGallery = () => queryClient.invalidateQueries({predicate: q => String(q.queryKey[0]).startsWith("/api/photos/gallery")});
    ` });
  });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const q = url.searchParams;
    let body: unknown = [];
    let status = 200;
    if (url.pathname === "/api/photos/gallery") {
      const offset = Number(q.get("cursor") ?? 0);
      if ((!offset && failInitial) || (offset && failNext)) {
        status = 503;
        body = { error: "Mocked temporary failure" };
      } else {
        const ids = (name: string) => q.get(name)?.split(",").map(Number) ?? [];
        const rows = library.filter(p =>
          (!q.get("search") || p.title.toLowerCase().includes(q.get("search")!.toLowerCase())) &&
          (!ids("clubIds").length || ids("clubIds").includes(p.clubId)) &&
          (!ids("themeIds").length || ids("themeIds").includes(p.themeId)) &&
          (!q.get("photographerId") || p.photographerId === Number(q.get("photographerId"))) &&
          (!q.get("from") || p.createdAt.slice(0, 10) >= q.get("from")!) &&
          (!q.get("to") || p.createdAt.slice(0, 10) <= q.get("to")!)
        );
        const group = q.get("group");
        const sort = q.get("sort");
        rows.sort((a, b) => {
          const groupOrder = group === "club" ? a.clubId - b.clubId : group === "theme" ? a.themeId - b.themeId :
            group === "photographer" ? a.photographerId - b.photographerId : 0;
          if (groupOrder) return groupOrder;
          if (sort === "oldest") return a.id - b.id;
          if (sort === "photographer") return a.photographerId - b.photographerId || a.sortOrder - b.sortOrder;
          if (sort === "likes") return b.likeCount - a.likeCount || b.id - a.id;
          if (sort === "comments") return b.commentCount - a.commentCount || b.id - a.id;
          if (sort === "random") {
            const rank = (id: number) => ((id * 2654435761) ^ Number(q.get("seed"))) >>> 0;
            return rank(a.id) - rank(b.id);
          }
          return b.id - a.id;
        });
        const limit = Number(q.get("limit") ?? 24);
        const start = overlap && offset ? offset - 1 : offset;
        body = { items: rows.slice(start, offset + limit), total: rows.length,
          hasMore: offset + limit < rows.length, nextCursor: offset + limit < rows.length ? String(offset + limit) : null };
      }
    } else if (url.pathname === "/api/photos") body = library;
    else if (/^\/api\/photos\/\d+$/.test(url.pathname)) {
      const photo = library.find(p => p.id === Number(url.pathname.split("/").at(-1)));
      status = failPhoto ? 503 : photo ? 200 : 404;
      body = status === 200 ? photo : { error: "Mocked photo failure" };
    } else if (url.pathname === "/api/clubs") body = [1, 2, 3].map(id => ({ id, name: `Club ${id}` }));
    else if (url.pathname === "/api/themes") body = [1, 2, 3, 4].map(id => ({ id, name: `Theme ${id}` }));
    else if (url.pathname === "/api/photographers") body = [1, 2, 3, 4, 5].map(id => ({ id, name: `Photographer ${id}` }));
    else if (url.pathname === "/api/admins/me") body = { isAdmin: false, totalAdmins: 0 };
    if (failFilters && ["/api/clubs", "/api/themes", "/api/photographers"].includes(url.pathname)) {
      status = 503;
      body = { error: "Mocked filter failure" };
    }
    const json = JSON.stringify(body);
    requests.push({ path: url.pathname + url.search, bytes: Buffer.byteLength(json) });
    await route.fulfill({ status, contentType: "application/json", body: json });
  });
  return {
    requests,
    initialFailure: (value: boolean) => { failInitial = value; },
    nextFailure: (value: boolean) => { failNext = value; },
    overlappingPages: () => { overlap = true; },
    photoFailure: (value: boolean) => { failPhoto = value; },
    filterFailure: (value: boolean) => { failFilters = value; },
  };
}