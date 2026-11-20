# Application-owned main tabs

This directory is the canonical extension point for application-specific frontend code.
Each tab lives in its own named directory and exports its UI from `page.tsx`.
Skipo discovers those pages through the managed `tabRegistry.tsx` and renders
them inside Floks AppShell.

The framework owns authentication, workspace selection, main-page navigation,
global settings, and the page shell. Do not fork those components or add
alternate application page roots.

This README intentionally preserves an initially empty `tabs/` directory in
source checkouts, installed npm tarballs, and generated applications.
