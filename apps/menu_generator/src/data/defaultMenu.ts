import type { MenuCatalog } from "../types/menu";

export const CACHARELO_MENU_PRESET: MenuCatalog = {
  version: "1.0.0",
  id: "cacharelo-cafeteria",
  title: "Menú Cafetería Cacharelo",
  restaurant: {
    name: "Cacharelo",
    logo: "/branding/cacharelo-cofee-gold-logo.png",
    slogan: "Buen café, grandes momentos",
    contact: "cafecacharelo.com · @cafecacharelocafe",
    currency: "MXN"
  },
  cover: {
    enabled: true,
    title: "",
    subtitle: "",
    slogan: "BUEN CAFÉ, GRANDES MOMENTOS",
    footer: "DESAYUNOS  •  COMIDAS  •  CAFÉ  •  MOMENTOS",
    tagline: "Aquí sabe mejor",
    backgroundImage: "/backgrounds/cafe-interior-cover.png",
    cardMode: "full-bleed",
    backgroundOverlayOpacity: 0.25,
    style: "minimal-gold"
  },
  theme: {
    name: "Cacharelo Imperial",
    pageBackground: "#FAF7F2",
    textColor: "#2D2926",
    accentColor: "#C8A265",
    secondaryColor: "#5C5449",
    borderColor: "#C8A265",
    headingFont: "cormorant",
    bodyFont: "montserrat",
    cardStyle: "cacharelo-classic",
    dishBackdrop: "soft-shadow",
    pageSize: "letter",
    showPageNumbers: true
  },
  sections: [
    {
        "id": "ensaladas",
        "kicker": "NUESTRA COCINA, TU MOMENTO",
        "quote": "“Comer bien también es un placer”",
        "name": "ENSALADAS",
        "subtitle": "Frescura en cada bocado",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "capresse",
                "name": "CAPRESSE",
                "description": "Rodajas de jitomate y queso mozzarella fresco marinadas con vinagre balsámico y nuestra mezcla italiana.",
                "price": 177,
                "image": "/dishes/caprese_plate.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "cesar",
                "name": "CESAR",
                "description": "Lechuga aderezada acompañada de croutones, huevo cocido y queso parmesano rallado.",
                "price": 162,
                "image": "/dishes/cesar_salad.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "cesar-con-pollo",
                "name": "CESAR CON POLLO",
                "description": "Lechuga aderezada acompañada de croutones, huevo cocido, queso parmesano rallado y pechuga de pollo a la italiana.",
                "price": 189,
                "image": "/dishes/cesar_pollo.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "del-chef",
                "name": "DEL CHEF",
                "description": "Lechuga con nuestra vinagreta de cítricos acompañada de jamónjj, queso manchego, pechuga de pollo y huevo cocido.",
                "price": 185,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "waldorf",
                "name": "WALDORF",
                "description": "Lechuga aderezada acompañada de manzana, blueberries, nuez pecana, queso mozzarella fresco y apio.",
                "price": 175,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "desayunos-huevos-al-gusto",
        "kicker": "DESAYUNOS ARTESANALES",
        "quote": "“El aroma que despierta tus mañanas”",
        "name": "DESAYUNOS",
        "subtitle": "Huevos al gusto",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "revueltos-con-jamon",
                "name": "REVUELTOS CON JAMÓN",
                "description": "Acompañados de pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 166,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "revueltos-con-tocino",
                "name": "REVUELTOS CON TOCINO",
                "description": "Acompañados de pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 166,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "revueltos-a-la-mexicana",
                "name": "REVUELTOS A LA MEXICANA",
                "description": "Con cebolla, jitomate y chile picado, acompañado con pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 166,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "huevos-benedictinos",
                "name": "HUEVOS BENEDICTINOS",
                "description": "Huevos pochés servidos en bagel con dip de queso y jamón, bañados con salsa holandesa, con un toque de parmesano y perejil.",
                "price": 194,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "huevos-cacharelo",
                "name": "HUEVOS CACHARELO",
                "description": "Huevos pochés sobre salsa pomodoro con queso mozzarella fresco y un toque picante, bañados en salsa holandesa con parmesano y albahaca, acompañados con pan tostado.",
                "price": 212,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "espinacas-y-queso",
                "name": "OMELETTE DE ESPINACAS Y QUESO",
                "description": "Acompañado de pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 185,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "champinones-y-queso",
                "name": "OMELETTE DE CHAMPIÑONES Y QUESO",
                "description": "Acompañado de pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 178,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "claras-espinaca-panela",
                "name": "OMELETTE DE CLARAS CON ESPINACA Y QUESO PANELA",
                "description": "Acompañados de pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 180,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "omelette-jamon-queso",
                "name": "OMELETTE DE JAMÓN Y QUESO",
                "description": "Acompañado de pan tostado, aguacate y frijoles maneados de la casa.",
                "price": 178,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "desayunos-especialidades",
        "kicker": "DE LA CASA",
        "quote": "“Tradición y sabor en cada receta”",
        "name": "DESAYUNOS",
        "subtitle": "Especialidades",
        "layoutTemplate": "diagonal-two",
        "dishes": [
            {
                "id": "mineras",
                "name": "MINERAS",
                "description": "Rellenas de pollo, bañadas con salsa verde de la casa y acompañadas de crema, queso panela, cebolla y aguacate.",
                "price": 175,
                "image": "/dishes/foccacia.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "chilaquiles-cacharelo",
                "name": "CHILAQUILES CACHARELO",
                "description": "Verdes con pollo, huevos fritos, crema, queso y cebolla.",
                "price": 196,
                "image": "/dishes/huevos_board.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "waffles-belgas",
        "kicker": "DULCE DESPERTAR",
        "quote": "“Crujientes por fuera, suaves por dentro”",
        "name": "DESAYUNOS",
        "subtitle": "Waffles belgas",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "waffle-fresa-crema",
                "name": "CON FRESA Y CREMA",
                "price": 141,
                "image": "/dishes/wafles.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "waffle-nutella",
                "name": "CON PLÁTANO Y NUTELLA",
                "price": 129,
                "image": "/dishes/wafles.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "waffle-frutos-rojos",
                "name": "CON FRUTOS ROJOS",
                "price": 129,
                "image": "/dishes/wafles.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "waffles-belgas",
        "kicker": "DULCE DESPERTAR",
        "quote": "",
        "name": "DESAYUNOS",
        "subtitle": "BOWLS DE FRUTA",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "bowl-yogurt",
                "name": "MIXTO",
                "description": "Fruta de temporada acompañada de miel de abeja, yogurt y granola.",
                "price": 135,
                "image": "/dishes/wafles.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "bowl-yogurt",
                "name": "CON YOGURT",
                "description": "Fruta de temporada acompañada de miel de abeja, yogurt y granola.",
                "price": 148,
                "image": "/dishes/wafles.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "bowl-frutos-rojos",
                "name": "DE FRUTOS ROJOS",
                "description": "Mix de berries: blueberries, zarzamoras, frambuesas y fresas, acompañadas de queso cottage.",
                "price": 178,
                "image": "/dishes/wafles.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
        ]
    },
    {
        "id": "croissant",
        "kicker": "PANADERÍA FRANCESA",
        "quote": "“El arte del hojaldre con mantequilla”",
        "name": "CROISSANT",
        "layoutTemplate": "editorial-three",
        "dishes": [
            {
                "id": "croissant-jamon-queso",
                "name": "DE JAMÓN Y QUESO",
                "description": "Preparado con jitomate horneado a las finas hierbas, lechuga y nuestro aderezo de mayonesa chipotle.",
                "price": 135,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "croissant-huevo-tocino",
                "name": "DE HUEVO CON TOCINO",
                "description": "Preparado con jitomate horneado a las finas hierbas, queso panela y aderezo de mayonesa chipotle.",
                "price": 147,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "croissant-italiano",
                "name": "ITALIANO",
                "description": "Relleno de queso mozzarella fresco, jitomate a las finas hierbas y lechuga con vinagre balsámico y aceite de oliva.",
                "price": 147,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            }
        ]
    },
    {
        "id": "sandwiches",
        "kicker": "CLÁSICOS & CONTEMPORÁNEOS",
        "quote": "“Sabor artesanal en cada capa”",
        "name": "SANDWICHES",
        "layoutTemplate": "editorial-four",
        "dishes": [
            {
                "id": "cacharelo-club",
                "name": "CACHARELO CLUB",
                "description": "De dos pisos, pan tostado preparado con jamón, queso machego, jitomate horneado, pollo a las finas hierbas, huevo frito, tocino y lechuga marinada con vinagre balsámico.",
                "price": 205,
                "image": "/dishes/sandwich.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "croque-monsieur",
                "name": "CROQUE MONSIEUR",
                "description": "De dos pisos, pan tostado relleno de jamón y queso manchego gratinado.",
                "price": 142,
                "image": "/dishes/sandwich.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "croque-madame",
                "name": "CROQUE MADAME",
                "description": "De dos pisos, pan tostado relleno de jamón y queso manchego gratinado con un huevo frito encima.",
                "price": 160,
                "image": "/dishes/sandwich.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "montecristo",
                "name": "MONTECRISTO",
                "description": "De dos pisos, capeado, relleno de jamón, queso manchego, pollo y jitomate horneado a las finas hierbas.",
                "price": 172,
                "image": "/dishes/sandwich.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "baguettes",
        "kicker": "HORNEADAS AL DÍA",
        "quote": "“La textura perfecta en cada bocado”",
        "name": "BAGUETTES",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "baguette-pollo-cajun",
                "name": "POLLO CAJÚN",
                "description": "Acompañada de queso mozzarella fresco, jitomate horneado a las finas hierbas y lechuga marinada con vinagre balsámico.",
                "price": 180,
                "image": "/dishes/cesar_pollo.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "baguette-arrachera",
                "name": "DE ARRACHERA",
                "description": "Con frijoles maneados, cebolla caramelizada, queso manchego, aderezo de mayonesa chipotle y jitomate.",
                "price": 200,
                "image": "/dishes/foccacia.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "baguette-jamon-queso",
                "name": "DE JAMÓN Y QUESO",
                "description": "Acompañado de jitomate horneado, lechuga marinada con vinagre balsámico y aderezo de mayonesa chipotle.",
                "price": 160,
                "image": "/dishes/foccacia.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "baguette-tres-quesos",
                "name": "A LOS 3 QUESOS",
                "description": "Con queso mozzarella fresco, queso panela y queso manchego.",
                "price": 170,
                "image": "/dishes/foccacia.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
        ]
    },
    {
        "id": "bagels",
        "kicker": "ESPECIALIDADES DE LA CASA",
        "quote": "“Dorado, esponjoso y lleno de sabor”",
        "name": "BAGELS",
        "notes": "El encabezado de esta sección no aparece claramente en el OCR, pero los productos parecen corresponder a una sección distinta de baguettes.\n",
        "review_required": true,
        "layoutTemplate": "editorial-three",
        "dishes": [
            {
                "id": "bagel-jamon-queso",
                "name": "DE JAMÓN Y QUESO",
                "description": "Acompañado de jitomate a las finas hierbas, lechuga marinada con vinagre balsámico y dip de queso.",
                "price": 155,
                "image": "/dishes/bagel.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "bagel-salmon-ahumado",
                "name": "DE SALMÓN AHUMADO",
                "description": "Con queso mozzarella fresco, jitomate a las finas hierbas, lechuga marinada con vinagre balsámico y dip de queso.",
                "price": 218,
                "image": "/dishes/bagel.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "bagel-fresa-nutella",
                "name": "DE FRESA CON NUTELLA",
                "description": "Con queso crema.",
                "price": 145,
                "image": "/dishes/bagel.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "pan-artesanal",
        "kicker": "REPOSTERÍA DE LA CASA",
        "quote": "“El dulce placer de compartir”",
        "name": "PAN ARTESANAL",
        "notes": "Nuestro pan artesanal es horneado al día, todos con un toque de azúcar glass.",
        "description": "Nuestro pan artesanal es horneado al día, todos con un toque de azúcar glass.",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "croissant-natural",
                "name": "CROISSANT",
                "price": 53,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "croissant-almendra",
                "name": "CROISSANT DE ALMENDRA",
                "price": 65,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "chocolatin",
                "name": "CHOCOLATÍN",
                "price": 65,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "rol-canela",
                "name": "ROL DE CANELA",
                "price": 59,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "croissant-nutella-queso",
                "name": "CROISSANT RELLENO DE NUTELLA CON QUESO",
                "price": 145,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "croissant-frutos-rojos",
                "name": "CROISSANT RELLENO DE FRUTOS ROJOS",
                "price": 85,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "croissant-pina",
                "name": "CROISSANT RELLENO DE PIÑA",
                "price": 88,
                "image": "/dishes/croissant.png",
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            }
        ]
    },
    {
        "id": "extras",
        "kicker": "AL GUSTO",
        "quote": "“Personaliza tus alimentos y bebidas”",
        "name": "EXTRAS",
        "review_required": true,
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "dish-extras-0",
                "name": "AGUACATE 80 GR",
                "price": 40,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-1",
                "name": "FRAMBUESA",
                "price": 30,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-2",
                "name": "CAFÉ SHOT 2 OZ",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-3",
                "name": "ARRACHERA",
                "price": 45,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-4",
                "name": "MELÓN",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-5",
                "name": "FRESA",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-6",
                "name": "PIÑA",
                "price": 15,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-7",
                "name": "LECHE 2 OZ",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-8",
                "name": "TOCINO",
                "price": 40,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-9",
                "name": "JUGO DE LIMÓN",
                "price": 15,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-10",
                "name": "LECHE DE AVENA",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-11",
                "name": "HUEVO",
                "price": 15,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-12",
                "name": "YOGURT",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-13",
                "name": "LECHE DE ALMENDRA",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-14",
                "name": "FRIJOLES MANEADOS",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-15",
                "name": "JITOMATE A LAS FINAS HIERBAS",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-16",
                "name": "GRANOLA",
                "price": 15,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-17",
                "name": "PAN TOSTADO 2 PZ",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-18",
                "name": "DIP DE QUESO",
                "price": 30,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-19",
                "name": "CREMA BATIDA",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-20",
                "name": "PAN BAGUETTE",
                "price": 40,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-21",
                "name": "JAMÓN",
                "price": 30,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-22",
                "name": "MERMELADA DE FRUTOS ROJOS",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-23",
                "name": "JARABE VAINILLA",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-24",
                "name": "QUESO MANCHEGO",
                "price": 30,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-25",
                "name": "MERMELADA DE PIÑA",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-26",
                "name": "QUESO MOZZARELLA",
                "price": 45,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-27",
                "name": "JARABE CARAMELO",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-28",
                "name": "NUTELLA",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-29",
                "name": "MIEL",
                "price": 15,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-30",
                "name": "JARABE AMARETTO",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-31",
                "name": "FRUTOS ROJOS",
                "price": 45,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-32",
                "name": "BLUEBERRIES",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-33",
                "name": "CHAMPIÑÓN",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-34",
                "name": "ZARZAMORA",
                "price": 25,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-35",
                "name": "Espinaca",
                "price": 20,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-36",
                "name": "Pollo",
                "price": 30,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-37",
                "name": "Crema",
                "price": 15,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-extras-38",
                "name": "Queso panela",
                "price": 30,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },

        ]
    },
    {
        "id": "bebidas-calientes",
        "kicker": "CAFETERÍA DE ESPECIALIDAD",
        "quote": "“Buen café, grandes momentos”",
        "name": "BEBIDAS",
        "subtitle": "Calientes",
        "notes": [
            "Preparamos su bebida con leche entera o deslactosada sin costo extra.",
            "Leches vegetales con costo extra: almendra y avena."
        ],
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "espresso-sencillo",
                "name": "ESPRESSO SENCILLO",
                "price": 40,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "espresso-doble",
                "name": "ESPRESSO DOBLE",
                "price": 62,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "sencillo-cortado",
                "name": "SENCILLO CORTADO",
                "price": 56,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "doble-cortado",
                "name": "DOBLE CORTADO",
                "price": 68,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
            },
            {
                "id": "americano",
                "name": "AMERICANO",
                "price": 99,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "capuccino-caliente",
                "name": "CAPUCCINO",
                "price": 92,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "chocolate-caliente",
                "name": "CHOCOLATE",
                "price": 100,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "latte-caliente",
                "name": "LATTE",
                "price": 101,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "moka-caliente",
                "name": "MOKA",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "flat-white",
                "name": "FLAT WHITE",
                "price": 102,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            }
        ]
    },
    {
        "id": "tes",
        "kicker": "INFUSIONES DEL MUNDO",
        "quote": "“Momentos de calma y bienestar”",
        "name": "TÉS",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "te-sabores",
                "name": "TÉ DE SABORES",
                "description": "Jengibre, jamaica, limón, manzanilla, menta y manzana/anís.",
                "price": 92,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "chai",
                "name": "CHAI",
                "price": 111,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "te-negro",
                "name": "TÉ NEGRO",
                "price": 104,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "tizana-frutos",
                "name": "TIZANA DE FRUTOS",
                "price": 104,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "tizana-manzana",
                "name": "TIZANA DE MANZANA",
                "price": 104,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "bebidas-frias",
        "kicker": "REFRÉSCATE",
        "quote": "“El balance perfecto en frío”",
        "name": "BEBIDAS",
        "subtitle": "Frías",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "dish-bebidas-frias-0",
                "name": "CAPUCCINO",
                "price": 108,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-bebidas-frias-1",
                "name": "CHOCOLATE",
                "price": 109,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-bebidas-frias-2",
                "name": "LATTE",
                "price": 109,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-bebidas-frias-3",
                "name": "MOKA",
                "price": 111,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-bebidas-frias-4",
                "name": "MATCHA",
                "price": 121,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "frappes",
        "kicker": "MOMENTO FRAPPÉ",
        "quote": "“Cremosos, refrescantes y deliciosos”",
        "name": "FRAPPÉ",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "dish-frappes-0",
                "name": "CAFÉ",
                "price": 108,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-frappes-1",
                "name": "CAPUCCINO",
                "price": 121,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-frappes-2",
                "name": "MOKA",
                "price": 121,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-frappes-3",
                "name": "MATCHA",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "dish-frappes-4",
                "name": "CHOCOLATE",
                "price": 119,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            }
        ]
    },
    {
        "id": "smoothies",
        "kicker": "100% NATURAL",
        "quote": "“Energía pura y natural”",
        "name": "SMOOTHIES",
        "layoutTemplate": "editorial-three",
        "dishes": [
            {
                "id": "smoothie-mango",
                "name": "MANGO",
                "description": "A base de agua.",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "smoothie-platano",
                "name": "PLÁTANO",
                "description": "A base de leche.",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "smoothie-frutos-rojos",
                "name": "FRUTOS ROJOS",
                "description": "A base de leche.",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            }
        ]
    },
    {
        "id": "jugos",
        "kicker": "PRENSADOS AL MOMENTO",
        "quote": "“Frescura pura de la huerta a tu mesa”",
        "name": "JUGOS",
        "description": "Nuestros jugos son 100% naturales.",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "jugo-naranja",
                "name": "NARANJA",
                "price": 71,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "jugo-verde",
                "name": "VERDE",
                "description": "Apio, piña, nopal, espinaca y naranja.",
                "price": 97,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "jugo-detox",
                "name": "DETOX",
                "description": "Mix de berries con naranja.",
                "price": 108,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "jugo-extra",
                "name": "JUGO CHAMOY & TAJÍN",
                "description": "Con chamoy y Tajín.",
                "price": 111,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "jugo-extra-123",
                "name": "JUGO ESPECIAL",
                "price": 123,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            }
        ]
    },
    {
        "id": "refrescos",
        "kicker": "BEBIDAS",
        "quote": "“Acompaña tus alimentos favoritos”",
        "name": "REFRESCOS",
        "layoutTemplate": "dense-list",
        "dishes": [
            {
                "id": "dish-refrescos-0",
                "name": "COCA-COLA",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-refrescos-1",
                "name": "COCA-COLA ZERO",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-refrescos-2",
                "name": "SPRITE",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-refrescos-3",
                "name": "FANTA",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-refrescos-4",
                "name": "MUNDET",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-refrescos-5",
                "name": "TOPO CHICO",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            },
            {
                "id": "dish-refrescos-6",
                "name": "AGUA FIEL 500 ML",
                "price": null,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    },
    {
        "id": "agua-zoe",
        "kicker": "HIDRATACIÓN",
        "quote": "“Equilibrio y pureza en cada gota”",
        "name": "AGUA ZOE",
        "layoutTemplate": "diagonal-two",
        "dishes": [
            {
                "id": "agua-zoe-500",
                "name": "AGUA ZOE 500 ML",
                "price": 47,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                },
                "review_required": true,
                "tags": [
                    "Revisar"
                ]
            },
            {
                "id": "agua-zoe-twist",
                "name": "AGUA ZOE TWIST SABORES",
                "description": "Esencia de frutos rojos, mandarina o sandía con hierbabuena.",
                "price": 47,
                "imageMode": "transparent",
                "imageTransform": {
                    "scale": 1,
                    "x": 0,
                    "y": 0,
                    "rotation": 0
                }
            }
        ]
    }
]
};

export const HAMBURGUESAS_MENU_PRESET: MenuCatalog = {
  version: "1.0.0",
  id: "mr-cacharelo-burger",
  title: "Mr. Cacharelo Hamburguesas",
  restaurant: {
    name: "Mr. Cacharelo",
    logo: "/branding/hamburguesas-logo.png",
    slogan: "Hamburguesas Al Carbón & Malteadas",
    contact: "55 1234 5678",
    currency: "MXN"
  },
  cover: {
    enabled: true,
    title: "MR. CACHARELO",
    subtitle: "Burgers & Grill",
    slogan: "Sabor auténtico al carbón",
    footer: "Carne 100% Angus · Pan Brioche Artesanal",
    style: "dark-luxury"
  },
  theme: {
    name: "Burger Dark Rustic",
    pageBackground: "#1C1917",
    textColor: "#F5F5F4",
    accentColor: "#F59E0B",
    secondaryColor: "#A8A29E",
    borderColor: "#78350F",
    headingFont: "cinzel",
    bodyFont: "montserrat",
    cardStyle: "cacharelo-classic",
    dishBackdrop: "white-ring",
    pageSize: "letter",
    showPageNumbers: true
  },
  sections: [
    {
      id: "sec-burgers",
      name: "HAMBURGUESAS ESPECIALES",
      subtitle: "Todas acompañadas de papas a la francesa sazonadas",
      layoutTemplate: "editorial-three",
      dishes: [
        {
          id: "burger-clasica",
          name: "Cacharelo Suprema",
          description: "200g carne Angus, queso cheddar añejo, tocino ahumado, aros de cebolla y salsa BBQ de la casa.",
          price: 189,
          image: "/dishes/sandwich.png",
          imageMode: "transparent",
          imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 },
          featured: true
        },
        {
          id: "burger-suiza",
          name: "Champiñones & Provolone",
          description: "Pechuga a la parrilla o res con salteado de hongos silvestres al vino blanco y queso derretido.",
          price: 195,
          image: "/dishes/foccacia.png",
          imageMode: "transparent",
          imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
        }
      ]
    }
  ]
};

export const PASTES_MENU_PRESET: MenuCatalog = {
  version: "1.0.0",
  id: "pastes-cacharelo",
  title: "Pastes y Empanadas Cacharelo",
  restaurant: {
    name: "Pastes Cacharelo",
    logo: "/branding/pastes-logo.png",
    slogan: "Tradición en cada bocado",
    contact: "Horneados diariamente",
    currency: "MXN"
  },
  cover: {
    enabled: true,
    title: "PASTES & EMPANADAS",
    subtitle: "Recetas Tradicionales de la Casa",
    slogan: "Horneados al momento",
    footer: "Cacharelo · Sabor y Tradición",
    style: "minimal-gold"
  },
  theme: {
    name: "Pastes Clásico",
    pageBackground: "#FAF6ED",
    textColor: "#291F18",
    accentColor: "#C2782A",
    secondaryColor: "#6B5749",
    borderColor: "#C2782A",
    headingFont: "playfair",
    bodyFont: "montserrat",
    cardStyle: "cacharelo-classic",
    dishBackdrop: "soft-shadow",
    pageSize: "letter",
    showPageNumbers: true
  },
  sections: [
    {
      id: "sec-pastes-salados",
      name: "PASTES SALADOS TRADICIONALES",
      subtitle: "Masa hojaldrada rellena de los mejores guisados",
      layoutTemplate: "diagonal-two",
      dishes: [
        {
          id: "paste-papa",
          name: "Paste Tradicional de Papa con Carne",
          description: "Carne de res molida con papa, cebolla finamente picada, perejil y un toque de chile serrano.",
          price: 32,
          image: "/dishes/croissant.png",
          imageMode: "transparent",
          imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 },
          featured: true
        },
        {
          id: "paste-tinga",
          name: "Paste de Tinga Poblana",
          description: "Pechuga de pollo deshebrada en caldillo de jitomate con chipotle y cebolla caramelizada.",
          price: 32,
          image: "/dishes/bagel.png",
          imageMode: "transparent",
          imageTransform: { scale: 1, x: 0, y: 0, rotation: 0 }
        }
      ]
    }
  ]
};

export const MENU_PRESETS: Record<string, MenuCatalog> = {
  cacharelo: CACHARELO_MENU_PRESET,
  burgers: HAMBURGUESAS_MENU_PRESET,
  pastes: PASTES_MENU_PRESET
};
