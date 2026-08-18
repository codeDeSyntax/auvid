import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Fallback: Get fonts from files when registry approach fails
 */
async function getFontsFromFiles(): Promise<string[]> {
  const fontDir = path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
  const fontFamilies = new Set<string>();

  if (fs.existsSync(fontDir)) {
    const files = fs.readdirSync(fontDir);
    const fontFiles = files.filter(
      (file) =>
        file.endsWith(".ttf") ||
        file.endsWith(".otf") ||
        file.endsWith(".TTF") ||
        file.endsWith(".OTF"),
    );

    fontFiles.forEach((file) => {
      let name = file.replace(/\.(ttf|otf|TTF|OTF)$/, "");
      name = name.replace(/[_-]+/g, " ").trim();

      const words = name.split(/\s+/);
      let baseName = "";
      let wordCount = 0;

      for (const word of words) {
        if (
          /^(Regular|Reg|Bold|Bd|Italic|Ital|It|Light|Lt|Medium|Med|SemiBold|Semibold|Black|Blk|Heavy|Hv|Thin|Th|ExtraLight|ExtraBold|Condensed|Cond|Oblique|Obl|Narrow|Nar|Extended|Ext|Book|Bk|Demi|Dm|Ultra|Ult|Roman|Rm)$/i.test(
            word,
          )
        ) {
          break;
        }
        if (/^[A-Z]{1,2}$/i.test(word) && wordCount > 0) {
          break;
        }
        baseName += (baseName ? " " : "") + word;
        wordCount++;
        if (wordCount >= 3) break;
      }

      if (baseName.length > 1) {
        fontFamilies.add(baseName);
      }
    });
  }

  return Array.from(fontFamilies).sort();
}

/**
 * Get system fonts from the operating system
 * Supports Windows, macOS, and Linux
 */
export async function getSystemFonts(): Promise<string[]> {
  try {
    let fonts: string[] = [];

    if (process.platform === "win32") {
      // Windows: Read font names from registry (async — must not block IPC event loop)
      try {
        const { stdout: output } = await execAsync(
          'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /s',
          { encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 },
        );

        const fontFamilies = new Set<string>();
        const lines = output.split("\n");

        for (const line of lines) {
          // Match registry entries like "Arial (TrueType)    REG_SZ    arial.ttf"
          const match = line.match(
            /^\s*(.+?)\s+\((?:TrueType|OpenType)\)\s+REG_SZ/i,
          );
          if (match) {
            let fontName = match[1].trim();

            // Remove style suffixes from the font name
            fontName = fontName
              .replace(
                /\s+(Regular|Bold|Italic|Light|Medium|SemiBold|Black|Heavy|Thin|ExtraLight|ExtraBold|Condensed|Oblique|Narrow|Extended|Book|Demi|Ultra|Roman)$/gi,
                "",
              )
              .trim();

            if (fontName.length > 1) {
              fontFamilies.add(fontName);
            }
          }
        }

        fonts = Array.from(fontFamilies).sort();
      } catch (err) {
        console.error("Error reading Windows font registry:", err);
        // Fallback to file-based approach if registry fails
        fonts = await getFontsFromFiles();
      }
    } else if (process.platform === "darwin") {
      // macOS: Use system_profiler
      try {
        const { stdout: output } = await execAsync(
          "system_profiler SPFontsDataType",
          {
            encoding: "utf-8",
          },
        );
        const matches = output.match(/(?:^|\n)\s+([^:\n]+):/gm);
        if (matches) {
          fonts = matches
            .map((m: string) => m.trim().replace(/:$/, ""))
            .filter((name: string) => name.length > 0);
        }
      } catch (err) {
        console.error("Error getting macOS fonts:", err);
      }
    } else {
      // Linux: Check common font directories
      const fontDirs = [
        "/usr/share/fonts",
        "/usr/local/share/fonts",
        path.join(os.homedir(), ".fonts"),
      ];

      for (const dir of fontDirs) {
        if (fs.existsSync(dir)) {
          const findFonts = (directory: string) => {
            const items = fs.readdirSync(directory);
            items.forEach((item) => {
              const fullPath = path.join(directory, item);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                findFonts(fullPath);
              } else if (
                item.endsWith(".ttf") ||
                item.endsWith(".otf") ||
                item.endsWith(".TTF") ||
                item.endsWith(".OTF")
              ) {
                let name = item.replace(/\.(ttf|otf|TTF|OTF)$/, "");
                name = name.replace(/[_-]+/g, " ").trim();

                // Split into words and extract base name
                const words = name.split(/\s+/);
                let baseName = "";
                let wordCount = 0;

                for (const word of words) {
                  // Stop if we hit a style/weight indicator
                  if (
                    /^(Regular|Reg|Rg|Bold|Bd|B|Italic|Ital|It|I|Light|Lt|Lgt|L|Medium|Med|Md|M|SemiBold|Semibold|SmBd|SBd|SB|Sb|Black|Blk|Bk|BK|Heavy|Hv|H|Thin|Th|T|ExtraLight|XLight|XL|ExtraBold|XBold|XBd|XB|Condensed|Cond|Cn|C|Oblique|Obl|Ob|O|Narrow|Nar|Nr|N|Extended|Ext|Ex|E|Book|Bk|Demi|Dm|D|Ultra|Ult|U|Roman|Rm|PostScript|PS|PSTC|PST|W[1-9])$/i.test(
                      word,
                    )
                  ) {
                    break;
                  }

                  // Stop if word is just 1-2 uppercase letters (likely abbreviation)
                  if (/^[A-Z]{1,2}$/i.test(word) && wordCount > 0) {
                    break;
                  }

                  baseName += (baseName ? " " : "") + word;
                  wordCount++;

                  // Maximum 3 words for font family name
                  if (wordCount >= 3) break;
                }

                if (baseName.length > 1) {
                  fonts.push(baseName);
                }
              }
            });
          };
          findFonts(dir);
        }
      }

      // Remove duplicates from Linux fonts
      fonts = [...new Set(fonts)];
    }

    // Add common fallback fonts including variants
    const commonFonts = [
      "Arial",
      "Arial Black",
      "Arial Narrow",
      "Helvetica",
      "Times New Roman",
      "Courier New",
      "Verdana",
      "Georgia",
      "Palatino",
      "Garamond",
      "Comic Sans MS",
      "Trebuchet MS",
      "Impact",
      "Lucida Console",
      "Lucida Sans Unicode",
      "Tahoma",
      "Segoe UI",
      "Calibri",
      "Cambria",
      "Candara",
      "Consolas",
      "Corbel",
      "Century Gothic",
      "Franklin Gothic",
      "Book Antiqua",
      "Bookman Old Style",
    ];

    // Merge and deduplicate
    fonts = [...new Set([...fonts, ...commonFonts])].sort();

    return fonts;
  } catch (error) {
    console.error("Error getting system fonts:", error);
    // Return fallback fonts if there's an error
    return [
      "Arial",
      "Arial Black",
      "Arial Narrow",
      "Calibri",
      "Cambria",
      "Comic Sans MS",
      "Consolas",
      "Courier New",
      "Georgia",
      "Impact",
      "Segoe UI",
      "Tahoma",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
    ];
  }
}
