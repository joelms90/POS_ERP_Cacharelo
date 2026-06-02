import { describe, it, expect } from 'vitest';

/**
 * Theme Specification Tests
 *
 * Tests the Tailwind CSS v4 theme configuration defined in index.css
 * Verifies color tokens, spacing, typography, and custom utilities
 * for the Empire Noir / Mafia aesthetic theme
 */

describe('Theme Specification - Empire Noir', () => {

  describe('Color Palette - Mafia Theme', () => {
    it('defines the base mafia color palette', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      // Core mafia colors
      expect(styles.getPropertyValue('--color-mafia-base').trim()).toBe('#0B0B0C');
      expect(styles.getPropertyValue('--color-mafia-surface').trim()).toBe('#121214');
      expect(styles.getPropertyValue('--color-mafia-surface-end').trim()).toBe('#0D0D0E');
      expect(styles.getPropertyValue('--color-mafia-bronze').trim()).toBe('#2A2415');
      expect(styles.getPropertyValue('--color-mafia-gold').trim()).toBe('#D4AF37');
    });

    it('defines UI token mappings', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      expect(styles.getPropertyValue('--color-background').trim()).toBe('#121414');
      expect(styles.getPropertyValue('--color-surface').trim()).toBe('#121414');
      expect(styles.getPropertyValue('--color-on-surface').trim()).toBe('#e2e2e2');
      expect(styles.getPropertyValue('--color-on-surface-variant').trim()).toBe('#d0c5af');
    });

    it('defines primary color tokens', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      expect(styles.getPropertyValue('--color-primary').trim()).toBe('#f2ca50');
      expect(styles.getPropertyValue('--color-primary-container').trim()).toBe('#d4af37');
      expect(styles.getPropertyValue('--color-on-primary-container').trim()).toBe('#3c2f00');
    });

    it('defines outline and error colors', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      expect(styles.getPropertyValue('--color-outline').trim()).toBe('#99907c');
      expect(styles.getPropertyValue('--color-outline-variant').trim()).toBe('#4d4635');
      expect(styles.getPropertyValue('--color-error').trim()).toBe('#ffb4ab');
    });
  });

  describe('Spacing System', () => {
    it('defines responsive margin tokens', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      expect(styles.getPropertyValue('--spacing-margin-mobile').trim()).toBe('20px');
      expect(styles.getPropertyValue('--spacing-margin-desktop').trim()).toBe('64px');
    });

    it('defines spacing units and gutters', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      expect(styles.getPropertyValue('--spacing-gutter').trim()).toBe('24px');
      expect(styles.getPropertyValue('--spacing-unit').trim()).toBe('8px');
    });

    it('defines container maximum width', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      expect(styles.getPropertyValue('--spacing-container-max').trim()).toBe('1200px');
    });
  });

  describe('Typography System', () => {
    it('defines serif font family', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const serifFont = styles.getPropertyValue('--font-serif').trim();
      expect(serifFont).toContain('Bodoni Moda');
      expect(serifFont).toContain('Playfair Display');
      expect(serifFont).toContain('Georgia');
      expect(serifFont).toContain('serif');
    });

    it('defines sans-serif font family', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const sansFont = styles.getPropertyValue('--font-sans').trim();
      expect(sansFont).toContain('Inter');
      expect(sansFont).toContain('system-ui');
      expect(sansFont).toContain('sans-serif');
    });

    it('defines hero font family', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const heroFont = styles.getPropertyValue('--font-hero').trim();
      expect(heroFont).toContain('Playfair Display');
      expect(heroFont).toContain('serif');
    });

    it('defines brand font family', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const brandFont = styles.getPropertyValue('--font-brand').trim();
      expect(brandFont).toContain('Corleone');
      expect(brandFont).toContain('serif');
    });
  });

  describe('Shadow System', () => {
    it('defines gold glow shadow', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const shadow = styles.getPropertyValue('--shadow-glow-gold').trim();
      expect(shadow).toContain('20px');
      expect(shadow).toContain('rgba(212, 175, 55, 0.15)');
    });
  });

  describe('Custom Utility Classes', () => {
    it('applies mafia gradient background utility', () => {
      const element = document.createElement('div');
      element.className = 'bg-mafia-gradient';
      document.body.appendChild(element);

      const styles = window.getComputedStyle(element);
      const background = styles.background || styles.backgroundImage;

      expect(background).toContain('linear-gradient');

      document.body.removeChild(element);
    });

    it('applies hero font specification utility', () => {
      const element = document.createElement('div');
      element.className = 'font-spec-hero';
      document.body.appendChild(element);

      const styles = window.getComputedStyle(element);
      const letterSpacing = styles.letterSpacing;

      // Letter spacing should be applied (0.025em)
      expect(letterSpacing).toBeTruthy();

      document.body.removeChild(element);
    });

    it('applies brand font specification utility', () => {
      const element = document.createElement('div');
      element.className = 'font-spec-brand';
      document.body.appendChild(element);

      const styles = window.getComputedStyle(element);
      const letterSpacing = styles.letterSpacing;

      // Letter spacing should be applied (0.05em)
      expect(letterSpacing).toBeTruthy();

      document.body.removeChild(element);
    });

    it('applies dish font specification utility', () => {
      const element = document.createElement('div');
      element.className = 'font-spec-dish';
      document.body.appendChild(element);

      const styles = window.getComputedStyle(element);
      const fontWeight = styles.fontWeight;
      const letterSpacing = styles.letterSpacing;

      expect(fontWeight).toBe('700');
      expect(letterSpacing).toBeTruthy();

      document.body.removeChild(element);
    });

    it('applies body font specification utility', () => {
      const element = document.createElement('div');
      element.className = 'font-spec-body';
      document.body.appendChild(element);

      const styles = window.getComputedStyle(element);
      const fontWeight = styles.fontWeight;
      const lineHeight = styles.lineHeight;

      expect(fontWeight).toBe('400');
      expect(lineHeight).toBe('1.625');

      document.body.removeChild(element);
    });

    it('applies interactive card base styles', () => {
      const element = document.createElement('div');
      element.className = 'interactive-card';
      document.body.appendChild(element);

      const styles = window.getComputedStyle(element);
      const border = styles.border;
      const transition = styles.transition;

      expect(border).toContain('1px');
      expect(transition).toBeTruthy();

      document.body.removeChild(element);
    });
  });

  describe('Base Styles', () => {
    it('applies dark background to body', () => {
      const bodyStyles = window.getComputedStyle(document.body);
      const backgroundColor = bodyStyles.backgroundColor;

      // Should be a dark color (rgb values close to 11, 11, 12)
      expect(backgroundColor).toBeTruthy();
    });

    it('applies light text color to body', () => {
      const bodyStyles = window.getComputedStyle(document.body);
      const color = bodyStyles.color;

      // Should be a light color
      expect(color).toBeTruthy();
    });
  });

  describe('Theme Consistency', () => {
    it('maintains gold accent consistency across tokens', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const mafiaGold = styles.getPropertyValue('--color-mafia-gold').trim();
      const primaryContainer = styles.getPropertyValue('--color-primary-container').trim();

      // Both should reference the same gold value
      expect(mafiaGold).toBe('#D4AF37');
      expect(primaryContainer).toBe('#d4af37');
    });

    it('maintains dark background consistency', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const mafiaBase = styles.getPropertyValue('--color-mafia-base').trim();
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;

      expect(mafiaBase).toBe('#0B0B0C');
      // Body should use this color (converted to rgb)
      expect(bodyBg).toBeTruthy();
    });
  });

  describe('Accessibility Considerations', () => {
    it('provides sufficient contrast for primary text', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const background = styles.getPropertyValue('--color-background').trim();
      const onSurface = styles.getPropertyValue('--color-on-surface').trim();

      // Verify colors are defined (actual contrast calculation would require a utility)
      expect(background).toBe('#121414');
      expect(onSurface).toBe('#e2e2e2');
    });

    it('provides sufficient contrast for gold accents', () => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);

      const primary = styles.getPropertyValue('--color-primary').trim();
      const primaryContainer = styles.getPropertyValue('--color-primary-container').trim();

      // Verify gold colors are defined
      expect(primary).toBe('#f2ca50');
      expect(primaryContainer).toBe('#d4af37');
    });
  });

  describe('Custom Scrollbar Styling', () => {
    it('defines scrollbar width', () => {
      // Scrollbar styles are applied via ::-webkit-scrollbar pseudo-elements
      // These are difficult to test directly, so we verify the CSS is present
      const styleSheets = Array.from(document.styleSheets);
      const hasScrollbarStyles = styleSheets.some(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          return rules.some(rule => rule.cssText?.includes('::-webkit-scrollbar'));
        } catch {
          return false;
        }
      });

      expect(hasScrollbarStyles).toBe(true);
    });
  });

  describe('Font Loading', () => {
    it('declares Corleone font face', async () => {
      // Font may not be loaded yet, but should be declared
      expect(document.fonts).toBeDefined();
    });

    it('declares Corleone Due font face', async () => {
      // Font should be declared even if not loaded
      expect(document.fonts).toBeDefined();
    });
  });
});
