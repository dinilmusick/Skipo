import React__default from 'react';

interface SkipoThemeMetadata {
    id: string;
    name: string;
    version: string;
    mode: 'dark' | 'light';
    author?: string;
    description?: string;
}
interface SkipoSemanticTokens {
    bg: {
        canvas: string;
        surface: string;
        surfaceHover: string;
        blur: string;
    };
    text: {
        primary: string;
        muted: string;
        inverse: string;
    };
    accent: {
        primary: string;
        fg: string;
        glow: string;
        hover?: string;
    };
    border: {
        color: string;
        input: string;
        style: string;
    };
    radius: {
        base: string;
        sm: string;
        lg?: string;
    };
    shadow: {
        card: string;
        cardHover: string;
        btn: string;
        btnHover: string;
        btnActive: string;
    };
    font: {
        sans: string;
        mono: string;
    };
    status: {
        success: string;
        successFg: string;
        warning: string;
        warningFg: string;
        danger: string;
        dangerFg: string;
        info: string;
        infoFg: string;
    };
    shell: {
        topToolbarHeight: string;
        topToolbarBg: string;
        bottomStripHeight: string;
        bottomStripBg: string;
        inspectionTextTranslucent: string;
    };
}
interface SkipoThemePack {
    metadata: SkipoThemeMetadata;
    tokens: SkipoSemanticTokens;
    customCss?: string;
}

declare const DEFAULT_DARK_THEME_PACK: SkipoThemePack;
declare const DEFAULT_LIGHT_THEME_PACK: SkipoThemePack;

declare function tokensToCssVariables(tokens: SkipoSemanticTokens): Record<string, string>;
declare function applyThemePack(themePack: SkipoThemePack, target?: HTMLElement): void;
declare function validateThemePack(raw: unknown): {
    valid: boolean;
    errors: string[];
};

type SkipoThemeMode = 'dark' | 'light';
interface SkipoThemeContextValue {
    theme: SkipoThemeMode;
    themePack: SkipoThemePack;
    setTheme: (theme: SkipoThemeMode) => void;
    setThemePack: (pack: SkipoThemePack) => void;
    toggleTheme: () => void;
}
interface SkipoThemeProviderProps {
    children: React__default.ReactNode;
    defaultTheme?: SkipoThemeMode;
    initialThemePack?: SkipoThemePack;
}
declare function SkipoThemeProvider({ children, defaultTheme, initialThemePack }: SkipoThemeProviderProps): React__default.JSX.Element;
declare function useSkipoTheme(): SkipoThemeContextValue;

declare const palettes: {
    dark: {
        bg: string;
        text: string;
    };
    light: {
        bg: string;
        text: string;
    };
};

export { DEFAULT_DARK_THEME_PACK, DEFAULT_LIGHT_THEME_PACK, type SkipoSemanticTokens, type SkipoThemeMetadata, type SkipoThemePack, SkipoThemeProvider, type SkipoThemeProviderProps, applyThemePack, palettes, tokensToCssVariables, useSkipoTheme, validateThemePack };
