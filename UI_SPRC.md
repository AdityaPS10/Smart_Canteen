THEME AND FONT SETUP. Change ONLY the visual theme. Do not change logic, routes, API, database or flows, and do not add features.

1. Check which Tailwind version (v3 or v4) and which shadcn/ui setup this project uses. If the theme code below was made for a different version, convert it to match this project. Do not upgrade or downgrade Tailwind.

2. Replace the existing shadcn color variables in app/globals.css (:root for light, .dark for dark) with the tweakcn theme below. Keep any other custom CSS that is not a theme variable. Keep the theme's radius, shadow and spacing values.
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --background: #fcfcfc;
  --foreground: #000000;
  --card: #ffffff;
  --card-foreground: #000000;
  --popover: #fcfcfc;
  --popover-foreground: #000000;
  --primary: #000000;
  --primary-foreground: #ffffff;
  --secondary: #ebebeb;
  --secondary-foreground: #000000;
  --muted: #f5f5f5;
  --muted-foreground: #525252;
  --accent: #ebebeb;
  --accent-foreground: #000000;
  --destructive: #e54b4f;
  --destructive-foreground: #ffffff;
  --border: #e4e4e4;
  --input: #ebebeb;
  --ring: #000000;
  --chart-1: #ffae04;
  --chart-2: #2d62ef;
  --chart-3: #a4a4a4;
  --chart-4: #e4e4e4;
  --chart-5: #747474;
  --sidebar: #fcfcfc;
  --sidebar-foreground: #000000;
  --sidebar-primary: #000000;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #ebebeb;
  --sidebar-accent-foreground: #000000;
  --sidebar-border: #ebebeb;
  --sidebar-ring: #000000;
  --font-sans: Geist, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Geist Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 2px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.18;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow-md: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18);
  --shadow-lg: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18);
  --shadow-xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.45);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: #000000;
  --foreground: #ffffff;
  --card: #090909;
  --card-foreground: #ffffff;
  --popover: #121212;
  --popover-foreground: #ffffff;
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: #222222;
  --secondary-foreground: #ffffff;
  --muted: #1d1d1d;
  --muted-foreground: #a4a4a4;
  --accent: #333333;
  --accent-foreground: #ffffff;
  --destructive: #ff5b5b;
  --destructive-foreground: #000000;
  --border: #242424;
  --input: #333333;
  --ring: #a4a4a4;
  --chart-1: #ffae04;
  --chart-2: #2671f4;
  --chart-3: #747474;
  --chart-4: #525252;
  --chart-5: #e4e4e4;
  --sidebar: #121212;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #000000;
  --sidebar-accent: #333333;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #333333;
  --sidebar-ring: #a4a4a4;
  --font-sans: Geist, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Geist Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 2px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.18;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow-md: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18);
  --shadow-lg: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18);
  --shadow-xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.45);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --background: #fcfcfc;
  --foreground: #000000;
  --card: #ffffff;
  --card-foreground: #000000;
  --popover: #fcfcfc;
  --popover-foreground: #000000;
  --primary: #000000;
  --primary-foreground: #ffffff;
  --secondary: #ebebeb;
  --secondary-foreground: #000000;
  --muted: #f5f5f5;
  --muted-foreground: #525252;
  --accent: #ebebeb;
  --accent-foreground: #000000;
  --destructive: #e54b4f;
  --destructive-foreground: #ffffff;
  --border: #e4e4e4;
  --input: #ebebeb;
  --ring: #000000;
  --chart-1: #ffae04;
  --chart-2: #2d62ef;
  --chart-3: #a4a4a4;
  --chart-4: #e4e4e4;
  --chart-5: #747474;
  --sidebar: #fcfcfc;
  --sidebar-foreground: #000000;
  --sidebar-primary: #000000;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #ebebeb;
  --sidebar-accent-foreground: #000000;
  --sidebar-border: #ebebeb;
  --sidebar-ring: #000000;
  --font-sans: Geist, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Geist Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 2px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.18;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow-md: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18);
  --shadow-lg: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18);
  --shadow-xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.45);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: #000000;
  --foreground: #ffffff;
  --card: #090909;
  --card-foreground: #ffffff;
  --popover: #121212;
  --popover-foreground: #ffffff;
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: #222222;
  --secondary-foreground: #ffffff;
  --muted: #1d1d1d;
  --muted-foreground: #a4a4a4;
  --accent: #333333;
  --accent-foreground: #ffffff;
  --destructive: #ff5b5b;
  --destructive-foreground: #000000;
  --border: #242424;
  --input: #333333;
  --ring: #a4a4a4;
  --chart-1: #ffae04;
  --chart-2: #2671f4;
  --chart-3: #747474;
  --chart-4: #525252;
  --chart-5: #e4e4e4;
  --sidebar: #121212;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #000000;
  --sidebar-accent: #333333;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #333333;
  --sidebar-ring: #a4a4a4;
  --font-sans: Geist, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Geist Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 2px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.18;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow-md: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18);
  --shadow-lg: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18);
  --shadow-xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.45);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
3. FONTS: the theme uses these fonts: <PASTE FONT NAMES FROM TWEAKCN: sans / serif / mono>.
   - Load them with next/font (next/font/google) in app/layout.tsx, expose them as CSS variables, and map them to the theme's --font-sans, --font-serif and --font-mono (and to Tailwind's font-sans, font-serif and font-mono).
   - Do not load fonts through a <link> tag or @import.
   - Use display: "swap" and only the weights actually needed.
   - Token numbers (TV board, student token page, kitchen) use the sans font at the heaviest loaded weight, with tabular numerals (font-variant-numeric: tabular-nums).

4. STATUS TOKENS: shadcn themes have no status colors. Add --success, --success-foreground, --warning, --warning-foreground, --danger and --danger-foreground for both :root and .dark, and register them in the Tailwind theme so bg-success, text-warning, bg-danger and so on work. Meaning: success = Ready/Given, warning = waiting over 5 minutes, danger = waiting over 10 minutes, payment failed, expired. Pick values that keep contrast at least 4.5:1 against their foreground.

5. USE TOKENS ONLY: go through all components and pages and replace hardcoded colors (hex, rgb, and Tailwind palette classes like bg-red-500 or text-gray-600) with theme tokens (bg-background, text-foreground, bg-card, bg-primary, text-primary-foreground, bg-accent, bg-muted, text-muted-foreground, border, ring, bg-success, bg-warning, bg-danger). No hardcoded hex colors in components.

6. LIGHT AND DARK PER SCREEN: student pages and /staff/cashier use the light theme. /staff/kitchen, /tv/board, /tv/menu and /entrance always use the dark theme, by wrapping their layouts in a div with the "dark" class. /staff/counter uses the light theme with high contrast. Do not switch the whole app to dark, and do not add a theme toggle.

7. CHECK:
   - Run typecheck, lint and the existing tests.
   - Start the app and use Playwright to screenshot /login, /menu/[canteenId], /orders/[id], /staff/cashier, /staff/counter, /staff/kitchen, /tv/board and /entrance at 390px, 1024px and 1920px.
   - Look at the screenshots. Fix any text that is hard to read on the primary color or on dark backgrounds, any fallback-font flash, and any leftover default shadcn gray.
   - Tell me the final primary, accent, background, success, warning and danger values, and the fonts in use.
   - Commit.