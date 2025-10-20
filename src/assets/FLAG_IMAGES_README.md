# Flag Images for Language Selector

The application requires flag images for the language selector. You need to add the following flag images to this directory:

## Required Files

- `flag-fr.png` - French flag
- `flag-de.png` - German flag
- `flag-es.png` - Spanish flag
- `flag-pl.png` - Polish flag

## Where to Download Free Flag Icons

You can download free flag images from any of these sources:

### Recommended Sources

1. **Flagpedia.net** - https://flagpedia.net/download/icons
   - High-quality PNG icons
   - Free for personal and commercial use
   - Available in multiple sizes

2. **IconPacks.net** - https://www.iconpacks.net/free-icon-pack/free-circular-country-flags-icon-pack-211.html
   - 143 free circular country flags
   - Available in SVG and PNG (16x16 to 512x512)
   - Matches the circular style of existing flags

3. **FlatIcon** - https://www.flaticon.com/packs/countrys-flags
   - 260+ country flag icons
   - SVG, PNG, EPS formats
   - Free with attribution (or premium license)

## Specifications

To match the existing flag images (`flag-nl.png` and `flag-en.png`):

- **Format**: PNG
- **Recommended size**: Similar to existing flags (check the dimensions of flag-nl.png and flag-en.png)
- **Style**: Should match the circular/rounded style of existing flags if possible
- **Naming convention**: `flag-[ISO language code].png`
  - French: `flag-fr.png`
  - German: `flag-de.png`
  - Spanish: `flag-es.png`
  - Polish: `flag-pl.png`

## How to Add the Images

1. Download the flag images from one of the sources above
2. Ensure they are in PNG format
3. Rename them according to the naming convention
4. Place them in this directory (`src/assets/`)
5. The application will automatically use them

## Alternative: Using Emoji Flags

If you prefer not to use image files, you can modify the `home-page.ts` component to use Unicode emoji flags instead:

- 🇫🇷 French: U+1F1EB U+1F1F7
- 🇩🇪 German: U+1F1E9 U+1F1EA
- 🇪🇸 Spanish: U+1F1EA U+1F1F8
- 🇵🇱 Polish: U+1F1F5 U+1F1F1
