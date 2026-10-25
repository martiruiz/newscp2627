# Local dev server for the SCP site: like `python3 -m http.server`, but tells the browser never to reuse a stale copy.
import functools, http.server, sys
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()
port, root = int(sys.argv[1]), sys.argv[2]
http.server.ThreadingHTTPServer(("", port), functools.partial(NoCache, directory=root)).serve_forever()
