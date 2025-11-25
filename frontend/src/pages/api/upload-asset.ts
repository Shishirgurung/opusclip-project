import { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth"; // Uncomment after creating auth.ts
import { BrandTemplate, Asset, AssetType } from "@/types";
import path from "path";
import fs from "fs/promises";
import formidable, { File } from "formidable";

// Disable Next.js body parser to allow formidable to handle the stream
export const config = {
  api: {
    bodyParser: false,
  },
};

// Define the structure of the API response
interface ApiResponse {
  success: boolean;
  message?: string;
  assetUrl?: string;
  error?: string;
  template?: BrandTemplate;
}

// Server-side template storage functions
const TEMPLATES_FILE_PATH = path.join(process.cwd(), "data", "templates.json");

async function readTemplates(): Promise<BrandTemplate[]> {
  try {
    await fs.access(TEMPLATES_FILE_PATH);
    const data = await fs.readFile(TEMPLATES_FILE_PATH, "utf-8");
    return JSON.parse(data) as BrandTemplate[];
  } catch (error) {
    // If the file doesn't exist or is empty, return an empty array
    return [];
  }
}

async function writeTemplates(templates: BrandTemplate[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(TEMPLATES_FILE_PATH), { recursive: true });
    await fs.writeFile(TEMPLATES_FILE_PATH, JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error("Failed to write templates file:", error);
    throw new Error("Could not save template data.");
  }
}

// Helper to build a strongly-typed asset object from form fields
function buildAsset(type: AssetType, url: string, fields: formidable.Fields): Asset {
  const position =
    fields.positionX?.[0] && fields.positionY?.[0]
      ? { x: Number(fields.positionX[0]), y: Number(fields.positionY[0]) }
      : { x: 10, y: 10 };

  const size =
    fields.sizeWidth?.[0] && fields.sizeHeight?.[0]
      ? { width: Number(fields.sizeWidth[0]), height: Number(fields.sizeHeight[0]) }
      : { width: 150, height: 50 };

  const opacity = fields.opacity?.[0] ? Number(fields.opacity[0]) : 1;
  const duration = fields.duration?.[0] ? Number(fields.duration[0]) : 5;
  const loop = fields.loop?.[0] ? fields.loop[0] === "true" : false;

  switch (type) {
    case "logo":
      return { type: "logo", url, position, size, opacity };
    case "cta":
      return { type: "cta", url, position, size, opacity };
    case "overlay":
      return { type: "overlay", url, position, size, opacity };
    case "background":
      return { type: "background", url, opacity, loop };
    case "intro":
      return { type: "intro", url, duration };
    case "outro":
      return { type: "outro", url, duration };
    default:
      // This should not be reached if isAssetType guard is used
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled asset type: ${exhaustiveCheck}`);
  }
}

// Type guard to validate assetType
function isAssetType(type: any): type is AssetType {
  return ["logo", "cta", "background", "intro", "outro", "overlay"].includes(type);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // const session = await getServerSession(req, res, authOptions); // Uncomment after creating auth.ts
    // if (!session?.user) { // Uncomment after creating auth.ts
    //   return res.status(401).json({ success: false, error: "Authentication required" }); // Uncomment after creating auth.ts
    // } // Uncomment after creating auth.ts

    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const assetTypeRaw = fields.assetType;
    const assetTypeValue = Array.isArray(assetTypeRaw) ? assetTypeRaw[0] : assetTypeRaw;
    const templateIdRaw = fields.templateId;
    const templateId = Array.isArray(templateIdRaw) ? templateIdRaw[0] : templateIdRaw;
    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file || !assetTypeValue) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields: file or assetType." });
    }

    if (!isAssetType(assetTypeValue)) {
      return res.status(400).json({ success: false, error: `Invalid asset type: ${assetTypeValue}` });
    }
    const assetType: AssetType = assetTypeValue;

    // --- File Validation ---
    const uploadDir = path.join(process.cwd(), "public", "assets", "templates");
    await fs.mkdir(uploadDir, { recursive: true });

    const extension = path.extname(file.originalFilename || "");
    const filename = `${uuidv4()}${extension}`;
    const newPath = path.join(uploadDir, filename);
    const assetUrl = `/assets/templates/${filename}`;

    await fs.rename(file.filepath, newPath);

    if (templateId) {
      const templates = await readTemplates();
      const templateIndex = templates.findIndex((t) => t.id === templateId);

      if (templateIndex === -1) {
        return res.status(404).json({ success: false, error: "Template not found." });
      }

      const newAsset = buildAsset(assetType, assetUrl, fields);

      const updatedTemplate = { ...templates[templateIndex] };
      if (!updatedTemplate.assets) {
        updatedTemplate.assets = {};
      }

      // Use a switch statement for type-safe assignment
      switch (newAsset.type) {
        case "logo":
          updatedTemplate.assets.logo = newAsset;
          break;
        case "cta":
          updatedTemplate.assets.cta = newAsset;
          break;
        case "background":
          updatedTemplate.assets.background = newAsset;
          break;
        case "intro":
          updatedTemplate.assets.intro = newAsset;
          break;
        case "outro":
          updatedTemplate.assets.outro = newAsset;
          break;
        case "overlay":
          updatedTemplate.assets.overlay = newAsset;
          break;
      }
      updatedTemplate.updatedAt = new Date().toISOString();

      templates[templateIndex] = updatedTemplate;
      await writeTemplates(templates);

      return res.status(200).json({
        success: true,
        message: "File uploaded and template updated successfully",
        assetUrl,
        template: updatedTemplate,
      });
    }

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      assetUrl,
    });
  } catch (error) {
    console.error("Asset upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, error: errorMessage });
  }
}