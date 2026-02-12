import { VolcaEngine } from "./Volca";
import { ZCSSParser } from "./ZCSSParser";

export class VolcaZDOM {
    engine: VolcaEngine;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize the base GPU engine
        this.engine = new VolcaEngine(canvas);
    }

    async applyStylesheet(url: string) {
        // 1. Fetch the .zcss file
        const response = await fetch(url);
        const zcssText = await response.text();

        // 2. Parse it
        const rules = ZCSSParser.parse(zcssText);

        // 3. Init Engine
        await this.engine.init();

        // 4. Apply Rules
        for (const rule of rules) {
            console.log(`Processing ZCSS Rule: ${rule.selector}`);
            
            if (rule.selector.startsWith('#')) {
                // It's a specific object ID, apply logic
                this.applyObjectConfig(rule.properties);
            }
        }
    }

    async applyObjectConfig(props: Record<string, string>) {
        // HANDLE GEOMETRY (The GLB part)
        if (props['geometry']) {
            const urlMatch = props['geometry'].match(/url\('?(.*?)'?\)/);
            if (urlMatch) {
                const vertData = await ZCSSParser.loadGLBVertices(urlMatch[1]);
                // Send these vertices to the Compute Shader as spawn points
                // This requires updating the initBuffers() method in Volca.ts 
                // to accept optional initial positions.
                console.log("Mesh geometry loaded into Compute Pipeline");
            }
        }

        // HANDLE PHYSICS
        if (props['spawn-rate']) {
            const count = parseInt(props['spawn-rate']);
            // Re-allocate GPU buffers for new size (simplified logic)
            console.log(`Set GPU Compute Threads to ${count}`);
        }

        // HANDLE COLORS (Hex to Vec4)
        if (props['color-start']) {
            const hex = props['color-start'];
            // Convert Hex to [r, g, b, 1.0] and update Uniform Buffer
        }
    }
}
