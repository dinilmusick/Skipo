import { z } from 'zod';
import React__default from 'react';

declare const HeadingLevelSchema: z.ZodObject<{
    font: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodString>;
    fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    lineHeight: z.ZodOptional<z.ZodString>;
    letterSpacing: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    borderBottom: z.ZodOptional<z.ZodString>;
    textTransform: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const ParagraphStyleSchema: z.ZodObject<{
    font: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodString>;
    fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    lineHeight: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    textAlign: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const BlockquoteStyleSchema: z.ZodObject<{
    font: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodString>;
    fontStyle: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    bg: z.ZodOptional<z.ZodString>;
    borderLeftColor: z.ZodOptional<z.ZodString>;
    borderLeftWidth: z.ZodOptional<z.ZodString>;
    calloutTitle: z.ZodOptional<z.ZodString>;
    calloutColor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const ListStyleSchema: z.ZodObject<{
    font: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodString>;
    lineHeight: z.ZodOptional<z.ZodString>;
    markerColor: z.ZodOptional<z.ZodString>;
    spacing: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const CodeStyleSchema: z.ZodObject<{
    font: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    bg: z.ZodOptional<z.ZodString>;
    border: z.ZodOptional<z.ZodString>;
    radius: z.ZodOptional<z.ZodString>;
    headerBg: z.ZodOptional<z.ZodString>;
    shadow: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const TableStyleSchema: z.ZodObject<{
    font: z.ZodOptional<z.ZodString>;
    headerBg: z.ZodOptional<z.ZodString>;
    headerColor: z.ZodOptional<z.ZodString>;
    border: z.ZodOptional<z.ZodString>;
    cellBg: z.ZodOptional<z.ZodString>;
    cellPadding: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const LinkStyleSchema: z.ZodObject<{
    color: z.ZodOptional<z.ZodString>;
    textDecoration: z.ZodOptional<z.ZodString>;
    hoverColor: z.ZodOptional<z.ZodString>;
    hoverUnderline: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
declare const HorizontalRuleStyleSchema: z.ZodObject<{
    color: z.ZodOptional<z.ZodString>;
    borderStyle: z.ZodOptional<z.ZodString>;
    height: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const MarkdownSectionStylesSchema: z.ZodObject<{
    h1: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        letterSpacing: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        borderBottom: z.ZodOptional<z.ZodString>;
        textTransform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    h2: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        letterSpacing: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        borderBottom: z.ZodOptional<z.ZodString>;
        textTransform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    h3: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        letterSpacing: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        borderBottom: z.ZodOptional<z.ZodString>;
        textTransform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    h4: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        letterSpacing: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        borderBottom: z.ZodOptional<z.ZodString>;
        textTransform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    h5: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        letterSpacing: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        borderBottom: z.ZodOptional<z.ZodString>;
        textTransform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    h6: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        letterSpacing: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        borderBottom: z.ZodOptional<z.ZodString>;
        textTransform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    p: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        lineHeight: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        textAlign: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    blockquote: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        fontStyle: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        bg: z.ZodOptional<z.ZodString>;
        borderLeftColor: z.ZodOptional<z.ZodString>;
        borderLeftWidth: z.ZodOptional<z.ZodString>;
        calloutTitle: z.ZodOptional<z.ZodString>;
        calloutColor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    ul: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        lineHeight: z.ZodOptional<z.ZodString>;
        markerColor: z.ZodOptional<z.ZodString>;
        spacing: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    ol: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        lineHeight: z.ZodOptional<z.ZodString>;
        markerColor: z.ZodOptional<z.ZodString>;
        spacing: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    inlineCode: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        bg: z.ZodOptional<z.ZodString>;
        border: z.ZodOptional<z.ZodString>;
        radius: z.ZodOptional<z.ZodString>;
        headerBg: z.ZodOptional<z.ZodString>;
        shadow: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    codeBlock: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        bg: z.ZodOptional<z.ZodString>;
        border: z.ZodOptional<z.ZodString>;
        radius: z.ZodOptional<z.ZodString>;
        headerBg: z.ZodOptional<z.ZodString>;
        shadow: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    table: z.ZodOptional<z.ZodObject<{
        font: z.ZodOptional<z.ZodString>;
        headerBg: z.ZodOptional<z.ZodString>;
        headerColor: z.ZodOptional<z.ZodString>;
        border: z.ZodOptional<z.ZodString>;
        cellBg: z.ZodOptional<z.ZodString>;
        cellPadding: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    link: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodString>;
        textDecoration: z.ZodOptional<z.ZodString>;
        hoverColor: z.ZodOptional<z.ZodString>;
        hoverUnderline: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    hr: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodString>;
        borderStyle: z.ZodOptional<z.ZodString>;
        height: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const ThemeTypographySchema: z.ZodObject<{
    globalFont: z.ZodString;
    globalMonoFont: z.ZodString;
    globalColor: z.ZodOptional<z.ZodString>;
    globalAccentColor: z.ZodOptional<z.ZodString>;
    headingFont: z.ZodOptional<z.ZodString>;
    bodyFont: z.ZodOptional<z.ZodString>;
    codeFont: z.ZodOptional<z.ZodString>;
    sections: z.ZodOptional<z.ZodObject<{
        h1: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            letterSpacing: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            borderBottom: z.ZodOptional<z.ZodString>;
            textTransform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        h2: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            letterSpacing: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            borderBottom: z.ZodOptional<z.ZodString>;
            textTransform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        h3: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            letterSpacing: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            borderBottom: z.ZodOptional<z.ZodString>;
            textTransform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        h4: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            letterSpacing: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            borderBottom: z.ZodOptional<z.ZodString>;
            textTransform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        h5: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            letterSpacing: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            borderBottom: z.ZodOptional<z.ZodString>;
            textTransform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        h6: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            letterSpacing: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            borderBottom: z.ZodOptional<z.ZodString>;
            textTransform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        p: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            lineHeight: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            textAlign: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        blockquote: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            fontStyle: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            bg: z.ZodOptional<z.ZodString>;
            borderLeftColor: z.ZodOptional<z.ZodString>;
            borderLeftWidth: z.ZodOptional<z.ZodString>;
            calloutTitle: z.ZodOptional<z.ZodString>;
            calloutColor: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        ul: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            lineHeight: z.ZodOptional<z.ZodString>;
            markerColor: z.ZodOptional<z.ZodString>;
            spacing: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        ol: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            lineHeight: z.ZodOptional<z.ZodString>;
            markerColor: z.ZodOptional<z.ZodString>;
            spacing: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        inlineCode: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            bg: z.ZodOptional<z.ZodString>;
            border: z.ZodOptional<z.ZodString>;
            radius: z.ZodOptional<z.ZodString>;
            headerBg: z.ZodOptional<z.ZodString>;
            shadow: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        codeBlock: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            bg: z.ZodOptional<z.ZodString>;
            border: z.ZodOptional<z.ZodString>;
            radius: z.ZodOptional<z.ZodString>;
            headerBg: z.ZodOptional<z.ZodString>;
            shadow: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        table: z.ZodOptional<z.ZodObject<{
            font: z.ZodOptional<z.ZodString>;
            headerBg: z.ZodOptional<z.ZodString>;
            headerColor: z.ZodOptional<z.ZodString>;
            border: z.ZodOptional<z.ZodString>;
            cellBg: z.ZodOptional<z.ZodString>;
            cellPadding: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        link: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodString>;
            textDecoration: z.ZodOptional<z.ZodString>;
            hoverColor: z.ZodOptional<z.ZodString>;
            hoverUnderline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        hr: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodString>;
            borderStyle: z.ZodOptional<z.ZodString>;
            height: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type HeadingLevelDefinition = z.infer<typeof HeadingLevelSchema>;
type ParagraphStyleDefinition = z.infer<typeof ParagraphStyleSchema>;
type BlockquoteStyleDefinition = z.infer<typeof BlockquoteStyleSchema>;
type ListStyleDefinition = z.infer<typeof ListStyleSchema>;
type CodeStyleDefinition = z.infer<typeof CodeStyleSchema>;
type TableStyleDefinition = z.infer<typeof TableStyleSchema>;
type LinkStyleDefinition = z.infer<typeof LinkStyleSchema>;
type MarkdownSectionStyles = z.infer<typeof MarkdownSectionStylesSchema>;
type ThemeTypographyDefinition = z.infer<typeof ThemeTypographySchema>;

declare const SkipoSemanticTokensSchema: z.ZodObject<{
    bg: z.ZodObject<{
        canvas: z.ZodString;
        surface: z.ZodString;
        surfaceHover: z.ZodString;
        blur: z.ZodString;
    }, z.core.$strip>;
    text: z.ZodObject<{
        primary: z.ZodString;
        muted: z.ZodString;
        inverse: z.ZodString;
    }, z.core.$strip>;
    accent: z.ZodObject<{
        primary: z.ZodString;
        fg: z.ZodString;
        glow: z.ZodString;
        hover: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    border: z.ZodObject<{
        color: z.ZodString;
        input: z.ZodString;
        style: z.ZodString;
    }, z.core.$strip>;
    radius: z.ZodObject<{
        base: z.ZodString;
        sm: z.ZodString;
        lg: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    shadow: z.ZodObject<{
        card: z.ZodString;
        cardHover: z.ZodString;
        btn: z.ZodString;
        btnHover: z.ZodString;
        btnActive: z.ZodString;
    }, z.core.$strip>;
    font: z.ZodObject<{
        sans: z.ZodString;
        mono: z.ZodString;
    }, z.core.$strip>;
    status: z.ZodObject<{
        success: z.ZodString;
        successFg: z.ZodString;
        warning: z.ZodString;
        warningFg: z.ZodString;
        danger: z.ZodString;
        dangerFg: z.ZodString;
        info: z.ZodString;
        infoFg: z.ZodString;
    }, z.core.$strip>;
    shell: z.ZodObject<{
        topToolbarHeight: z.ZodString;
        topToolbarBg: z.ZodString;
        bottomStripHeight: z.ZodString;
        bottomStripBg: z.ZodString;
        inspectionTextTranslucent: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
type SkipoSemanticTokens = z.infer<typeof SkipoSemanticTokensSchema>;

declare const SkipoThemeMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodDefault<z.ZodString>;
    mode: z.ZodDefault<z.ZodEnum<{
        dark: "dark";
        light: "light";
    }>>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const UIElementThemeValueSchema: z.ZodObject<{
    cssVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    styles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    effects: z.ZodOptional<z.ZodObject<{
        animation: z.ZodOptional<z.ZodString>;
        transition: z.ZodOptional<z.ZodString>;
        glow: z.ZodOptional<z.ZodString>;
        filter: z.ZodOptional<z.ZodString>;
        transformHover: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    assets: z.ZodOptional<z.ZodObject<{
        wallpaper: z.ZodOptional<z.ZodString>;
        overlayImage: z.ZodOptional<z.ZodString>;
        texture: z.ZodOptional<z.ZodString>;
        iconGlyph: z.ZodOptional<z.ZodString>;
        mediaUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const ThemeVariantDefinitionSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        dark: "dark";
        light: "light";
    }>;
    tokens: z.ZodOptional<z.ZodObject<{
        bg: z.ZodObject<{
            canvas: z.ZodString;
            surface: z.ZodString;
            surfaceHover: z.ZodString;
            blur: z.ZodString;
        }, z.core.$strip>;
        text: z.ZodObject<{
            primary: z.ZodString;
            muted: z.ZodString;
            inverse: z.ZodString;
        }, z.core.$strip>;
        accent: z.ZodObject<{
            primary: z.ZodString;
            fg: z.ZodString;
            glow: z.ZodString;
            hover: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        border: z.ZodObject<{
            color: z.ZodString;
            input: z.ZodString;
            style: z.ZodString;
        }, z.core.$strip>;
        radius: z.ZodObject<{
            base: z.ZodString;
            sm: z.ZodString;
            lg: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        shadow: z.ZodObject<{
            card: z.ZodString;
            cardHover: z.ZodString;
            btn: z.ZodString;
            btnHover: z.ZodString;
            btnActive: z.ZodString;
        }, z.core.$strip>;
        font: z.ZodObject<{
            sans: z.ZodString;
            mono: z.ZodString;
        }, z.core.$strip>;
        status: z.ZodObject<{
            success: z.ZodString;
            successFg: z.ZodString;
            warning: z.ZodString;
            warningFg: z.ZodString;
            danger: z.ZodString;
            dangerFg: z.ZodString;
            info: z.ZodString;
            infoFg: z.ZodString;
        }, z.core.$strip>;
        shell: z.ZodObject<{
            topToolbarHeight: z.ZodString;
            topToolbarBg: z.ZodString;
            bottomStripHeight: z.ZodString;
            bottomStripBg: z.ZodString;
            inspectionTextTranslucent: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    typography: z.ZodOptional<z.ZodObject<{
        globalFont: z.ZodString;
        globalMonoFont: z.ZodString;
        globalColor: z.ZodOptional<z.ZodString>;
        globalAccentColor: z.ZodOptional<z.ZodString>;
        headingFont: z.ZodOptional<z.ZodString>;
        bodyFont: z.ZodOptional<z.ZodString>;
        codeFont: z.ZodOptional<z.ZodString>;
        sections: z.ZodOptional<z.ZodObject<{
            h1: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h2: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h3: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h4: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h5: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h6: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            p: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                textAlign: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            blockquote: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontStyle: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                bg: z.ZodOptional<z.ZodString>;
                borderLeftColor: z.ZodOptional<z.ZodString>;
                borderLeftWidth: z.ZodOptional<z.ZodString>;
                calloutTitle: z.ZodOptional<z.ZodString>;
                calloutColor: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            ul: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                lineHeight: z.ZodOptional<z.ZodString>;
                markerColor: z.ZodOptional<z.ZodString>;
                spacing: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            ol: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                lineHeight: z.ZodOptional<z.ZodString>;
                markerColor: z.ZodOptional<z.ZodString>;
                spacing: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            inlineCode: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                bg: z.ZodOptional<z.ZodString>;
                border: z.ZodOptional<z.ZodString>;
                radius: z.ZodOptional<z.ZodString>;
                headerBg: z.ZodOptional<z.ZodString>;
                shadow: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            codeBlock: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                bg: z.ZodOptional<z.ZodString>;
                border: z.ZodOptional<z.ZodString>;
                radius: z.ZodOptional<z.ZodString>;
                headerBg: z.ZodOptional<z.ZodString>;
                shadow: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            table: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                headerBg: z.ZodOptional<z.ZodString>;
                headerColor: z.ZodOptional<z.ZodString>;
                border: z.ZodOptional<z.ZodString>;
                cellBg: z.ZodOptional<z.ZodString>;
                cellPadding: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            link: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodString>;
                textDecoration: z.ZodOptional<z.ZodString>;
                hoverColor: z.ZodOptional<z.ZodString>;
                hoverUnderline: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            hr: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodString>;
                borderStyle: z.ZodOptional<z.ZodString>;
                height: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    elementStyles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        cssVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        styles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        effects: z.ZodOptional<z.ZodObject<{
            animation: z.ZodOptional<z.ZodString>;
            transition: z.ZodOptional<z.ZodString>;
            glow: z.ZodOptional<z.ZodString>;
            filter: z.ZodOptional<z.ZodString>;
            transformHover: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        assets: z.ZodOptional<z.ZodObject<{
            wallpaper: z.ZodOptional<z.ZodString>;
            overlayImage: z.ZodOptional<z.ZodString>;
            texture: z.ZodOptional<z.ZodString>;
            iconGlyph: z.ZodOptional<z.ZodString>;
            mediaUrl: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    customCss: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const ModularThemePackSchema: z.ZodObject<{
    metadata: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        mode: z.ZodDefault<z.ZodEnum<{
            dark: "dark";
            light: "light";
        }>>;
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    variants: z.ZodObject<{
        dark: z.ZodObject<{
            mode: z.ZodEnum<{
                dark: "dark";
                light: "light";
            }>;
            tokens: z.ZodOptional<z.ZodObject<{
                bg: z.ZodObject<{
                    canvas: z.ZodString;
                    surface: z.ZodString;
                    surfaceHover: z.ZodString;
                    blur: z.ZodString;
                }, z.core.$strip>;
                text: z.ZodObject<{
                    primary: z.ZodString;
                    muted: z.ZodString;
                    inverse: z.ZodString;
                }, z.core.$strip>;
                accent: z.ZodObject<{
                    primary: z.ZodString;
                    fg: z.ZodString;
                    glow: z.ZodString;
                    hover: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
                border: z.ZodObject<{
                    color: z.ZodString;
                    input: z.ZodString;
                    style: z.ZodString;
                }, z.core.$strip>;
                radius: z.ZodObject<{
                    base: z.ZodString;
                    sm: z.ZodString;
                    lg: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
                shadow: z.ZodObject<{
                    card: z.ZodString;
                    cardHover: z.ZodString;
                    btn: z.ZodString;
                    btnHover: z.ZodString;
                    btnActive: z.ZodString;
                }, z.core.$strip>;
                font: z.ZodObject<{
                    sans: z.ZodString;
                    mono: z.ZodString;
                }, z.core.$strip>;
                status: z.ZodObject<{
                    success: z.ZodString;
                    successFg: z.ZodString;
                    warning: z.ZodString;
                    warningFg: z.ZodString;
                    danger: z.ZodString;
                    dangerFg: z.ZodString;
                    info: z.ZodString;
                    infoFg: z.ZodString;
                }, z.core.$strip>;
                shell: z.ZodObject<{
                    topToolbarHeight: z.ZodString;
                    topToolbarBg: z.ZodString;
                    bottomStripHeight: z.ZodString;
                    bottomStripBg: z.ZodString;
                    inspectionTextTranslucent: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip>>;
            typography: z.ZodOptional<z.ZodObject<{
                globalFont: z.ZodString;
                globalMonoFont: z.ZodString;
                globalColor: z.ZodOptional<z.ZodString>;
                globalAccentColor: z.ZodOptional<z.ZodString>;
                headingFont: z.ZodOptional<z.ZodString>;
                bodyFont: z.ZodOptional<z.ZodString>;
                codeFont: z.ZodOptional<z.ZodString>;
                sections: z.ZodOptional<z.ZodObject<{
                    h1: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h2: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h3: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h4: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h5: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h6: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    p: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        textAlign: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    blockquote: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontStyle: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        bg: z.ZodOptional<z.ZodString>;
                        borderLeftColor: z.ZodOptional<z.ZodString>;
                        borderLeftWidth: z.ZodOptional<z.ZodString>;
                        calloutTitle: z.ZodOptional<z.ZodString>;
                        calloutColor: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    ul: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        markerColor: z.ZodOptional<z.ZodString>;
                        spacing: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    ol: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        markerColor: z.ZodOptional<z.ZodString>;
                        spacing: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    inlineCode: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        bg: z.ZodOptional<z.ZodString>;
                        border: z.ZodOptional<z.ZodString>;
                        radius: z.ZodOptional<z.ZodString>;
                        headerBg: z.ZodOptional<z.ZodString>;
                        shadow: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    codeBlock: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        bg: z.ZodOptional<z.ZodString>;
                        border: z.ZodOptional<z.ZodString>;
                        radius: z.ZodOptional<z.ZodString>;
                        headerBg: z.ZodOptional<z.ZodString>;
                        shadow: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    table: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        headerBg: z.ZodOptional<z.ZodString>;
                        headerColor: z.ZodOptional<z.ZodString>;
                        border: z.ZodOptional<z.ZodString>;
                        cellBg: z.ZodOptional<z.ZodString>;
                        cellPadding: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    link: z.ZodOptional<z.ZodObject<{
                        color: z.ZodOptional<z.ZodString>;
                        textDecoration: z.ZodOptional<z.ZodString>;
                        hoverColor: z.ZodOptional<z.ZodString>;
                        hoverUnderline: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$strip>>;
                    hr: z.ZodOptional<z.ZodObject<{
                        color: z.ZodOptional<z.ZodString>;
                        borderStyle: z.ZodOptional<z.ZodString>;
                        height: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            elementStyles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                cssVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                styles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                effects: z.ZodOptional<z.ZodObject<{
                    animation: z.ZodOptional<z.ZodString>;
                    transition: z.ZodOptional<z.ZodString>;
                    glow: z.ZodOptional<z.ZodString>;
                    filter: z.ZodOptional<z.ZodString>;
                    transformHover: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                assets: z.ZodOptional<z.ZodObject<{
                    wallpaper: z.ZodOptional<z.ZodString>;
                    overlayImage: z.ZodOptional<z.ZodString>;
                    texture: z.ZodOptional<z.ZodString>;
                    iconGlyph: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            customCss: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        light: z.ZodObject<{
            mode: z.ZodEnum<{
                dark: "dark";
                light: "light";
            }>;
            tokens: z.ZodOptional<z.ZodObject<{
                bg: z.ZodObject<{
                    canvas: z.ZodString;
                    surface: z.ZodString;
                    surfaceHover: z.ZodString;
                    blur: z.ZodString;
                }, z.core.$strip>;
                text: z.ZodObject<{
                    primary: z.ZodString;
                    muted: z.ZodString;
                    inverse: z.ZodString;
                }, z.core.$strip>;
                accent: z.ZodObject<{
                    primary: z.ZodString;
                    fg: z.ZodString;
                    glow: z.ZodString;
                    hover: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
                border: z.ZodObject<{
                    color: z.ZodString;
                    input: z.ZodString;
                    style: z.ZodString;
                }, z.core.$strip>;
                radius: z.ZodObject<{
                    base: z.ZodString;
                    sm: z.ZodString;
                    lg: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
                shadow: z.ZodObject<{
                    card: z.ZodString;
                    cardHover: z.ZodString;
                    btn: z.ZodString;
                    btnHover: z.ZodString;
                    btnActive: z.ZodString;
                }, z.core.$strip>;
                font: z.ZodObject<{
                    sans: z.ZodString;
                    mono: z.ZodString;
                }, z.core.$strip>;
                status: z.ZodObject<{
                    success: z.ZodString;
                    successFg: z.ZodString;
                    warning: z.ZodString;
                    warningFg: z.ZodString;
                    danger: z.ZodString;
                    dangerFg: z.ZodString;
                    info: z.ZodString;
                    infoFg: z.ZodString;
                }, z.core.$strip>;
                shell: z.ZodObject<{
                    topToolbarHeight: z.ZodString;
                    topToolbarBg: z.ZodString;
                    bottomStripHeight: z.ZodString;
                    bottomStripBg: z.ZodString;
                    inspectionTextTranslucent: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip>>;
            typography: z.ZodOptional<z.ZodObject<{
                globalFont: z.ZodString;
                globalMonoFont: z.ZodString;
                globalColor: z.ZodOptional<z.ZodString>;
                globalAccentColor: z.ZodOptional<z.ZodString>;
                headingFont: z.ZodOptional<z.ZodString>;
                bodyFont: z.ZodOptional<z.ZodString>;
                codeFont: z.ZodOptional<z.ZodString>;
                sections: z.ZodOptional<z.ZodObject<{
                    h1: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h2: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h3: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h4: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h5: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    h6: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        letterSpacing: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        borderBottom: z.ZodOptional<z.ZodString>;
                        textTransform: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    p: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                        textAlign: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    blockquote: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        fontStyle: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        bg: z.ZodOptional<z.ZodString>;
                        borderLeftColor: z.ZodOptional<z.ZodString>;
                        borderLeftWidth: z.ZodOptional<z.ZodString>;
                        calloutTitle: z.ZodOptional<z.ZodString>;
                        calloutColor: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    ul: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        markerColor: z.ZodOptional<z.ZodString>;
                        spacing: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    ol: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        lineHeight: z.ZodOptional<z.ZodString>;
                        markerColor: z.ZodOptional<z.ZodString>;
                        spacing: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    inlineCode: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        bg: z.ZodOptional<z.ZodString>;
                        border: z.ZodOptional<z.ZodString>;
                        radius: z.ZodOptional<z.ZodString>;
                        headerBg: z.ZodOptional<z.ZodString>;
                        shadow: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    codeBlock: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        fontSize: z.ZodOptional<z.ZodString>;
                        color: z.ZodOptional<z.ZodString>;
                        bg: z.ZodOptional<z.ZodString>;
                        border: z.ZodOptional<z.ZodString>;
                        radius: z.ZodOptional<z.ZodString>;
                        headerBg: z.ZodOptional<z.ZodString>;
                        shadow: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    table: z.ZodOptional<z.ZodObject<{
                        font: z.ZodOptional<z.ZodString>;
                        headerBg: z.ZodOptional<z.ZodString>;
                        headerColor: z.ZodOptional<z.ZodString>;
                        border: z.ZodOptional<z.ZodString>;
                        cellBg: z.ZodOptional<z.ZodString>;
                        cellPadding: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    link: z.ZodOptional<z.ZodObject<{
                        color: z.ZodOptional<z.ZodString>;
                        textDecoration: z.ZodOptional<z.ZodString>;
                        hoverColor: z.ZodOptional<z.ZodString>;
                        hoverUnderline: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$strip>>;
                    hr: z.ZodOptional<z.ZodObject<{
                        color: z.ZodOptional<z.ZodString>;
                        borderStyle: z.ZodOptional<z.ZodString>;
                        height: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            elementStyles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                cssVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                styles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                effects: z.ZodOptional<z.ZodObject<{
                    animation: z.ZodOptional<z.ZodString>;
                    transition: z.ZodOptional<z.ZodString>;
                    glow: z.ZodOptional<z.ZodString>;
                    filter: z.ZodOptional<z.ZodString>;
                    transformHover: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                assets: z.ZodOptional<z.ZodObject<{
                    wallpaper: z.ZodOptional<z.ZodString>;
                    overlayImage: z.ZodOptional<z.ZodString>;
                    texture: z.ZodOptional<z.ZodString>;
                    iconGlyph: z.ZodOptional<z.ZodString>;
                    mediaUrl: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            customCss: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    typography: z.ZodOptional<z.ZodObject<{
        globalFont: z.ZodString;
        globalMonoFont: z.ZodString;
        globalColor: z.ZodOptional<z.ZodString>;
        globalAccentColor: z.ZodOptional<z.ZodString>;
        headingFont: z.ZodOptional<z.ZodString>;
        bodyFont: z.ZodOptional<z.ZodString>;
        codeFont: z.ZodOptional<z.ZodString>;
        sections: z.ZodOptional<z.ZodObject<{
            h1: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h2: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h3: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h4: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h5: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            h6: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                letterSpacing: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                borderBottom: z.ZodOptional<z.ZodString>;
                textTransform: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            p: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontWeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                lineHeight: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                opacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                textAlign: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            blockquote: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                fontStyle: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                bg: z.ZodOptional<z.ZodString>;
                borderLeftColor: z.ZodOptional<z.ZodString>;
                borderLeftWidth: z.ZodOptional<z.ZodString>;
                calloutTitle: z.ZodOptional<z.ZodString>;
                calloutColor: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            ul: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                lineHeight: z.ZodOptional<z.ZodString>;
                markerColor: z.ZodOptional<z.ZodString>;
                spacing: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            ol: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                lineHeight: z.ZodOptional<z.ZodString>;
                markerColor: z.ZodOptional<z.ZodString>;
                spacing: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            inlineCode: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                bg: z.ZodOptional<z.ZodString>;
                border: z.ZodOptional<z.ZodString>;
                radius: z.ZodOptional<z.ZodString>;
                headerBg: z.ZodOptional<z.ZodString>;
                shadow: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            codeBlock: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                fontSize: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                bg: z.ZodOptional<z.ZodString>;
                border: z.ZodOptional<z.ZodString>;
                radius: z.ZodOptional<z.ZodString>;
                headerBg: z.ZodOptional<z.ZodString>;
                shadow: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            table: z.ZodOptional<z.ZodObject<{
                font: z.ZodOptional<z.ZodString>;
                headerBg: z.ZodOptional<z.ZodString>;
                headerColor: z.ZodOptional<z.ZodString>;
                border: z.ZodOptional<z.ZodString>;
                cellBg: z.ZodOptional<z.ZodString>;
                cellPadding: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            link: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodString>;
                textDecoration: z.ZodOptional<z.ZodString>;
                hoverColor: z.ZodOptional<z.ZodString>;
                hoverUnderline: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            hr: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodString>;
                borderStyle: z.ZodOptional<z.ZodString>;
                height: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    tokens: z.ZodOptional<z.ZodObject<{
        bg: z.ZodObject<{
            canvas: z.ZodString;
            surface: z.ZodString;
            surfaceHover: z.ZodString;
            blur: z.ZodString;
        }, z.core.$strip>;
        text: z.ZodObject<{
            primary: z.ZodString;
            muted: z.ZodString;
            inverse: z.ZodString;
        }, z.core.$strip>;
        accent: z.ZodObject<{
            primary: z.ZodString;
            fg: z.ZodString;
            glow: z.ZodString;
            hover: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        border: z.ZodObject<{
            color: z.ZodString;
            input: z.ZodString;
            style: z.ZodString;
        }, z.core.$strip>;
        radius: z.ZodObject<{
            base: z.ZodString;
            sm: z.ZodString;
            lg: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        shadow: z.ZodObject<{
            card: z.ZodString;
            cardHover: z.ZodString;
            btn: z.ZodString;
            btnHover: z.ZodString;
            btnActive: z.ZodString;
        }, z.core.$strip>;
        font: z.ZodObject<{
            sans: z.ZodString;
            mono: z.ZodString;
        }, z.core.$strip>;
        status: z.ZodObject<{
            success: z.ZodString;
            successFg: z.ZodString;
            warning: z.ZodString;
            warningFg: z.ZodString;
            danger: z.ZodString;
            dangerFg: z.ZodString;
            info: z.ZodString;
            infoFg: z.ZodString;
        }, z.core.$strip>;
        shell: z.ZodObject<{
            topToolbarHeight: z.ZodString;
            topToolbarBg: z.ZodString;
            bottomStripHeight: z.ZodString;
            bottomStripBg: z.ZodString;
            inspectionTextTranslucent: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    elementStyles: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        cssVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        styles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        effects: z.ZodOptional<z.ZodObject<{
            animation: z.ZodOptional<z.ZodString>;
            transition: z.ZodOptional<z.ZodString>;
            glow: z.ZodOptional<z.ZodString>;
            filter: z.ZodOptional<z.ZodString>;
            transformHover: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        assets: z.ZodOptional<z.ZodObject<{
            wallpaper: z.ZodOptional<z.ZodString>;
            overlayImage: z.ZodOptional<z.ZodString>;
            texture: z.ZodOptional<z.ZodString>;
            iconGlyph: z.ZodOptional<z.ZodString>;
            mediaUrl: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    customCss: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type ModularThemePack = z.infer<typeof ModularThemePackSchema>;
type ThemeVariantDefinition = z.infer<typeof ThemeVariantDefinitionSchema>;
declare function validateModularThemePack(pack: unknown): ModularThemePack;
declare function safeValidateModularThemePack(pack: unknown): z.ZodSafeParseResult<{
    metadata: {
        id: string;
        name: string;
        version: string;
        mode: "dark" | "light";
        author?: string | undefined;
        description?: string | undefined;
    };
    variants: {
        dark: {
            mode: "dark" | "light";
            elementStyles: Record<string, {
                cssVars?: Record<string, string> | undefined;
                styles?: Record<string, string | number> | undefined;
                effects?: {
                    animation?: string | undefined;
                    transition?: string | undefined;
                    glow?: string | undefined;
                    filter?: string | undefined;
                    transformHover?: string | undefined;
                } | undefined;
                assets?: {
                    wallpaper?: string | undefined;
                    overlayImage?: string | undefined;
                    texture?: string | undefined;
                    iconGlyph?: string | undefined;
                    mediaUrl?: string | undefined;
                } | undefined;
            }>;
            tokens?: {
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
                    hover?: string | undefined;
                };
                border: {
                    color: string;
                    input: string;
                    style: string;
                };
                radius: {
                    base: string;
                    sm: string;
                    lg?: string | undefined;
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
            } | undefined;
            typography?: {
                globalFont: string;
                globalMonoFont: string;
                globalColor?: string | undefined;
                globalAccentColor?: string | undefined;
                headingFont?: string | undefined;
                bodyFont?: string | undefined;
                codeFont?: string | undefined;
                sections?: {
                    h1?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h2?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h3?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h4?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h5?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h6?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    p?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        color?: string | undefined;
                        opacity?: string | number | undefined;
                        textAlign?: string | undefined;
                    } | undefined;
                    blockquote?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontStyle?: string | undefined;
                        color?: string | undefined;
                        bg?: string | undefined;
                        borderLeftColor?: string | undefined;
                        borderLeftWidth?: string | undefined;
                        calloutTitle?: string | undefined;
                        calloutColor?: string | undefined;
                    } | undefined;
                    ul?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        lineHeight?: string | undefined;
                        markerColor?: string | undefined;
                        spacing?: string | undefined;
                    } | undefined;
                    ol?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        lineHeight?: string | undefined;
                        markerColor?: string | undefined;
                        spacing?: string | undefined;
                    } | undefined;
                    inlineCode?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        color?: string | undefined;
                        bg?: string | undefined;
                        border?: string | undefined;
                        radius?: string | undefined;
                        headerBg?: string | undefined;
                        shadow?: string | undefined;
                    } | undefined;
                    codeBlock?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        color?: string | undefined;
                        bg?: string | undefined;
                        border?: string | undefined;
                        radius?: string | undefined;
                        headerBg?: string | undefined;
                        shadow?: string | undefined;
                    } | undefined;
                    table?: {
                        font?: string | undefined;
                        headerBg?: string | undefined;
                        headerColor?: string | undefined;
                        border?: string | undefined;
                        cellBg?: string | undefined;
                        cellPadding?: string | undefined;
                    } | undefined;
                    link?: {
                        color?: string | undefined;
                        textDecoration?: string | undefined;
                        hoverColor?: string | undefined;
                        hoverUnderline?: boolean | undefined;
                    } | undefined;
                    hr?: {
                        color?: string | undefined;
                        borderStyle?: string | undefined;
                        height?: string | undefined;
                    } | undefined;
                } | undefined;
            } | undefined;
            customCss?: string | undefined;
        };
        light: {
            mode: "dark" | "light";
            elementStyles: Record<string, {
                cssVars?: Record<string, string> | undefined;
                styles?: Record<string, string | number> | undefined;
                effects?: {
                    animation?: string | undefined;
                    transition?: string | undefined;
                    glow?: string | undefined;
                    filter?: string | undefined;
                    transformHover?: string | undefined;
                } | undefined;
                assets?: {
                    wallpaper?: string | undefined;
                    overlayImage?: string | undefined;
                    texture?: string | undefined;
                    iconGlyph?: string | undefined;
                    mediaUrl?: string | undefined;
                } | undefined;
            }>;
            tokens?: {
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
                    hover?: string | undefined;
                };
                border: {
                    color: string;
                    input: string;
                    style: string;
                };
                radius: {
                    base: string;
                    sm: string;
                    lg?: string | undefined;
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
            } | undefined;
            typography?: {
                globalFont: string;
                globalMonoFont: string;
                globalColor?: string | undefined;
                globalAccentColor?: string | undefined;
                headingFont?: string | undefined;
                bodyFont?: string | undefined;
                codeFont?: string | undefined;
                sections?: {
                    h1?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h2?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h3?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h4?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h5?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    h6?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        letterSpacing?: string | undefined;
                        color?: string | undefined;
                        borderBottom?: string | undefined;
                        textTransform?: string | undefined;
                    } | undefined;
                    p?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontWeight?: string | number | undefined;
                        lineHeight?: string | undefined;
                        color?: string | undefined;
                        opacity?: string | number | undefined;
                        textAlign?: string | undefined;
                    } | undefined;
                    blockquote?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        fontStyle?: string | undefined;
                        color?: string | undefined;
                        bg?: string | undefined;
                        borderLeftColor?: string | undefined;
                        borderLeftWidth?: string | undefined;
                        calloutTitle?: string | undefined;
                        calloutColor?: string | undefined;
                    } | undefined;
                    ul?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        lineHeight?: string | undefined;
                        markerColor?: string | undefined;
                        spacing?: string | undefined;
                    } | undefined;
                    ol?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        lineHeight?: string | undefined;
                        markerColor?: string | undefined;
                        spacing?: string | undefined;
                    } | undefined;
                    inlineCode?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        color?: string | undefined;
                        bg?: string | undefined;
                        border?: string | undefined;
                        radius?: string | undefined;
                        headerBg?: string | undefined;
                        shadow?: string | undefined;
                    } | undefined;
                    codeBlock?: {
                        font?: string | undefined;
                        fontSize?: string | undefined;
                        color?: string | undefined;
                        bg?: string | undefined;
                        border?: string | undefined;
                        radius?: string | undefined;
                        headerBg?: string | undefined;
                        shadow?: string | undefined;
                    } | undefined;
                    table?: {
                        font?: string | undefined;
                        headerBg?: string | undefined;
                        headerColor?: string | undefined;
                        border?: string | undefined;
                        cellBg?: string | undefined;
                        cellPadding?: string | undefined;
                    } | undefined;
                    link?: {
                        color?: string | undefined;
                        textDecoration?: string | undefined;
                        hoverColor?: string | undefined;
                        hoverUnderline?: boolean | undefined;
                    } | undefined;
                    hr?: {
                        color?: string | undefined;
                        borderStyle?: string | undefined;
                        height?: string | undefined;
                    } | undefined;
                } | undefined;
            } | undefined;
            customCss?: string | undefined;
        };
    };
    elementStyles: Record<string, {
        cssVars?: Record<string, string> | undefined;
        styles?: Record<string, string | number> | undefined;
        effects?: {
            animation?: string | undefined;
            transition?: string | undefined;
            glow?: string | undefined;
            filter?: string | undefined;
            transformHover?: string | undefined;
        } | undefined;
        assets?: {
            wallpaper?: string | undefined;
            overlayImage?: string | undefined;
            texture?: string | undefined;
            iconGlyph?: string | undefined;
            mediaUrl?: string | undefined;
        } | undefined;
    }>;
    typography?: {
        globalFont: string;
        globalMonoFont: string;
        globalColor?: string | undefined;
        globalAccentColor?: string | undefined;
        headingFont?: string | undefined;
        bodyFont?: string | undefined;
        codeFont?: string | undefined;
        sections?: {
            h1?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                letterSpacing?: string | undefined;
                color?: string | undefined;
                borderBottom?: string | undefined;
                textTransform?: string | undefined;
            } | undefined;
            h2?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                letterSpacing?: string | undefined;
                color?: string | undefined;
                borderBottom?: string | undefined;
                textTransform?: string | undefined;
            } | undefined;
            h3?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                letterSpacing?: string | undefined;
                color?: string | undefined;
                borderBottom?: string | undefined;
                textTransform?: string | undefined;
            } | undefined;
            h4?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                letterSpacing?: string | undefined;
                color?: string | undefined;
                borderBottom?: string | undefined;
                textTransform?: string | undefined;
            } | undefined;
            h5?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                letterSpacing?: string | undefined;
                color?: string | undefined;
                borderBottom?: string | undefined;
                textTransform?: string | undefined;
            } | undefined;
            h6?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                letterSpacing?: string | undefined;
                color?: string | undefined;
                borderBottom?: string | undefined;
                textTransform?: string | undefined;
            } | undefined;
            p?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontWeight?: string | number | undefined;
                lineHeight?: string | undefined;
                color?: string | undefined;
                opacity?: string | number | undefined;
                textAlign?: string | undefined;
            } | undefined;
            blockquote?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                fontStyle?: string | undefined;
                color?: string | undefined;
                bg?: string | undefined;
                borderLeftColor?: string | undefined;
                borderLeftWidth?: string | undefined;
                calloutTitle?: string | undefined;
                calloutColor?: string | undefined;
            } | undefined;
            ul?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                lineHeight?: string | undefined;
                markerColor?: string | undefined;
                spacing?: string | undefined;
            } | undefined;
            ol?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                lineHeight?: string | undefined;
                markerColor?: string | undefined;
                spacing?: string | undefined;
            } | undefined;
            inlineCode?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                color?: string | undefined;
                bg?: string | undefined;
                border?: string | undefined;
                radius?: string | undefined;
                headerBg?: string | undefined;
                shadow?: string | undefined;
            } | undefined;
            codeBlock?: {
                font?: string | undefined;
                fontSize?: string | undefined;
                color?: string | undefined;
                bg?: string | undefined;
                border?: string | undefined;
                radius?: string | undefined;
                headerBg?: string | undefined;
                shadow?: string | undefined;
            } | undefined;
            table?: {
                font?: string | undefined;
                headerBg?: string | undefined;
                headerColor?: string | undefined;
                border?: string | undefined;
                cellBg?: string | undefined;
                cellPadding?: string | undefined;
            } | undefined;
            link?: {
                color?: string | undefined;
                textDecoration?: string | undefined;
                hoverColor?: string | undefined;
                hoverUnderline?: boolean | undefined;
            } | undefined;
            hr?: {
                color?: string | undefined;
                borderStyle?: string | undefined;
                height?: string | undefined;
            } | undefined;
        } | undefined;
    } | undefined;
    tokens?: {
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
            hover?: string | undefined;
        };
        border: {
            color: string;
            input: string;
            style: string;
        };
        radius: {
            base: string;
            sm: string;
            lg?: string | undefined;
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
    } | undefined;
    customCss?: string | undefined;
}>;

interface SkipoThemeMetadata {
    id: string;
    name: string;
    version: string;
    mode: 'dark' | 'light';
    author?: string;
    description?: string;
}
interface SkipoThemePack {
    metadata: SkipoThemeMetadata;
    tokens: SkipoSemanticTokens;
    customCss?: string;
}
type UIElementCategory = 'layout' | 'navigation' | 'surface' | 'control' | 'typography' | 'feedback' | 'graph' | 'media' | 'specialized';
interface UIElementDefinition {
    id: string;
    name: string;
    category: UIElementCategory;
    description: string;
    cssVariables?: string[];
    supportedStyles?: string[];
    supportedEffects?: string[];
    supportedAssets?: string[];
    firstDefinedByApp: string;
}
interface UIElementThemeValue {
    cssVars?: Record<string, string>;
    styles?: Record<string, string | number>;
    effects?: {
        animation?: string;
        transition?: string;
        glow?: string;
        filter?: string;
        transformHover?: string;
    };
    assets?: {
        wallpaper?: string;
        overlayImage?: string;
        texture?: string;
        iconGlyph?: string;
        mediaUrl?: string;
    };
}
interface AppThemeSocket {
    appId: string;
    appName: string;
    version: string;
    elementIds: string[];
    defaultThemePackId?: string;
    elementDefaults?: Record<string, Partial<UIElementThemeValue>>;
}
interface ThemeApplicationState {
    activeBasePackId: string;
    activeMode: 'dark' | 'light';
    elementOverrides: Record<string, string>;
}
interface ElementStatusReport {
    elementId: string;
    name: string;
    category: UIElementCategory;
    appliedThemePackId: string;
    appliedVariant: 'dark' | 'light';
    isOverridden: boolean;
    isFallback: boolean;
    effectiveCssVars: Record<string, string>;
    effectiveStyles: Record<string, string | number>;
    effectiveEffects: Record<string, string>;
    effectiveAssets: Record<string, string>;
}
interface ThemeEngineStatus {
    appId: string;
    socketVersion: string;
    registeredElementsCount: number;
    activeBasePackId: string;
    activeBasePackName: string;
    activeMode: 'dark' | 'light';
    elementOverridesCount: number;
    elementOverrides: Record<string, string>;
    elements: Record<string, ElementStatusReport>;
    uncoveredElements: string[];
    ignoredElements: string[];
    timestamp: number;
    isValid: boolean;
}

declare const DEFAULT_DARK_THEME_PACK: SkipoThemePack;
declare const DEFAULT_LIGHT_THEME_PACK: SkipoThemePack;

declare function tokensToCssVariables(tokens: SkipoSemanticTokens): Record<string, string>;
declare function applyThemePack(themePack: SkipoThemePack, target?: HTMLElement): void;
declare function validateThemePack(raw: unknown): {
    valid: boolean;
    errors: string[];
};

declare class ThemeEngine {
    private socket;
    private packs;
    private activeBasePackId;
    private activeMode;
    private elementOverrides;
    private listeners;
    constructor(socket: AppThemeSocket, initialPacks?: ModularThemePack[], initialMode?: 'dark' | 'light');
    registerThemePack(pack: ModularThemePack): void;
    getThemePack(packId: string): ModularThemePack | undefined;
    getAllThemePacks(): ModularThemePack[];
    getSocket(): AppThemeSocket;
    getActiveBasePackId(): string;
    getMode(): 'dark' | 'light';
    setBaseThemePack(packId: string): void;
    setMode(mode: 'dark' | 'light'): void;
    toggleMode(): 'dark' | 'light';
    setElementOverride(elementId: string, packId: string): void;
    clearElementOverride(elementId: string): void;
    clearAllOverrides(): void;
    batchSetElementOverrides(overrides: Record<string, string>): void;
    getElementOverrides(): Record<string, string>;
    resolveElementTheme(elementId: string): {
        appliedPackId: string;
        appliedVariant: 'dark' | 'light';
        isOverridden: boolean;
        isFallback: boolean;
        value: UIElementThemeValue;
    };
    computeAllCssVariables(): Record<string, string>;
    applyToDOM(target?: HTMLElement): void;
    subscribe(fn: (state: ThemeApplicationState) => void): () => void;
    private notify;
}

type SkipoThemeMode = 'dark' | 'light';
interface SkipoThemeContextValue {
    theme: SkipoThemeMode;
    themePack: SkipoThemePack;
    engine?: ThemeEngine;
    status?: ThemeEngineStatus;
    elementOverrides: Record<string, string>;
    setTheme: (theme: SkipoThemeMode) => void;
    setThemePack: (pack: SkipoThemePack) => void;
    toggleTheme: () => void;
    setElementOverride: (elementId: string, packId: string) => void;
    clearElementOverride: (elementId: string) => void;
}
interface SkipoThemeProviderProps {
    children: React__default.ReactNode;
    defaultTheme?: SkipoThemeMode;
    initialThemePack?: SkipoThemePack;
    engine?: ThemeEngine;
}
declare function SkipoThemeProvider({ children, defaultTheme, initialThemePack, engine }: SkipoThemeProviderProps): React__default.JSX.Element;
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

declare const CANONICAL_ELEMENTS: UIElementDefinition[];

declare class ElementLedgerRegistry {
    private elements;
    constructor();
    reset(): void;
    register(def: UIElementDefinition): void;
    get(id: string): UIElementDefinition | undefined;
    has(id: string): boolean;
    getAll(): UIElementDefinition[];
    count(): number;
}
declare const centralLedger: ElementLedgerRegistry;
declare function registerUIElement(def: UIElementDefinition): void;
declare function getUIElement(id: string): UIElementDefinition | undefined;
declare function getAllUIElements(): UIElementDefinition[];

declare function validateSocketElements(socket: AppThemeSocket): {
    valid: boolean;
    missing: string[];
};
declare function createAppThemeSocket(definition: AppThemeSocket): AppThemeSocket;

declare function getThemeEngineStatus(engine: ThemeEngine): ThemeEngineStatus;

declare const DOCUSTACK_DARK_GOLD_PACK: ModularThemePack;

declare const DOCUSTACK_WARM_COFFEE_PACK: ModularThemePack;

declare const DOCUSTACK_CYBERPUNK_PACK: ModularThemePack;

interface ResolvedTypographyCascade {
    globalFont: string;
    globalMonoFont: string;
    globalColor: string;
    globalAccentColor: string;
    headingFont: string;
    bodyFont: string;
    codeFont: string;
    cssVars: Record<string, string>;
}
declare function resolveTypographyCascade(typo?: ThemeTypographyDefinition, fallbackAccent?: string): ResolvedTypographyCascade;

/**
 * ASCII Architecture Flowchart: appSocket
 *
 *   ┌──────────────────────────────────────────────┐
 *   │         Initialize App Theme Socket          │
 *   └──────────────────────────────────────────────┘
 *                          │
 *                          ▼
 *   ┌──────────────────────────────────────────────┐
 *   │         Validate Elements in Ledger          │
 *   └──────────────────────────────────────────────┘
 *                          │
 *                          ▼
 *   ┌──────────────────────────────────────────────┐
 *   │      Instantiate Singleton ThemeEngine       │
 *   └──────────────────────────────────────────────┘
 */

declare const DEPM_THEME_PACKS: ModularThemePack[];
declare const depmThemeSocket: AppThemeSocket;
declare const appThemeEngine: ThemeEngine;

export { type AppThemeSocket, type BlockquoteStyleDefinition, BlockquoteStyleSchema, CANONICAL_ELEMENTS, type CodeStyleDefinition, CodeStyleSchema, DEFAULT_DARK_THEME_PACK, DEFAULT_LIGHT_THEME_PACK, DEPM_THEME_PACKS, DOCUSTACK_CYBERPUNK_PACK, DOCUSTACK_DARK_GOLD_PACK, DOCUSTACK_WARM_COFFEE_PACK, DOCUSTACK_CYBERPUNK_PACK as DocuStackCyberpunkPack, DOCUSTACK_DARK_GOLD_PACK as DocuStackDarkGoldPack, DOCUSTACK_WARM_COFFEE_PACK as DocuStackWarmCoffeePack, type ElementStatusReport, type HeadingLevelDefinition, HeadingLevelSchema, HorizontalRuleStyleSchema, type LinkStyleDefinition, LinkStyleSchema, type ListStyleDefinition, ListStyleSchema, type MarkdownSectionStyles, MarkdownSectionStylesSchema, type ModularThemePack, ModularThemePackSchema, type ParagraphStyleDefinition, ParagraphStyleSchema, type ResolvedTypographyCascade, type SkipoSemanticTokens, SkipoSemanticTokensSchema, type SkipoThemeContextValue, type SkipoThemeMetadata, SkipoThemeMetadataSchema, type SkipoThemePack, SkipoThemeProvider, type SkipoThemeProviderProps, type TableStyleDefinition, TableStyleSchema, type ThemeApplicationState, ThemeEngine, type ThemeEngineStatus, type ThemeTypographyDefinition, ThemeTypographySchema, type ThemeVariantDefinition, ThemeVariantDefinitionSchema, type UIElementCategory, type UIElementDefinition, type UIElementThemeValue, UIElementThemeValueSchema, appThemeEngine, applyThemePack, centralLedger, createAppThemeSocket, depmThemeSocket, getAllUIElements, getThemeEngineStatus, getUIElement, palettes, registerUIElement, resolveTypographyCascade, safeValidateModularThemePack, tokensToCssVariables, useSkipoTheme, validateModularThemePack, validateSocketElements, validateThemePack };
