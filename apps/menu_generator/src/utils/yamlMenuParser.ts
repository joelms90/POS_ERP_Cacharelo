import * as yaml from 'js-yaml';
import type { MenuCatalog, MenuSection, Dish } from '../types/menu';

/**
 * Raw YAML schema as provided by user
 */
export interface RawYamlMenu {
  menu?: {
    restaurant?: string;
    currency?: string;
    logo?: string;
    slogan?: string;
    contact?: string;
    cover?: {
      enabled?: boolean;
      title?: string;
      subtitle?: string;
      slogan?: string;
      footer?: string;
      tagline?: string;
      backgroundImage?: string;
      cardMode?: 'floating-card' | 'full-bleed' | 'framed';
      style?: 'minimal-gold' | 'wood-table' | 'dark-luxury' | 'editorial-clean';
      backgroundOverlayOpacity?: number;
      backgroundBlur?: number;
    };
    theme?: {
      name?: string;
      pageBackground?: string;
      textColor?: string;
      accentColor?: string;
      secondaryColor?: string;
      borderColor?: string;
      headingFont?: any;
      bodyFont?: any;
      cardStyle?: any;
      dishBackdrop?: any;
      pageSize?: 'letter' | 'a4';
      showPageNumbers?: boolean;
    };
    categories?: Array<{
      id?: string;
      name?: string;
      subtitle?: string;
      description?: string;
      review_required?: boolean;
      notes?: string | string[];
      dishes?: Array<{
        id?: string;
        name?: string | null;
        description?: string | null;
        price?: number | null;
        image?: string;
        review_required?: boolean;
        notes?: string;
      }>;
    }>;
  };
}

/**
 * Map relative image paths to available public assets
 */
export function resolveDishImage(imagePath?: string): string | undefined {
  if (!imagePath) return undefined;

  const normalized = imagePath.toLowerCase();

  if (normalized.includes('capresse') || normalized.includes('caprese')) {
    return '/dishes/caprese_plate.png';
  }
  if (normalized.includes('cesar-con-pollo') || normalized.includes('pollo')) {
    return '/dishes/cesar_pollo.png';
  }
  if (normalized.includes('cesar')) {
    return '/dishes/cesar_salad.png';
  }
  if (normalized.includes('revueltos') || normalized.includes('huevos') || normalized.includes('omelette')) {
    return '/dishes/huevos_board.png';
  }
  if (normalized.includes('waffle') || normalized.includes('wafles')) {
    return '/dishes/wafles.png';
  }
  if (normalized.includes('fruta') || normalized.includes('yogurt')) {
    return '/dishes/fruta_bowl.png';
  }
  if (normalized.includes('croissant') || normalized.includes('chocolatin')) {
    return '/dishes/croissant.png';
  }
  if (normalized.includes('sandwich') || normalized.includes('club') || normalized.includes('croque')) {
    return '/dishes/sandwich.png';
  }
  if (normalized.includes('bagel') || normalized.includes('salmon')) {
    return '/dishes/bagel.png';
  }
  if (normalized.includes('focaccia') || normalized.includes('baguette')) {
    return '/dishes/foccacia.png';
  }

  if (imagePath.startsWith('/') || imagePath.startsWith('http')) {
    return imagePath;
  }

  return imagePath;
}

/**
 * Parses a YAML string into a full MenuCatalog
 */
export function parseMenuYaml(yamlString: string, currentCatalog?: MenuCatalog): MenuCatalog {
  const parsed = yaml.load(yamlString) as RawYamlMenu;

  const menuObj = parsed?.menu;
  const restaurantName = menuObj?.restaurant || currentCatalog?.restaurant?.name || 'Cacharelo';
  const rawCategories = menuObj?.categories || [];

  const sections: MenuSection[] = rawCategories.map((cat, idx: number) => {
    const rawDishes = cat.dishes || [];
    const dishes: Dish[] = rawDishes.map((d, dIdx: number) => {
      const dishName = d.name ? d.name.trim() : (d.notes ? `PLATILLO #${dIdx + 1}` : 'ESPECIALIDAD');
      const resolvedImg = resolveDishImage(d.image);

      return {
        id: d.id || `dish-${cat.id || idx}-${dIdx}`,
        name: dishName,
        description: d.description ? d.description.trim() : undefined,
        price: d.price ?? null,
        image: resolvedImg,
        imageMode: 'transparent',
        imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 },
        review_required: d.review_required,
        notes: d.notes,
        tags: d.review_required ? ['Revisar'] : undefined
      };
    });

    let layoutTemplate: MenuSection['layoutTemplate'] = 'auto';
    if (dishes.length === 1) layoutTemplate = 'hero-one';
    else if (dishes.length === 2) layoutTemplate = 'diagonal-two';
    else if (dishes.length === 3) layoutTemplate = 'editorial-three';
    else if (dishes.length === 4) layoutTemplate = 'editorial-four';
    else layoutTemplate = 'dense-list';

    return {
      id: cat.id || `sec-${idx}`,
      name: cat.name || 'CATEGORÍA',
      subtitle: cat.subtitle || undefined,
      description: cat.description || undefined,
      notes: cat.notes,
      review_required: cat.review_required,
      layoutTemplate,
      dishes
    };
  });

  return {
    version: '1.0.0',
    id: 'cacharelo-yaml-imported',
    title: `Menú ${restaurantName}`,
    restaurant: {
      name: restaurantName,
      logo: menuObj?.logo || currentCatalog?.restaurant?.logo || '/branding/cacharelo-cofee-gold-logo.png',
      slogan: menuObj?.slogan || currentCatalog?.restaurant?.slogan || 'Buen café, grandes momentos',
      contact: menuObj?.contact || currentCatalog?.restaurant?.contact || 'cafecacharelo.com',
      currency: menuObj?.currency || 'MXN'
    },
    cover: menuObj?.cover ? {
      enabled: menuObj.cover.enabled ?? true,
      title: menuObj.cover.title ?? '',
      subtitle: menuObj.cover.subtitle ?? '',
      slogan: menuObj.cover.slogan ?? 'BUEN CAFÉ, GRANDES MOMENTOS',
      footer: menuObj.cover.footer ?? 'DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS',
      tagline: menuObj.cover.tagline ?? 'Aquí sabe mejor',
      backgroundImage: menuObj.cover.backgroundImage ?? '/backgrounds/cafe-interior-cover.png',
      cardMode: menuObj.cover.cardMode ?? 'full-bleed',
      style: menuObj.cover.style ?? 'minimal-gold',
      backgroundOverlayOpacity: menuObj.cover.backgroundOverlayOpacity ?? 0.25,
      backgroundBlur: menuObj.cover.backgroundBlur ?? 0
    } : (currentCatalog?.cover || {
      enabled: true,
      title: '',
      subtitle: '',
      slogan: 'BUEN CAFÉ, GRANDES MOMENTOS',
      footer: 'DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS',
      tagline: 'Aquí sabe mejor',
      backgroundImage: '/backgrounds/cafe-interior-cover.png',
      cardMode: 'full-bleed',
      backgroundOverlayOpacity: 0.25,
      backgroundBlur: 0,
      style: 'minimal-gold'
    }),
    theme: menuObj?.theme ? {
      name: menuObj.theme.name ?? 'Cacharelo Imperial',
      pageBackground: menuObj.theme.pageBackground ?? '#FAF7F2',
      textColor: menuObj.theme.textColor ?? '#2D2926',
      accentColor: menuObj.theme.accentColor ?? '#C8A265',
      secondaryColor: menuObj.theme.secondaryColor ?? '#5C5449',
      borderColor: menuObj.theme.borderColor ?? '#C8A265',
      headingFont: menuObj.theme.headingFont ?? 'cormorant',
      bodyFont: menuObj.theme.bodyFont ?? 'montserrat',
      cardStyle: menuObj.theme.cardStyle ?? 'cacharelo-classic',
      dishBackdrop: menuObj.theme.dishBackdrop ?? 'soft-shadow',
      pageSize: menuObj.theme.pageSize ?? 'letter',
      showPageNumbers: menuObj.theme.showPageNumbers ?? true
    } : (currentCatalog?.theme || {
      name: 'Cacharelo Imperial',
      pageBackground: '#FAF7F2',
      textColor: '#2D2926',
      accentColor: '#C8A265',
      secondaryColor: '#5C5449',
      borderColor: '#C8A265',
      headingFont: 'cormorant',
      bodyFont: 'montserrat',
      cardStyle: 'cacharelo-classic',
      dishBackdrop: 'soft-shadow',
      pageSize: 'letter',
      showPageNumbers: true
    }),
    sections: sections.length > 0 ? sections : (currentCatalog?.sections || [])
  };
}

/**
 * Exports current MenuCatalog back to clean YAML format
 */
export function exportMenuToYaml(catalog: MenuCatalog): string {
  const exportObject: any = {
    menu: {
      restaurant: catalog.restaurant.name,
      currency: catalog.restaurant.currency || 'MXN',
      logo: catalog.restaurant.logo || undefined,
      slogan: catalog.restaurant.slogan || undefined,
      contact: catalog.restaurant.contact || undefined,
      cover: catalog.cover.enabled ? {
        enabled: catalog.cover.enabled,
        title: catalog.cover.title || '',
        subtitle: catalog.cover.subtitle || '',
        slogan: catalog.cover.slogan || 'BUEN CAFÉ, GRANDES MOMENTOS',
        footer: catalog.cover.footer || 'DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS',
        tagline: catalog.cover.tagline || 'Aquí sabe mejor',
        backgroundImage: catalog.cover.backgroundImage || '/backgrounds/cafe-interior-cover.png',
        cardMode: catalog.cover.cardMode || 'full-bleed',
        style: catalog.cover.style || 'minimal-gold',
        backgroundOverlayOpacity: catalog.cover.backgroundOverlayOpacity ?? 0.25,
        backgroundBlur: catalog.cover.backgroundBlur ?? 0
      } : { enabled: false },
      theme: {
        name: catalog.theme.name,
        pageSize: catalog.theme.pageSize, // 'letter' (Carta 21.6 x 27.9 cm) o 'a4' (21.0 x 29.7 cm)
        pageBackground: catalog.theme.pageBackground,
        textColor: catalog.theme.textColor,
        accentColor: catalog.theme.accentColor,
        secondaryColor: catalog.theme.secondaryColor,
        borderColor: catalog.theme.borderColor,
        headingFont: catalog.theme.headingFont,
        bodyFont: catalog.theme.bodyFont,
        cardStyle: catalog.theme.cardStyle,
        dishBackdrop: catalog.theme.dishBackdrop,
        showPageNumbers: catalog.theme.showPageNumbers
      },
      categories: catalog.sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        subtitle: sec.subtitle || null,
        description: sec.description || null,
        review_required: sec.review_required || undefined,
        notes: sec.notes || undefined,
        dishes: sec.dishes.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description || null,
          price: d.price ?? null,
          image: d.image || undefined,
          review_required: d.review_required || undefined,
          notes: d.notes || undefined
        }))
      }))
    }
  };

  return yaml.dump(exportObject, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });
}
