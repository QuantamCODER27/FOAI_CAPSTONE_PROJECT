import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/site-header";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Signal lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That route is not in the verification network.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NewsVerdict — AI-powered fake news detection" },
      {
        name: "description",
        content:
          "Verify news headlines and articles with multi-model AI analysis, real-world evidence retrieval, and transparent confidence scoring.",
      },
      { property: "og:title", content: "NewsVerdict — AI-powered fake news detection" },
      {
        property: "og:description",
        content: "Multi-model AI verification with real-world evidence and explainable confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "NewsVerdict — AI-powered fake news detection" },
      { name: "description", content: "NewsVerdict is an AI-powered fake news detection and verification platform." },
      { property: "og:description", content: "NewsVerdict is an AI-powered fake news detection and verification platform." },
      { name: "twitter:description", content: "NewsVerdict is an AI-powered fake news detection and verification platform." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e307bd20-aa54-4966-b01a-3dc95faeab41/id-preview-79927524--7fb2f9de-0a6b-489e-885a-3debd77df095.lovable.app-1776831306102.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e307bd20-aa54-4966-b01a-3dc95faeab41/id-preview-79927524--7fb2f9de-0a6b-489e-885a-3debd77df095.lovable.app-1776831306102.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Outlet />
    </div>
  );
}
