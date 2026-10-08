# Keep one modular application with web and worker processes

Accepted October 3, 2026. Sprout uses a modular TypeScript application with a Next.js web entry point and a separately runnable Node worker, sharing domain contracts and migrations. Explicit write ownership, enforced import boundaries, versioned job contracts and coordinated migrations support parallel development and later features without introducing independent services before there is an operational reason. Initial deployment remains on Windows; domain modules do not depend on that hosting location.
