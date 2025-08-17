"use client";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-gray-600">
        <div>© {year} • Built by <span className="font-medium">Nafees Aslam</span></div>
        <div className="flex items-center gap-4">
          <a
            href="https://www.linkedin.com/in/nafis-aslam"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900"
            aria-label="LinkedIn Profile"
          >
            LinkedIn
          </a>
          <a
            href="https://github.com/nafees-aslam"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900"
            aria-label="GitHub Profile"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
