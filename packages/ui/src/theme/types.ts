export interface SkipoThemeMetadata {
  id: string;
  name: string;
  version: string;
  mode: 'dark' | 'light';
  author?: string;
  description?: string;
}

export interface SkipoSemanticTokens {
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

export interface SkipoThemePack {
  metadata: SkipoThemeMetadata;
  tokens: SkipoSemanticTokens;
  customCss?: string;
}
