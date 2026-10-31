import tempfile
import unittest
from pathlib import Path

from scripts.scaffold_app_structure import scaffold_structure


class AikoDirectChatScaffoldTests(unittest.TestCase):
    def test_global_chat_is_copied_and_mounted(self):
        root=Path(tempfile.mkdtemp(prefix="skipo-aiko-chat-"))
        try:
            scaffold_structure(root,"ExampleApp")
            app=(root/"src/frontend/App.tsx").read_text()
            chat=(root/"src/frontend/components/aiko/AikoDirectChat.tsx").read_text()
            self.assertIn("AikoDirectChat",app)
            self.assertIn("createAikoRuntime",app)
            self.assertIn("listAgents",chat)
            self.assertIn("executeAgent",chat)
        self.assertIn("skipo-application-agent",(root / "src/frontend/../backend/aikoRuntime.ts").resolve().read_text(encoding="utf-8"))
        finally:
            import shutil
            shutil.rmtree(root,ignore_errors=True)


if __name__=="__main__":
    unittest.main()
