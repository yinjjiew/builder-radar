import Link from "next/link";
import { isAdmin } from "@/lib/role";

const LINKS = [
  { href: "/posts", label: "Post rank" },
  { href: "/categories", label: "Categories" },
  { href: "/insights", label: "Insights" }
];

export async function SiteNav({ current }: { current: string }) {
  // Review is a bulk editor with a form on every row, so it is only reachable
  // with the admin credential and only advertised to it.
  const admin = await isAdmin();

  return (
    <nav className="insights-nav" aria-label="Primary navigation">
      <Link href="/" className="wordmark insights-wordmark">
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        Builder Radar
      </Link>
      <div className="nav-links">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="nav-link-dark"
            aria-current={link.href === current ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
        {admin ? (
          <Link
            href="/review"
            className="nav-link-dark"
            aria-current={current === "/review" ? "page" : undefined}
          >
            Review
          </Link>
        ) : null}
        {current === "/" ? null : (
          <Link href="/" className="nav-link-dark">
            Directory
          </Link>
        )}
      </div>
    </nav>
  );
}
