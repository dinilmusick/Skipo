# Live UI inspection

Open the authorized app tab with `?inspectUi=1` and choose **Start UI inspection**.
Use the displayed endpoint with the app's existing Luth authorization. The
snapshot only contains registered component presentation and layout plus the
explicitly projected tile choices. The app renders and runs actions in its own
tab. The HTTP handler uses the app's existing Fetch entry point and system
database connection.

- `GET <endpoint>` returns the snapshot, revision, and last command status.
- `POST <endpoint>/action` queues a command using `revision`, `componentId`,
  `controlId`, and optional `payload`. For example, select a tile using its
  advertised ID as the payload. Read the endpoint again to observe completion.
- Stop the session in the tab to clear it. If the tab disappears, its snapshot
  expires after 20 seconds.

The tab must stay open in order to produce live evidence and execute actions.
