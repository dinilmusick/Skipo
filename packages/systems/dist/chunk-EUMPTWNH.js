// src/editor/themes.ts
var skipoDarkTheme = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "d4af37" },
    // Gold
    { token: "string", foreground: "98c379" },
    // Olive
    { token: "number", foreground: "d19a66" },
    // Orange
    { token: "comment", foreground: "5c6370", fontStyle: "italic" },
    { token: "type", foreground: "56b6c2" }
    // Cyan
  ],
  colors: {
    "editor.background": "#16161e",
    "editor.foreground": "#a9b1d6",
    "editorLineNumber.foreground": "#363b54",
    "editor.selectionBackground": "#28324a",
    "editor.lineHighlightBackground": "#1c1c26",
    "editorCursor.foreground": "#d4af37",
    "editorIndentGuide.background": "#222222"
  }
};

// src/editor/useMonaco.ts
import { useEffect, useState } from "react";
function useMonaco() {
  const [monaco, setMonaco] = useState(null);
  useEffect(() => {
    let isMounted = true;
    import("monaco-editor").then((monacoModule) => {
      if (!isMounted) return;
      monacoModule.editor.defineTheme("skipo-dark", skipoDarkTheme);
      setMonaco(monacoModule);
    }).catch((err) => {
      console.warn("Failed to load monaco-editor", err);
    });
    return () => {
      isMounted = false;
    };
  }, []);
  return monaco;
}

// src/editor/MonacoEditor.tsx
import { useEffect as useEffect2, useRef } from "react";
import { jsx } from "react/jsx-runtime";
function MonacoEditor({
  value,
  language = "javascript",
  readOnly = false,
  minimap = false,
  theme = "skipo-dark",
  fontSize = 14,
  onChange,
  height = "100%",
  width = "100%"
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const monaco = useMonaco();
  useEffect2(() => {
    if (!monaco || !containerRef.current) return;
    if (!editorRef.current) {
      editorRef.current = monaco.editor.create(containerRef.current, {
        value,
        language,
        theme,
        readOnly,
        fontSize,
        minimap: { enabled: minimap },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 }
      });
      if (onChange) {
        editorRef.current.onDidChangeModelContent(() => {
          onChange(editorRef.current.getValue());
        });
      }
    }
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [monaco]);
  useEffect2(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);
  useEffect2(() => {
    if (editorRef.current) {
      monaco?.editor.setModelLanguage(editorRef.current.getModel(), language);
      editorRef.current.updateOptions({ readOnly, fontSize, minimap: { enabled: minimap } });
      if (theme) monaco?.editor.setTheme(theme);
    }
  }, [language, readOnly, fontSize, minimap, theme, monaco]);
  return /* @__PURE__ */ jsx("div", { ref: containerRef, style: { width, height, overflow: "hidden", borderRadius: "8px" } });
}

export {
  skipoDarkTheme,
  useMonaco,
  MonacoEditor
};
