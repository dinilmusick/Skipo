#!/usr/bin/env python3
"""Generate canonical frontend graph-interface scaffolding from a functional graph manifest."""

from pathlib import Path
import argparse
import json
import re


def _safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", " ", value).strip()
    return "".join(part[:1].upper() + part[1:] for part in value.split()) or "Graph"


def _graph_ids(graph: dict, key: str) -> list[str]:
    values = graph.get(key, [])
    if not isinstance(values, list) or any(
        not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]
        for item in values
    ):
        raise ValueError(f"Functional graph {key} must be a list of objects with nonempty ids.")
    return [item["id"] for item in values]


def generate(manifest_path: Path, root: Path, tab: str, interface: str) -> list[Path]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("graph"), dict):
        raise ValueError("Functional graph manifest must contain a graph object.")

    graph = manifest["graph"]
    connection_types = _graph_ids(graph, "connectionTypes")
    nodes = _graph_ids(graph, "nodes")
    name = _safe_name(interface)
    tab_name = _safe_name(tab)
    if name != interface or tab_name != tab:
        raise ValueError("tab and interface must use canonical PascalCase names.")

    root = root.resolve()
    target = (root / "src/frontend/pages/main/tabs" / tab / interface).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise ValueError("Graph asset destination escapes the application root.") from exc

    interface_file = target / f"{interface}.tsx"
    tab_file = target.parent / f"{tab}.tsx"
    metadata = target / "graph-assets.manifest.json"

    interface_source = (
        "import type { GraphEdge, GraphNode, NodeDefinition } from '@ultrst-armada/kloks/state-graph';\n"
        "import { FrnlEditableNodeGraph } from '@ultrst-armada/floks/canvas-ui';\n\n"
        f"export interface {interface}Props {{\n"
        "  nodes: GraphNode[];\n"
        "  edges: GraphEdge[];\n"
        "  availableNodeTypes?: NodeDefinition[];\n"
        "}\n\n"
        f"export function {interface}({{ nodes, edges, availableNodeTypes }}: {interface}Props) {{\n"
        "  return <FrnlEditableNodeGraph nodes={nodes} edges={edges} availableNodeTypes={availableNodeTypes} />;\n"
        f"}}\n"
    )
    tab_source = (
        f"import {{ {interface} }} from './{interface}/{interface}';\n\n"
        f"export function {tab}() {{\n"
        f"  return <{interface} />;\n"
        f"}}\n"
    )
    manifest_source = json.dumps(
        {
            "source": str(manifest_path.as_posix()),
            "graphId": graph.get("id"),
            "graphName": graph.get("name"),
            "connectionTypes": connection_types,
            "nodes": nodes,
            "generatedBy": "skipo.generate_graph_assets",
        },
        indent=2,
    ) + "\n"

    desired = {interface_file: interface_source, metadata: manifest_source}
    if not tab_file.exists() and not tab_file.is_symlink():
        desired[tab_file] = tab_source

    # Validate all target files before any creation or modification. Generated
    # interfaces may be replayed verbatim; custom edits belong to the app and
    # cannot be overwritten by a framework upgrade.
    snapshots: dict[Path, str | None] = {}
    for file in (interface_file, tab_file, metadata):
        # A symlinked leaf could otherwise rewrite an unrelated application
        # file or escape the project even when the parent directory is safe.
        if file.is_symlink():
            raise ValueError(f"Refusing to overwrite a symlinked graph asset: {file}")
        if file.exists():
            if not file.is_file():
                raise ValueError(f"Graph asset target is not a regular file: {file}")
            snapshots[file] = file.read_text(encoding="utf-8")
        else:
            snapshots[file] = None

    existing_interface = snapshots[interface_file]
    if existing_interface is not None and existing_interface != interface_source:
        raise ValueError("Refusing to overwrite a modified graph interface.")
    existing_metadata = snapshots[metadata]
    if existing_metadata is not None and existing_metadata != manifest_source:
        try:
            prior = json.loads(existing_metadata)
        except (TypeError, ValueError) as exc:
            raise ValueError("Refusing to overwrite malformed graph asset metadata.") from exc
        if not isinstance(prior, dict) or prior.get("generatedBy") != "skipo.generate_graph_assets":
            raise ValueError("Refusing to overwrite non-generated graph asset metadata.")

    created_directories: list[Path] = []
    ancestor = target
    while ancestor != root and not ancestor.exists():
        created_directories.append(ancestor)
        ancestor = ancestor.parent

    pending = [(file, content) for file, content in desired.items() if snapshots[file] != content]
    if pending:
        target.mkdir(parents=True, exist_ok=True)
    attempted: list[Path] = []
    try:
        for file, content in pending:
            attempted.append(file)
            file.write_text(content, encoding="utf-8")
    except OSError as exc:
        rollback_errors = []
        for file in reversed(attempted):
            try:
                previous = snapshots[file]
                if previous is None:
                    file.unlink(missing_ok=True)
                else:
                    file.write_text(previous, encoding="utf-8")
            except OSError as restore_exc:
                rollback_errors.append(str(restore_exc))
        for directory in created_directories:
            try:
                directory.rmdir()
            except OSError:
                pass
        if rollback_errors:
            raise OSError(f"Graph generation failed: {exc}; rollback incomplete: {rollback_errors}") from exc
        raise OSError(f"Graph generation failed and was rolled back: {exc}") from exc

    return [interface_file, tab_file, metadata]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Skipo frontend graph interface from a functional graph manifest.")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("root", type=Path)
    parser.add_argument("--tab", required=True)
    parser.add_argument("--interface", required=True)
    args = parser.parse_args()
    for path in generate(args.manifest.resolve(), args.root.resolve(), args.tab, args.interface):
        print(path)


if __name__ == "__main__":
    main()
