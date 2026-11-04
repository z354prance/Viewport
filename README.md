# Viewport

Viewport is a simple, self-hosted interactive website previewer for testing websites in Desktop, Tablet, and Mobile layouts.

It uses Playwright and Chromium to render websites on the server and streams the rendered browser to the Viewport web interface. This allows Viewport to display sites that cannot normally be embedded in an iframe because of X-Frame-Options or Content-Security-Policy restrictions.

## Features

- Desktop preview
- Tablet preview
- Mobile preview
- Portrait and landscape rotation
- Interactive clicking, scrolling, keyboard input, and navigation
- Independent browser session for each Viewport tab
- Automatic cleanup of abandoned sessions
- WebSocket-based browser streaming
- Docker deployment
- Reverse-proxy friendly
- No VNC or desktop environment required

## Device Profiles

Viewport provides a fixed desktop size plus selectable Playwright device
profiles for tablet and mobile testing:

- Desktop — Chromium at 1440x900
- Tablet — iPad Pro 11 (default), iPad (gen 11), iPad Mini, Galaxy Tab S9,
  Galaxy Tab S4, Nexus 7, Nexus 10, and Kindle Fire HDX
- Mobile — Galaxy S24 (default), Galaxy A55, Pixel 7, iPhone 15,
  iPhone 15 Pro, iPhone 15 Pro Max, and iPhone SE (3rd gen)

Tablet and Mobile modes support portrait and landscape orientations. Device
selection is isolated per Viewport browser session, just like navigation and
the streamed Playwright page.

## Docker

Viewport listens on port 3000.

Example:

    docker run -d \
      --name Viewport \
      --restart unless-stopped \
      --shm-size=1g \
      -p 3000:3000 \
      ghcr.io/z354prance/viewport:latest

Then open `http://YOUR-SERVER-IP:3000`.

## Reverse Proxy

Viewport can be placed behind a reverse proxy. The proxy must support WebSocket connections because Viewport uses the `/ws` endpoint for browser streaming and interactive input.

Authentication at the reverse proxy is strongly recommended when Viewport is exposed to the Internet.

## Security

Viewport launches a real server-side browser that can navigate to URLs supplied through the interface.

Do not expose Viewport directly to the public Internet without authentication and appropriate network protections.

## Unraid

An Unraid XML template is included in the `unraid` directory.

Recommended settings:

- Container port: 3000
- Shared memory: `--shm-size=1g`
- Network: Bridge or a dedicated custom IP

## Building Locally

    docker build -t viewport:latest .

## License

Viewport is released under the MIT License.
