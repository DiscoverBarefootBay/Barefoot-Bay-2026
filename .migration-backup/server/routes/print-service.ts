import { Request, Response, Router } from "express";
import { validateAdmin } from "../auth";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { PrintProvider } from "@shared/schema";

// Config file path
const CONFIG_DIR = path.join(process.cwd(), "config");
const CONFIG_FILE = path.join(CONFIG_DIR, "print-service.json");

// Create router
const router = Router();

// Config schema
const PrintServiceConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  serviceProvider: z.enum([
    PrintProvider.PRINTFUL,
    PrintProvider.PRINTIFY,
    PrintProvider.GOOTEN,
  ], {
    errorMap: () => ({ message: "Invalid service provider" }),
  }),
});

type PrintServiceConfig = z.infer<typeof PrintServiceConfigSchema>;

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Helper to read configuration
function getPrintServiceConfig(): PrintServiceConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error("Error reading print service config:", error);
  }
  
  return null;
}

// Helper to write configuration
function savePrintServiceConfig(config: PrintServiceConfig): boolean {
  try {
    fs.writeFileSync(
      CONFIG_FILE, 
      JSON.stringify(config, null, 2),
      { encoding: "utf8" }
    );
    return true;
  } catch (error) {
    console.error("Error saving print service config:", error);
    return false;
  }
}

// Get print service configuration (admin only)
router.get("/config", validateAdmin, (req: Request, res: Response) => {
  try {
    const config = getPrintServiceConfig();
    
    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    // Never send the API key to the client
    const safeConfig = {
      serviceProvider: config.serviceProvider,
      hasApiKey: Boolean(config.apiKey),
    };
    
    res.status(200).json(safeConfig);
  } catch (error) {
    console.error("Error fetching print service config:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

// Save print service configuration (admin only)
router.post("/config", validateAdmin, (req: Request, res: Response) => {
  try {
    const validatedData = PrintServiceConfigSchema.parse(req.body);
    
    // Save the configuration
    const success = savePrintServiceConfig(validatedData);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to save configuration" });
    }
    
    // Return safe version of config
    const safeConfig = {
      serviceProvider: validatedData.serviceProvider,
      hasApiKey: Boolean(validatedData.apiKey),
    };
    
    res.status(200).json(safeConfig);
  } catch (error) {
    console.error("Error saving print service config:", error);
    
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid configuration data", details: error.errors });
    }
    
    res.status(500).json({ error: "Failed to save configuration" });
  }
});

// Test print service connection (admin only)
router.post("/test-connection", validateAdmin, (req: Request, res: Response) => {
  try {
    const config = getPrintServiceConfig();
    
    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    // In a real implementation, we would test the connection to the print-on-demand service here
    // For now, we'll just simulate a successful connection
    
    res.status(200).json({ 
      success: true, 
      message: `Successfully connected to ${config.serviceProvider}` 
    });
  } catch (error) {
    console.error("Error testing print service connection:", error);
    res.status(500).json({ error: "Failed to test connection" });
  }
});

// Fetch available products from print service (admin only)
router.get("/catalog", validateAdmin, (req: Request, res: Response) => {
  try {
    const config = getPrintServiceConfig();
    
    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    // In a real implementation, we would fetch the catalog from the print-on-demand service here
    // For now, we'll return mock catalog data
    
    const mockCatalog = [
      { 
        id: "shirt-1", 
        name: "Basic T-Shirt", 
        provider: config.serviceProvider,
        printAreas: ["front", "back"],
        variants: ["S", "M", "L", "XL"]
      },
      { 
        id: "hoodie-1", 
        name: "Pullover Hoodie", 
        provider: config.serviceProvider,
        printAreas: ["front", "back", "sleeve"],
        variants: ["S", "M", "L", "XL"] 
      },
      { 
        id: "mug-1", 
        name: "Ceramic Mug", 
        provider: config.serviceProvider,
        printAreas: ["front", "back"],
        variants: ["11oz", "15oz"] 
      }
    ];
    
    res.status(200).json(mockCatalog);
  } catch (error) {
    console.error("Error fetching print service catalog:", error);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

export default router;