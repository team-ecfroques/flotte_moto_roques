"""Serveur local sans cache, limité aux fichiers publics du site."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

PUBLIC = Path(__file__).resolve().parent.parent / "public"
LEGACY_ROUTES = {
    "/styles.css": "/assets/css/styles.css",
    **{f"/js/{name}.js": f"/assets/js/{name}.js" for name in (
        "app", "model", "firebase-config", "store", "fault-picker", "cloud-session"
    )},
}


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # Un ancien HTML peut encore référencer les chemins avant réorganisation.
        url = urlsplit(self.path)
        if url.path in LEGACY_ROUTES:
            self.send_response(307)
            self.send_header("Location", urlunsplit(("", "", LEGACY_ROUTES[url.path], url.query, "")))
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    handler = partial(DevHandler, directory=str(PUBLIC))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        host, port = server.server_address
        print(f"Site local : http://{host}:{port} (cache désactivé)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
