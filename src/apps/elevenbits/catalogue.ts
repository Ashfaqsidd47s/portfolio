/**
 * The sale: every lot's copy, estimate and photographs. Prices are in USD.
 *
 * The photographs are placeholders from Unsplash (free to use under the
 * Unsplash License), credited in `credit`. Swap `photos` for the house's own
 * shots: the first photo is the hero, the rest fill the lot's gallery.
 */

export type Category = "Watches" | "Handbags" | "Jewellery" | "Motor cars" | "Wine & spirits" | "Collectibles"

export const CATEGORIES: Category[] = ["Watches", "Handbags", "Jewellery", "Motor cars", "Wine & spirits", "Collectibles"]

export type Photo = {
  /** An images.unsplash.com path ("photo-…"), or any absolute URL. */
  src: string
  credit: string
  /** Where the subject sits, for crops and the detail views (percent). */
  focus?: [number, number]
}

export type CatalogueLot = {
  id: string
  number: number
  maker: string
  title: string
  /** One line under the title: reference, material, year. */
  subtitle: string
  category: Category
  estimate: [number, number]
  startPrice: number
  reserve: number
  photos: Photo[]
  description: string
  details: [label: string, value: string][]
  provenance: string[]
  condition: string
  location: string
  /** When the lot closes, measured from the opening of the sale. */
  closesAfter: number
  /** Where the room's bidding tends to stop, as a multiple of the high estimate. */
  appetite: number
  /** Bids already on the book when the visitor arrives. */
  openingBids: number
  featured?: boolean
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function photoUrl(src: string, width: number, height?: number) {
  if (/^https?:|^\//.test(src)) return src
  const params = new URLSearchParams({ auto: "format", fit: "crop", w: String(width), q: "80" })
  if (height) params.set("h", String(height))
  return `https://images.unsplash.com/${src}?${params}`
}

export const LOTS: CatalogueLot[] = [
  {
    id: "nautilus-5711",
    number: 1,
    maker: "Patek Philippe",
    title: "Nautilus",
    subtitle: "Ref. 5711/1A-010 · Stainless steel · 2021",
    category: "Watches",
    estimate: [110_000, 150_000],
    startPrice: 80_000,
    reserve: 105_000,
    photos: [{ src: "photo-1677086522121-f6702cdbf07b", credit: "Unsplash" }],
    description:
      "The final year of the steel Nautilus with the blue-grey horizontally embossed dial, Gérald Genta's 1976 porthole case at its most sought-after. Self-winding calibre 26-330 S C visible through the sapphire caseback.",
    details: [
      ["Reference", "5711/1A-010"],
      ["Case", "Stainless steel, 40 mm"],
      ["Movement", "Calibre 26-330 S C, automatic"],
      ["Dial", "Blue-grey, horizontal embossing"],
      ["Bracelet", "Integrated steel, fold-over clasp"],
      ["Accompanied by", "Box, papers, Certificate of Origin"],
    ],
    provenance: ["Purchased new from an authorised retailer, Geneva, 2021", "Single private owner since"],
    condition: "Unworn condition. Factory protective stickers remain on the caseback and clasp.",
    location: "Geneva",
    closesAfter: 11 * MIN,
    appetite: 1.12,
    openingBids: 14,
    featured: true,
  },
  {
    id: "birkin-30-togo",
    number: 2,
    maker: "Hermès",
    title: "Birkin 30",
    subtitle: "Togo calfskin · Palladium hardware · 2023",
    category: "Handbags",
    estimate: [32_000, 45_000],
    startPrice: 20_000,
    reserve: 30_000,
    photos: [{ src: "photo-1727414782567-0ec8a4eb6096", credit: "Unsplash" }],
    description:
      "The most coveted handbag in the world, made by a single artisan over some eighteen hours. Togo, the grained calfskin that holds its shape and shrugs off scratches, is the collector's everyday Birkin.",
    details: [
      ["Size", "30 × 22 × 16 cm"],
      ["Material", "Togo calfskin"],
      ["Hardware", "Palladium-plated"],
      ["Stamp", "B, 2023"],
      ["Accompanied by", "Lock, keys, clochette, dust bag, box, receipt"],
    ],
    provenance: ["Acquired from Hermès, Paris, 2023"],
    condition: "Pristine. Plastic remains on the hardware. Never carried.",
    location: "Hong Kong",
    closesAfter: 48 * MIN,
    appetite: 1.08,
    openingBids: 22,
    featured: true,
  },
  {
    id: "daytona-116500ln",
    number: 3,
    maker: "Rolex",
    title: "Cosmograph Daytona",
    subtitle: "Ref. 116500LN · Black dial, Cerachrom bezel · 2022",
    category: "Watches",
    estimate: [32_000, 42_000],
    startPrice: 22_000,
    reserve: 30_000,
    photos: [{ src: "photo-1587836374828-4dbafa94cf0e", credit: "Unsplash" }],
    description:
      "The racing chronograph that defined modern watch collecting, in its first steel-and-ceramic form: black lacquer dial, a scratchproof Cerachrom tachymeter bezel, and the in-house calibre 4130 behind it.",
    details: [
      ["Reference", "116500LN"],
      ["Case", "Oystersteel, 40 mm"],
      ["Movement", "Calibre 4130, automatic chronograph"],
      ["Dial", "Black lacquer"],
      ["Bezel", "Black Cerachrom tachymeter"],
      ["Accompanied by", "Box, warranty card, hang tags"],
    ],
    provenance: ["Purchased from an authorised dealer, New York, 2022"],
    condition: "Excellent, unpolished. Light wear to the clasp only.",
    location: "New York",
    closesAfter: 2 * HOUR + 14 * MIN,
    appetite: 1.15,
    openingBids: 31,
  },
  {
    id: "porsche-911-turbo-s",
    number: 4,
    maker: "Porsche",
    title: "911 Turbo S Exclusive Series",
    subtitle: "Black · One of 500 · 2018",
    category: "Motor cars",
    estimate: [380_000, 480_000],
    startPrice: 250_000,
    reserve: 360_000,
    photos: [{ src: "photo-1503376780353-7e6692767b70", credit: "Campbell Boulanger / Unsplash" }, { src: "photo-1583427053896-00378e61e661", credit: "Joshua Koblin / Unsplash" }],
    description:
      "The most powerful 911 Turbo of its generation, hand-finished by Porsche Exclusive Manufaktur in Zuffenhausen: 607 horsepower, a carbon bonnet and roof, and a matching Porsche Design chronograph delivered with the car.",
    details: [
      ["Engine", "3.8-litre twin-turbo flat-six, 607 PS"],
      ["Gearbox", "Seven-speed PDK"],
      ["0–100 km/h", "2.9 seconds"],
      ["Mileage", "3,100 km"],
      ["Documents", "Porsche Certificate of Authenticity, full service history"],
    ],
    provenance: ["Delivered new by Porsche Zentrum Stuttgart, 2018", "One private owner"],
    condition: "As new. Paint protection film since delivery, always garaged.",
    location: "Stuttgart",
    closesAfter: 5 * HOUR + 30 * MIN,
    appetite: 1.06,
    openingBids: 18,
    featured: true,
  },
  {
    id: "d-flawless-solitaire",
    number: 5,
    maker: "Graff",
    title: "10.02 carat D Flawless Diamond Ring",
    subtitle: "Round brilliant · Type IIa · Platinum",
    category: "Jewellery",
    estimate: [1_800_000, 2_400_000],
    startPrice: 1_200_000,
    reserve: 1_700_000,
    photos: [{ src: "photo-1669859097642-b8dca596fd14", credit: "Unsplash" }],
    description:
      "A round brilliant of the very highest grade: D colour, internally flawless, triple excellent, and of the chemically purest Type IIa, the rarest two per cent of diamonds. Set as a solitaire on a knife-edge platinum band.",
    details: [
      ["Weight", "10.02 carats"],
      ["Colour / clarity", "D / Flawless"],
      ["Cut, polish, symmetry", "Excellent"],
      ["Fluorescence", "None"],
      ["Report", "GIA, with Type IIa letter"],
    ],
    provenance: ["Private collection, Geneva"],
    condition: "Excellent. Ring size 52, can be resized.",
    location: "Geneva",
    closesAfter: 1 * DAY + 3 * HOUR,
    appetite: 1.1,
    openingBids: 9,
    featured: true,
  },
  {
    id: "macallan-1926",
    number: 6,
    maker: "The Macallan",
    title: "Fine & Rare 60 Years Old, 1926",
    subtitle: "Cask 263 · Bottled 1986 · 70 cl",
    category: "Wine & spirits",
    estimate: [2_000_000, 2_800_000],
    startPrice: 1_400_000,
    reserve: 1_900_000,
    photos: [{ src: "photo-1717413662498-35bd8638a347", credit: "Unsplash" }],
    description:
      "The holy grail of whisky. Distilled in 1926 and left in sherry cask 263 for sixty years, the 1926 is the most valuable spirit ever sold at auction. Bottled in 1986 with the Fine & Rare label.",
    details: [
      ["Distilled", "1926"],
      ["Bottled", "1986"],
      ["Cask", "No. 263, sherry"],
      ["Strength", "42.6% ABV"],
      ["Fill level", "Into neck"],
    ],
    provenance: ["Acquired from the distillery by the present owner's family"],
    condition: "Excellent. Original capsule and seal intact. Label clean and unscuffed.",
    location: "London",
    closesAfter: 2 * DAY + 6 * HOUR,
    appetite: 1.05,
    openingBids: 12,
    featured: true,
  },
  {
    id: "royal-oak-jumbo",
    number: 7,
    maker: "Audemars Piguet",
    title: "Royal Oak “Jumbo” Extra-Thin",
    subtitle: "Ref. 15202ST · Stainless steel · 2020",
    category: "Watches",
    estimate: [90_000, 130_000],
    startPrice: 60_000,
    reserve: 85_000,
    photos: [{ src: "photo-1671195828444-eb720226a961", credit: "Unsplash" }],
    description:
      "Genta's octagonal original in its purest form: 39 mm, 8.1 mm thin, “Petite Tapisserie” dial in Bleu Nuit, Nuage 50, with the AP logo at six.",
    details: [
      ["Reference", "15202ST.OO.1240ST.01"],
      ["Case", "Stainless steel, 39 mm"],
      ["Movement", "Calibre 2121, automatic"],
      ["Accompanied by", "Box and papers"],
    ],
    provenance: ["Private collection, Singapore"],
    condition: "Very good, light signs of wear to the bracelet.",
    location: "Singapore",
    closesAfter: 9 * HOUR,
    appetite: 1.1,
    openingBids: 16,
  },
  {
    id: "chanel-classic-flap",
    number: 8,
    maker: "Chanel",
    title: "Classic Double Flap, Medium",
    subtitle: "Black lambskin · 24k gold-plated hardware · 1989",
    category: "Handbags",
    estimate: [12_000, 18_000],
    startPrice: 6_000,
    reserve: 10_000,
    photos: [{ src: "photo-1586413595198-1840407316e9", credit: "Unsplash" }],
    description:
      "Karl Lagerfeld's 1983 update of Coco Chanel's 2.55: the interlocking CC turn-lock in 24-karat gold plate on diamond-quilted lambskin. Early vintage examples with gold hardware are increasingly scarce.",
    details: [
      ["Size", "25.5 × 15.5 × 6.5 cm"],
      ["Material", "Lambskin"],
      ["Hardware", "24k gold-plated"],
      ["Serial", "1-series hologram"],
    ],
    provenance: ["Private collection, Paris"],
    condition: "Very good. Light rubbing to the corners, hardware bright.",
    location: "Paris",
    closesAfter: 1 * DAY + 14 * HOUR,
    appetite: 1.25,
    openingBids: 19,
  },
  {
    id: "kelly-28-noir",
    number: 9,
    maker: "Hermès",
    title: "Kelly Sellier 28",
    subtitle: "Noir Box calf · Gold hardware · 2022",
    category: "Handbags",
    estimate: [28_000, 38_000],
    startPrice: 18_000,
    reserve: 26_000,
    photos: [{ src: "photo-1601924928357-22d3b3abfcfb", credit: "Unsplash" }],
    description:
      "The stiff, top-stitched Sellier Kelly in black Box calf, the glossy leather that ages to a deep patina. The bag Grace Kelly carried to shield her pregnancy from photographers in 1956.",
    details: [
      ["Size", "28 × 22 × 10 cm"],
      ["Material", "Box calf"],
      ["Hardware", "Gold-plated"],
      ["Stamp", "B, 2022"],
    ],
    provenance: ["Acquired from Hermès, London, 2022"],
    condition: "Pristine, unused.",
    location: "London",
    closesAfter: 3 * DAY + 2 * HOUR,
    appetite: 1.12,
    openingBids: 11,
  },
  {
    id: "diamond-riviere",
    number: 10,
    maker: "Cartier",
    title: "Diamond Rivière Necklace",
    subtitle: "Platinum · Approx. 42 carats · 1950s",
    category: "Jewellery",
    estimate: [450_000, 650_000],
    startPrice: 300_000,
    reserve: 430_000,
    photos: [{ src: "photo-1673178875233-a1f2e0124b7e", credit: "Unsplash" }],
    description:
      "A river of light: graduated round brilliant and baguette diamonds, each set to move against the next, from the Rue de la Paix workshops at the height of the post-war revival of high jewellery.",
    details: [
      ["Diamonds", "Approx. 42 ct total, D–F colour"],
      ["Length", "40 cm"],
      ["Metal", "Platinum"],
      ["Signed", "Cartier Paris, numbered"],
    ],
    provenance: ["Commissioned in Paris, circa 1955", "By descent"],
    condition: "Excellent. Signed and numbered.",
    location: "Geneva",
    closesAfter: 4 * DAY,
    appetite: 1.12,
    openingBids: 8,
  },
  {
    id: "laferrari",
    number: 11,
    maker: "Ferrari",
    title: "LaFerrari",
    subtitle: "Rosso Corsa · One of 499 · 2015",
    category: "Motor cars",
    estimate: [3_200_000, 3_900_000],
    startPrice: 2_200_000,
    reserve: 3_000_000,
    photos: [{ src: "photo-1517994112540-009c47ea476b", credit: "Matt Antonioli / Unsplash" }],
    description:
      "Maranello's first hybrid hypercar, and the heir to the Enzo: a 6.3-litre V12 with an F1-derived HY-KERS motor, 963 horsepower, and a carbon tub built by the Scuderia's own racing department.",
    details: [
      ["Engine", "6,262 cc V12 with HY-KERS"],
      ["Power", "963 CV combined"],
      ["Mileage", "1,840 km"],
      ["Documents", "Ferrari Classiche certification, full Ferrari service history"],
    ],
    provenance: ["Delivered new to Monaco, 2015", "Two owners from new"],
    condition: "Excellent. Hybrid battery serviced by Ferrari in 2025.",
    location: "Maranello",
    closesAfter: 4 * DAY + 20 * HOUR,
    appetite: 1.05,
    openingBids: 7,
    featured: true,
  },
  {
    id: "romanee-conti-1945",
    number: 12,
    maker: "Domaine de la Romanée-Conti",
    title: "Romanée-Conti Grand Cru 1945",
    subtitle: "Côte de Nuits · 75 cl",
    category: "Wine & spirits",
    estimate: [450_000, 650_000],
    startPrice: 250_000,
    reserve: 420_000,
    photos: [{ src: "photo-1610631787813-9eeb1a2386cc", credit: "Unsplash" }],
    description:
      "From the last vintage before the domaine's pre-phylloxera vines were pulled up: only 600 bottles were made. A bottle of the 1945 holds the record as the most expensive wine ever sold.",
    details: [
      ["Vintage", "1945"],
      ["Appellation", "Romanée-Conti Grand Cru"],
      ["Production", "Approx. 600 bottles"],
      ["Fill level", "Top shoulder"],
    ],
    provenance: ["Cellared at the domaine until 1960", "Private European cellar since"],
    condition: "Very good. Label slightly bin-soiled, capsule intact.",
    location: "Beaune",
    closesAfter: 5 * DAY + 4 * HOUR,
    appetite: 1.1,
    openingBids: 10,
  },
  {
    id: "leica-m-summilux",
    number: 13,
    maker: "Leica",
    title: "M Rangefinder with Summilux-M 50 mm",
    subtitle: "Black paint · Wetzlar · Collector's edition",
    category: "Collectibles",
    estimate: [8_000, 12_000],
    startPrice: 4_000,
    reserve: 7_000,
    photos: [{ src: "photo-1683309137841-9965913e78e4", credit: "Unsplash" }],
    description:
      "The camera that set the standard for every rangefinder since: the bright-line finder, the bayonet M mount, and Wetzlar's hand assembly, here with the Summilux, the lens street photographers speak of in whispers.",
    details: [
      ["Body", "Leica M, black paint"],
      ["Lens", "Summilux-M 50 mm f/1.4 ASPH"],
      ["Shutter", "Serviced, accurate at all speeds"],
      ["Accompanied by", "Box, strap, Leica certificate"],
    ],
    provenance: ["Private collection, Vienna"],
    condition: "Excellent. Bright finder, clean glass.",
    location: "Vienna",
    closesAfter: 19 * HOUR,
    appetite: 1.3,
    openingBids: 21,
  },
  {
    id: "air-jordan-1-1985",
    number: 14,
    maker: "Nike",
    title: "Air Jordan 1 High “Chicago”",
    subtitle: "Original release · 1985 · US 10",
    category: "Collectibles",
    estimate: [28_000, 42_000],
    startPrice: 15_000,
    reserve: 25_000,
    photos: [{ src: "photo-1645833889386-2782e290ee3b", credit: "Unsplash" }],
    description:
      "The shoe that started sneaker culture. An original 1985 pair in the white, black and Varsity Red the NBA was said to have banned, with the Wings logo and the 'Nike Air' tongue tag of the first release.",
    details: [
      ["Size", "US 10"],
      ["Year", "1985"],
      ["Colourway", "White / Black – Varsity Red"],
      ["Accompanied by", "Original box"],
    ],
    provenance: ["Bought new in Chicago, 1985", "Private collection since"],
    condition: "Near deadstock. Light yellowing to the midsoles, as expected.",
    location: "Los Angeles",
    closesAfter: 2 * DAY + 20 * HOUR,
    appetite: 1.15,
    openingBids: 27,
  },
  {
    id: "montblanc-149-solitaire",
    number: 15,
    maker: "Montblanc",
    title: "Meisterstück 149 Solitaire",
    subtitle: "Solid 18k gold · Hand-engraved · Limited edition",
    category: "Collectibles",
    estimate: [18_000, 26_000],
    startPrice: 9_000,
    reserve: 15_000,
    photos: [{ src: "photo-1518674660708-0e2c0473e68e", credit: "Unsplash" }],
    description:
      "The 149, Montblanc's flagship since 1952, the pen on which treaties have been signed, here made in solid gold with a hand-engraved barrel and a two-tone 18k nib ground by hand in Hamburg.",
    details: [
      ["Barrel", "Solid 18k gold, hand-engraved"],
      ["Nib", "18k two-tone, size M"],
      ["Filling", "Piston"],
    ],
    provenance: ["Private collection, Dubai"],
    condition: "As new, in its presentation case.",
    location: "Dubai",
    closesAfter: 6 * DAY,
    appetite: 1.05,
    openingBids: 5,
  },
  {
    id: "abstract-oil",
    number: 16,
    maker: "Post-War & Contemporary",
    title: "Composition in Ochre and Blue",
    subtitle: "Oil on canvas · 1962 · 162 × 130 cm",
    category: "Collectibles",
    estimate: [900_000, 1_300_000],
    startPrice: 600_000,
    reserve: 850_000,
    photos: [{ src: "photo-1578926375605-eaf7559b1458", credit: "Unsplash" }],
    description:
      "A large and important canvas from the artist's mature period, when colour became the subject itself: luminous fields that seem to breathe as you stand before them.",
    details: [
      ["Medium", "Oil on canvas"],
      ["Dimensions", "162 × 130 cm"],
      ["Signed", "Signed and dated on the reverse"],
      ["Exhibited", "Venice, 1964"],
    ],
    provenance: ["Galerie Maeght, Paris", "Acquired from the above by the present owner, 1971"],
    condition: "Excellent, unlined canvas.",
    location: "New York",
    closesAfter: 3 * DAY + 18 * HOUR,
    appetite: 1.18,
    openingBids: 6,
  },
  {
    id: "clive-christian-no1",
    number: 17,
    maker: "Clive Christian",
    title: "No. 1 Imperial Majesty",
    subtitle: "Baccarat crystal · 5-carat diamond · 500 ml",
    category: "Collectibles",
    estimate: [180_000, 240_000],
    startPrice: 110_000,
    reserve: 170_000,
    photos: [{ src: "photo-1615160460367-dcccd27e11ad", credit: "Unsplash" }],
    description:
      "One of only ten bottles of the perfume once named the most expensive in the world: Baccarat crystal, an 18-carat gold collar and a 5-carat white diamond.",
    details: [
      ["Volume", "500 ml"],
      ["Bottle", "Baccarat crystal, 18k gold collar"],
      ["Edition", "One of ten"],
    ],
    provenance: ["Private collection, London"],
    condition: "Sealed.",
    location: "London",
    closesAfter: 1 * DAY + 20 * HOUR,
    appetite: 1.1,
    openingBids: 8,
  },
  {
    id: "cartier-love",
    number: 18,
    maker: "Cartier",
    title: "Love Bracelet, Diamond-Paved",
    subtitle: "18k yellow gold · Size 17 · 2021",
    category: "Jewellery",
    estimate: [48_000, 62_000],
    startPrice: 30_000,
    reserve: 44_000,
    photos: [{ src: "photo-1625417255685-9889e8dd94d2", credit: "Unsplash" }],
    description:
      "Aldo Cipullo's 1969 bracelet that locks on with a tiny screwdriver, a modern token of devotion. This example is fully paved with brilliant-cut diamonds, the rarest of the Love family.",
    details: [
      ["Metal", "18k yellow gold"],
      ["Diamonds", "204 brilliant-cut, approx. 2 ct"],
      ["Size", "17"],
      ["Accompanied by", "Screwdriver, box and certificate"],
    ],
    provenance: ["Private collection, Milan"],
    condition: "Excellent.",
    location: "Milan",
    closesAfter: 7 * HOUR + 40 * MIN,
    appetite: 1.2,
    openingBids: 13,
  },
]

export const FEATURED = LOTS.filter((l) => l.featured)

const byId = new Map(LOTS.map((l) => [l.id, l]))
export const getLot = (id: string) => byId.get(id)
