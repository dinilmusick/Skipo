import * as react from 'react';

interface EditorConfig {
    value: string;
    language?: string;
    readOnly?: boolean;
    minimap?: boolean;
    theme?: string;
    fontSize?: number;
}

declare const skipoDarkTheme: {
    base: "vs-dark";
    inherit: boolean;
    rules: ({
        token: string;
        foreground: string;
        fontStyle?: undefined;
    } | {
        token: string;
        foreground: string;
        fontStyle: string;
    })[];
    colors: {
        'editor.background': string;
        'editor.foreground': string;
        'editorLineNumber.foreground': string;
        'editor.selectionBackground': string;
        'editor.lineHighlightBackground': string;
        'editorCursor.foreground': string;
        'editorIndentGuide.background': string;
    };
};

declare function useMonaco(): any;

interface MonacoEditorProps extends EditorConfig {
    onChange?: (value: string) => void;
    height?: string | number;
    width?: string | number;
}
declare function MonacoEditor({ value, language, readOnly, minimap, theme, fontSize, onChange, height, width }: MonacoEditorProps): react.JSX.Element;

export { type EditorConfig, MonacoEditor, skipoDarkTheme, useMonaco };
