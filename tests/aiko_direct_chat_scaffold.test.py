import json
import tempfile
import unittest
from pathlib import Path

from scripts.scaffold_app_structure import scaffold_structure


class AikoDirectChatScaffoldTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="skipo_aiko_chat_"))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.root, ignore_errors=True)

    def test_new_scaffold_mounts_global_aiko_direct_chat(self):
        scaffold_structure(self.root, "ExampleApp")
        app = (self.root / "src/frontend/App.tsx").read_text(encoding="utf-8")
        chat = (self.root / "src/frontend/components/aiko/AikoDirectChat.tsx").read_text(encoding="utf-8")
        components = (self.root / "src/frontend/components/components.ts").read_text(encoding="utf-8")
        self.assertIn("AikoDirectChat", app)
        self.assertIn("createAikoRuntime", app)
        self.assertIn("AikoDirectChat", components)
        self.assertIn("resolveMention", chat)
        self.assertIn("listAgents", chat)
        self.assertIn("executeAgent", chat)
        self.assertIn("data-skipo-aiko-direct-chat", chat)

    def test_direct_chat_requires_explicit_agent_mention(self):
        scaffold_structure(self.root, "ExampleApp")
        chat = (self.root / "src/frontend/components/aiko/AikoDirectChat.tsx").read_text(encoding="utf-8")
        self.assertIn("Select an Aiko agent with @AgentName before sending.", chat)
        self.assertIn("match(/^\\s*@([^\\s]+)", chat)


if __name__ == "__main__":
    unittest.main()
