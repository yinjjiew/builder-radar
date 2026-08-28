import Link from "next/link";

const LINKS = [
  { href: "/", label: "Directory" },
  { href: "/posts", label: "Post rank" },
  { href: "/categories", label: "Categories" },
  { href: "/network", label: "Network" },
  { href: "/insights", label: "Insights" }
];

export function SiteNav({ current }: { current: string }) {
  return (
    <nav className="insights-nav" aria-label="Primary navigation">
      <Link href="/" className="wordmark insights-wordmark">
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        Builder Radar
      </Link>
      <div className="nav-links">
        {LINKS.filter((link) => link.href !== "/").map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="nav-link-dark"
            aria-current={link.href === current ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
        {current === "/" ? null : (
          <Link href="/" className="nav-link-dark">
            Directory
          </Link>
        )}
      </div>
    </nav>
  );
}
